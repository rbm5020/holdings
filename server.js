const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { Redis } = require('@upstash/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Redis database (fallback to in-memory for local development)
const redis = process.env.UPSTASH_REDIS_REST_URL ? new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
}) : null;

// Fallback file storage for development persistence
const fs = require('fs');
const portfolios = new Map();
const PORTFOLIO_FILE = './portfolios.json';

// Load existing portfolios from dev database on startup
loadFromDevDB();

// Save portfolios to file periodically
function savePortfoliosToFile() {
    try {
        const portfolioObj = Object.fromEntries(portfolios);
        fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolioObj, null, 2));
        console.log(`Saved ${portfolios.size} portfolios to file`);
    } catch (error) {
        console.error('Failed to save portfolios:', error);
    }
}

// Simple git-based persistence for development
const DEV_DB_FILE = './dev-portfolios.txt';

function saveToDevDB(id, portfolio) {
    try {
        const entry = `${id}|||${JSON.stringify(portfolio)}\n`;
        fs.appendFileSync(DEV_DB_FILE, entry);
        console.log(`Portfolio ${id} saved to dev database`);
        return true;
    } catch (error) {
        console.log('Dev DB save failed:', error.message);
        return false;
    }
}

function loadFromDevDB() {
    try {
        if (!fs.existsSync(DEV_DB_FILE)) return;

        const data = fs.readFileSync(DEV_DB_FILE, 'utf8');
        const lines = data.trim().split('\n').filter(line => line);

        lines.forEach(line => {
            const [id, portfolioJson] = line.split('|||');
            if (id && portfolioJson) {
                try {
                    const portfolio = JSON.parse(portfolioJson);
                    portfolios.set(id, portfolio);
                } catch (error) {
                    console.log(`Failed to parse portfolio ${id}`);
                }
            }
        });

        console.log(`Loaded ${portfolios.size} portfolios from dev database`);
    } catch (error) {
        console.log('Dev DB load failed:', error.message);
    }
}

// Debug logging to understand the persistence issue
function debugStorage() {
    console.log('=== STORAGE DEBUG ===');
    console.log('Redis available:', !!redis);
    console.log('Redis URL set:', !!process.env.UPSTASH_REDIS_REST_URL);
    console.log('GitHub token set:', !!process.env.GITHUB_TOKEN);
    console.log('In-memory portfolio count:', portfolios.size);
    console.log('File exists:', fs.existsSync(PORTFOLIO_FILE));
    console.log('Current working directory:', process.cwd());
    console.log('====================');
}

// Database helper functions
async function savePortfolio(id, portfolio) {
    try {
        if (redis) {
            if (portfolio.expiresAt) {
                // Calculate TTL in seconds
                const ttlSeconds = Math.ceil((new Date(portfolio.expiresAt) - new Date()) / 1000);
                await Promise.race([
                    redis.set(`portfolio:${id}`, JSON.stringify(portfolio), { ex: ttlSeconds }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 5000))
                ]);
            } else {
                // No expiration for "Forever" portfolios
                await Promise.race([
                    redis.set(`portfolio:${id}`, JSON.stringify(portfolio)),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 5000))
                ]);
            }
        } else {
            console.log('Using in-memory fallback for portfolio:', id);
            portfolios.set(id, portfolio);
            saveToDevDB(id, portfolio); // Save to dev database
            debugStorage();
        }
    } catch (error) {
        console.error('Redis save error:', error);
        // Fallback to in-memory storage
        portfolios.set(id, portfolio);
        saveToDevDB(id, portfolio); // Save to dev database even in error case
    }
}

async function getPortfolio(id) {
    try {
        if (redis) {
            const data = await Promise.race([
                redis.get(`portfolio:${id}`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 5000))
            ]);
            return data ? JSON.parse(data) : null;
        } else {
            return portfolios.get(id) || null;
        }
    } catch (error) {
        console.error('Redis get error:', error);
        // Fallback to in-memory storage
        return portfolios.get(id) || null;
    }
}

async function deletePortfolio(id) {
    try {
        if (redis) {
            await Promise.race([
                redis.del(`portfolio:${id}`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 5000))
            ]);
        } else {
            portfolios.delete(id);
        }
    } catch (error) {
        console.error('Redis delete error:', error);
        // Fallback to in-memory storage
        portfolios.delete(id);
    }
}

// Generate random ID
function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

// Fetch stock prices from Yahoo Finance
async function fetchStockPrices(tickers) {
    const prices = {};
    
    for (const ticker of tickers) {
        try {
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            
            const data = await response.json();
            
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                const currentPrice = result.meta.regularMarketPrice;
                const previousClose = result.meta.previousClose;
                const change = currentPrice - previousClose;
                const changePercent = (change / previousClose) * 100;
                
                prices[ticker] = {
                    price: currentPrice,
                    change: change,
                    changePercent: changePercent,
                    previousClose: previousClose
                };
            } else {
                // Fallback for invalid tickers
                prices[ticker] = {
                    price: 0,
                    change: 0,
                    changePercent: 0,
                    previousClose: 0,
                    error: 'Price not found'
                };
            }
        } catch (error) {
            console.error(`Error fetching price for ${ticker}:`, error.message);
            prices[ticker] = {
                price: 0,
                change: 0,
                changePercent: 0,
                previousClose: 0,
                error: 'API error'
            };
        }
    }
    
    return prices;
}

// Routes
app.post('/api/portfolios', async (req, res) => {
    try {
        const { holdings, categories, duration, email } = req.body;
        
        const id = generateId();
        const now = new Date();
        let expiresAt = null;
        
        if (duration !== 'Forever') {
            const durationMap = {
                '1 Day': 1,
                '1 Week': 7,
                '1 Month': 30
            };
            const days = durationMap[duration] || 0;
            expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        }
        
        const portfolio = {
            id,
            holdings: holdings.filter(h => h.ticker && h.ticker.trim()),
            categories,
            duration,
            email,
            createdAt: now,
            expiresAt
        };
        
        await savePortfolio(id, portfolio);
        
        res.json({ 
            success: true, 
            id, 
            url: `https://holdings-ten.vercel.app/p/${id}` 
        });
    } catch (error) {
        console.error('Portfolio creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create portfolio' 
        });
    }
});

app.get('/api/portfolios/:id', async (req, res) => {
    const portfolio = await getPortfolio(req.params.id);
    
    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Check expiration
    if (portfolio.expiresAt && new Date() > portfolio.expiresAt) {
        await deletePortfolio(req.params.id);
        return res.status(404).json({ error: 'Portfolio expired' });
    }
    
    // Fetch current stock prices
    const tickers = portfolio.holdings.map(h => h.ticker);
    const prices = await fetchStockPrices(tickers);
    
    // Add price data to holdings
    const enrichedHoldings = portfolio.holdings.map(holding => ({
        ...holding,
        currentPrice: prices[holding.ticker]?.price || 0,
        change: prices[holding.ticker]?.change || 0,
        changePercent: prices[holding.ticker]?.changePercent || 0,
        totalValue: (prices[holding.ticker]?.price || 0) * holding.quantity,
        priceError: prices[holding.ticker]?.error || null
    }));
    
    res.json({
        ...portfolio,
        holdings: enrichedHoldings,
        prices: prices
    });
});

// Serve portfolio viewer
app.get('/p/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'viewer.html'));
});

// Serve creator
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'creator.html'));
});

// Static files after routes (so they don't override our specific routes)
app.use(express.static('.'));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    debugStorage();
});

// Export for Vercel
module.exports = app;
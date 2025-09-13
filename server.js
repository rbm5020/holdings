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

if (redis) {
    redis.ping().then(() => {
        console.log('✅ Redis connected successfully');
    }).catch(error => {
        console.log('❌ Redis connection failed:', error.message);
    });
} else {
    console.log('📝 No Redis configured - using in-memory storage for development');
}

// Fallback file storage for development persistence
const fs = require('fs');
const portfolios = new Map();
const portfolioBinMap = new Map(); // Maps portfolio ID to bin ID
const PORTFOLIO_FILE = './portfolios.json';

// Load existing portfolios on startup (if any persistence method is available)
console.log('Server starting up with Supabase persistence...');

// Production-ready Supabase persistence
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://demo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'demo-key';

async function saveToExternalDB(id, portfolio) {
    try {
        if (!process.env.SUPABASE_URL) {
            console.log(`⚠️ No SUPABASE_URL configured - portfolio ${id} saved to memory only`);
            return true;
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/portfolios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                id: id,
                data: portfolio,
                created_at: new Date().toISOString()
            })
        });

        if (response.ok) {
            console.log(`✅ Portfolio ${id} saved to Supabase`);
            return true;
        } else {
            const error = await response.text();
            console.log(`❌ Supabase save failed for ${id}:`, response.status, error);
            return false;
        }
    } catch (error) {
        console.log(`❌ Supabase save error for ${id}:`, error.message);
        return false;
    }
}

async function getFromExternalDB(id) {
    try {
        if (!process.env.SUPABASE_URL) {
            console.log(`⚠️ No SUPABASE_URL configured - cannot retrieve portfolio ${id}`);
            return null;
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/portfolios?id=eq.${id}&select=data`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (response.ok) {
            const results = await response.json();
            if (results && results.length > 0) {
                console.log(`✅ Found portfolio ${id} in Supabase`);
                return results[0].data;
            }
        }

        console.log(`❌ Portfolio ${id} not found in Supabase`);
        return null;
    } catch (error) {
        console.log(`❌ Supabase get error for ${id}:`, error.message);
        return null;
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
            console.log('🔄 No Redis - trying external DB for portfolio:', id);
            console.log('📝 Portfolio data:', JSON.stringify(portfolio).substring(0, 100) + '...');
            portfolios.set(id, portfolio);
            const saved = await saveToExternalDB(id, portfolio);
            console.log('💾 External DB save result:', saved);
        }
    } catch (error) {
        console.error('Redis save error:', error);
        // Fallback to external DB
        console.log('Using external DB fallback due to Redis error');
        portfolios.set(id, portfolio);
        await saveToExternalDB(id, portfolio);
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
            // Try in-memory first, then external DB
            let portfolio = portfolios.get(id);
            if (!portfolio) {
                console.log('🔍 Not in memory, checking external DB for:', id);
                portfolio = await getFromExternalDB(id);
                if (portfolio) {
                    console.log('✅ Found in external DB:', id);
                    portfolios.set(id, portfolio); // Cache it
                } else {
                    console.log('❌ Not found in external DB:', id);
                }
            } else {
                console.log('📋 Found in memory:', id);
            }
            return portfolio;
        }
    } catch (error) {
        console.error('Redis get error:', error);
        // Fallback to external DB
        let portfolio = portfolios.get(id);
        if (!portfolio) {
            portfolio = await getFromExternalDB(id);
            if (portfolio) {
                portfolios.set(id, portfolio);
            }
        }
        return portfolio;
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

// Generate random edit secret (longer for security)
function generateEditSecret() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
        const editSecret = generateEditSecret();
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
            editSecret,
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
            viewUrl: `https://holdings-ten.vercel.app/p/${id}`,
            editUrl: `https://holdings-ten.vercel.app/edit/${id}/${editSecret}`
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

// Edit validation endpoint for magic links
app.get('/api/edit/:id/:secret', async (req, res) => {
    try {
        const { id, secret } = req.params;
        const portfolio = await getPortfolio(id);

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        if (portfolio.editSecret !== secret) {
            return res.status(403).json({ error: 'Invalid edit secret' });
        }

        // Valid magic link - return portfolio data for editing
        res.json({
            success: true,
            portfolio: portfolio
        });
    } catch (error) {
        console.error('Edit validation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update existing portfolio endpoint
app.put('/api/portfolios/:id/:secret', async (req, res) => {
    try {
        const { id, secret } = req.params;
        const { holdings, categories, duration } = req.body;

        // Verify edit secret
        const existingPortfolio = await getPortfolio(id);
        if (!existingPortfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        if (existingPortfolio.editSecret !== secret) {
            return res.status(403).json({ error: 'Invalid edit secret' });
        }

        // Update portfolio with new data, keeping original creation info
        const updatedPortfolio = {
            ...existingPortfolio,
            holdings: holdings.filter(h => h.ticker && h.ticker.trim()),
            categories,
            duration,
            updatedAt: new Date()
        };

        await savePortfolio(id, updatedPortfolio);

        res.json({
            success: true,
            id,
            viewUrl: `https://holdings-ten.vercel.app/p/${id}`,
            editUrl: `https://holdings-ten.vercel.app/edit/${id}/${secret}`
        });
    } catch (error) {
        console.error('Portfolio update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update portfolio'
        });
    }
});

// Serve portfolio viewer
app.get('/p/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'viewer.html'));
});

// Serve edit page
app.get('/edit/:id/:secret', (req, res) => {
    res.sendFile(path.join(__dirname, 'creator.html'));
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
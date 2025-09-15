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
        console.log(`🔍 getFromExternalDB called for ${id}`);
        console.log(`🔧 SUPABASE_URL: ${process.env.SUPABASE_URL ? 'SET' : 'NOT SET'}`);
        console.log(`🔧 SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}`);

        if (!process.env.SUPABASE_URL) {
            console.log(`⚠️ No SUPABASE_URL configured - cannot retrieve portfolio ${id}`);
            return null;
        }

        const url = `${SUPABASE_URL}/rest/v1/portfolios?id=eq.${id}&select=data`;
        console.log(`🌐 Fetching from: ${url}`);

        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        console.log(`📡 Response status: ${response.status}`);

        if (response.ok) {
            const results = await response.json();
            console.log(`📦 Response data:`, results);

            if (results && results.length > 0) {
                console.log(`✅ Found portfolio ${id} in Supabase`);
                return results[0].data;
            } else {
                console.log(`❌ Portfolio ${id} not found in Supabase results`);
            }
        } else {
            const errorText = await response.text();
            console.log(`❌ Supabase error: ${response.status} - ${errorText}`);
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
            // Also delete from external DB
            await deleteFromExternalDB(id);
        }
    } catch (error) {
        console.error('Redis delete error:', error);
        // Fallback to in-memory storage and external DB
        portfolios.delete(id);
        await deleteFromExternalDB(id);
    }
}

async function deleteFromExternalDB(id) {
    try {
        if (!process.env.SUPABASE_URL) {
            console.log(`⚠️ No SUPABASE_URL configured - cannot delete portfolio ${id} from external DB`);
            return;
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/portfolios?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (response.ok) {
            console.log(`✅ Deleted portfolio ${id} from Supabase`);
        } else {
            console.log(`❌ Failed to delete portfolio ${id} from Supabase: ${response.status}`);
        }
    } catch (error) {
        console.error(`Error deleting portfolio ${id} from external DB:`, error);
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

// Analytics tracking functions
async function trackEvent(eventType, data = {}) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const eventKey = `analytics:${eventType}:${today}`;

        if (redis) {
            await redis.incr(eventKey);
            await redis.expire(eventKey, 86400 * 90); // Keep for 90 days

            // Track additional data
            if (data.ticker) {
                await redis.zincrby('analytics:tickers', 1, data.ticker);
            }
            if (data.ip) {
                await redis.sadd(`analytics:unique_ips:${today}`, data.ip);
                await redis.expire(`analytics:unique_ips:${today}`, 86400 * 7); // Keep for 7 days
            }
        }
    } catch (error) {
        console.error('Analytics tracking error:', error);
    }
}

async function getAnalyticsData() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0];

        if (!redis) {
            // Return basic data when Redis is unavailable
            return {
                today: {
                    portfolios: 0,
                    views: 0,
                    uniqueUsers: 0
                },
                yesterday: {
                    portfolios: 0,
                    views: 0
                },
                weekly: {
                    portfolios: portfolios.size,
                    views: 0
                },
                topTickers: [],
                conversionRate: 0,
                lastUpdated: new Date().toISOString(),
                message: 'Redis unavailable - showing limited data'
            };
        }

        // Get basic counts
        const portfoliosToday = await redis.get(`analytics:portfolio_created:${today}`) || 0;
        const portfoliosYesterday = await redis.get(`analytics:portfolio_created:${yesterday}`) || 0;
        const viewsToday = await redis.get(`analytics:portfolio_viewed:${today}`) || 0;
        const viewsYesterday = await redis.get(`analytics:portfolio_viewed:${yesterday}`) || 0;

        // Get unique IPs (DAU approximation)
        const uniqueIPsToday = await redis.scard(`analytics:unique_ips:${today}`) || 0;

        // Get top tickers
        const topTickers = await redis.zrevrange('analytics:tickers', 0, 9, 'WITHSCORES');
        const tickerData = [];
        for (let i = 0; i < topTickers.length; i += 2) {
            tickerData.push({ ticker: topTickers[i], count: parseInt(topTickers[i + 1]) });
        }

        // Get 7-day stats
        let weeklyPortfolios = 0;
        let weeklyViews = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(Date.now() - 86400000 * i).toISOString().split('T')[0];
            weeklyPortfolios += parseInt(await redis.get(`analytics:portfolio_created:${date}`) || 0);
            weeklyViews += parseInt(await redis.get(`analytics:portfolio_viewed:${date}`) || 0);
        }

        return {
            today: {
                portfolios: parseInt(portfoliosToday),
                views: parseInt(viewsToday),
                uniqueUsers: uniqueIPsToday
            },
            yesterday: {
                portfolios: parseInt(portfoliosYesterday),
                views: parseInt(viewsYesterday)
            },
            weekly: {
                portfolios: weeklyPortfolios,
                views: weeklyViews
            },
            topTickers: tickerData,
            conversionRate: weeklyViews > 0 ? (weeklyPortfolios / weeklyViews * 100).toFixed(2) : 0,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Analytics fetch error:', error);
        return { error: 'Failed to fetch analytics', details: error.message };
    }
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
        const { holdings, categories, categoryOrder, duration, email } = req.body;
        
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
            categoryOrder,
            duration,
            email,
            createdAt: now,
            expiresAt
        };
        
        await savePortfolio(id, portfolio);

        // Track portfolio creation
        await trackEvent('portfolio_created', {
            ip: req.ip,
            tickers: portfolio.holdings.map(h => h.ticker)
        });

        // Track individual tickers
        for (const holding of portfolio.holdings) {
            await trackEvent('ticker_used', { ticker: holding.ticker });
        }

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
    // Hidden analytics dashboard
    if (req.params.id === 'RBM32888') {
        return res.json(await getAnalyticsData());
    }

    const portfolio = await getPortfolio(req.params.id);

    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Check expiration
    if (portfolio.expiresAt && new Date() > portfolio.expiresAt) {
        await deletePortfolio(req.params.id);
        return res.status(404).json({ error: 'Portfolio expired' });
    }
    
    // Track portfolio view
    await trackEvent('portfolio_viewed', { ip: req.ip });

    // For fast loading, return portfolio structure immediately
    // Frontend will call separate prices endpoint
    res.json({
        ...portfolio,
        fastLoading: true
    });
});

// Fast prices endpoint - called after page loads
app.get('/api/portfolios/:id/prices', async (req, res) => {
    try {
        const portfolio = await getPortfolio(req.params.id);

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
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
            totalValue: (prices[holding.ticker]?.price || 0) * parseFloat(holding.shares || 0),
            priceError: prices[holding.ticker]?.error || null
        }));

        res.json({
            holdings: enrichedHoldings,
            prices: prices
        });
    } catch (error) {
        console.error('Prices fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

// Edit validation endpoint for magic links
app.get('/api/edit/:id/:secret', async (req, res) => {
    try {
        const { id, secret } = req.params;
        const portfolio = await getPortfolio(id);

        if (!portfolio) {
            console.log(`❌ Portfolio ${id} not found. Redis: ${!!redis}, Supabase: ${!!process.env.SUPABASE_URL}`);
            return res.status(404).json({
                error: 'Portfolio not found. This may be because persistence is not configured on this deployment.'
            });
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

// Delete portfolio endpoint
app.delete('/api/portfolios/:id/:secret', async (req, res) => {
    try {
        const { id, secret } = req.params;
        const portfolio = await getPortfolio(id);

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        if (portfolio.editSecret !== secret) {
            return res.status(403).json({ error: 'Invalid edit secret' });
        }

        // Valid magic link - delete the portfolio
        await deletePortfolio(id);

        // Track deletion event
        await trackEvent('portfolio_deleted', {
            ip: req.ip,
            portfolioId: id
        });

        res.json({ success: true, message: 'Portfolio deleted successfully' });
    } catch (error) {
        console.error('Portfolio deletion error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update existing portfolio endpoint
app.put('/api/portfolios/:id/:secret', async (req, res) => {
    try {
        const { id, secret } = req.params;
        const { holdings, categories, categoryOrder, duration } = req.body;

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
            categoryOrder,
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
    // Hidden analytics dashboard
    if (req.params.id === 'RBM32888') {
        res.sendFile(path.join(__dirname, 'analytics.html'));
    } else {
        res.sendFile(path.join(__dirname, 'viewer.html'));
    }
});

// Ticker validation endpoint
app.get('/api/validate-ticker/:ticker', async (req, res) => {
    try {
        const ticker = req.params.ticker.toUpperCase().trim();
        const category = req.query.category?.toLowerCase();

        if (!ticker) {
            return res.json({ valid: false, error: 'Empty ticker' });
        }

        // Context-aware validation based on category
        const cryptoMap = {
            'BTC': 'BTC-USD',
            'ETH': 'ETH-USD',
            'USDT': 'USDT-USD',
            'BNB': 'BNB-USD',
            'XRP': 'XRP-USD',
            'DOGE': 'DOGE-USD',
            'ADA': 'ADA-USD',
            'SOL': 'SOL-USD',
            'DOT': 'DOT-USD',
            'MATIC': 'MATIC-USD',
            'AAVE': 'AAVE-USD',
            'AVAX': 'AVAX-USD',
            'LINK': 'LINK-USD',
            'UNI': 'UNI-USD',
            'ATOM': 'ATOM-USD'
        };

        let actualTicker = ticker;

        if (category === 'crypto') {
            // Force crypto translation for crypto category
            actualTicker = cryptoMap[ticker] || ticker + '-USD';
        } else if (category && category !== 'crypto') {
            // For non-crypto categories, never apply crypto translation
            actualTicker = ticker;
        } else {
            // No category specified - use original fallback logic
            actualTicker = cryptoMap[ticker] || ticker;
        }

        // Validate by trying to fetch price from Yahoo Finance
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${actualTicker}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });

        const data = await response.json();

        if (data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta.regularMarketPrice) {
            res.json({
                valid: true,
                ticker: ticker,
                actualTicker: actualTicker,
                price: data.chart.result[0].meta.regularMarketPrice
            });
        } else {
            res.json({ valid: false, error: 'Ticker not found' });
        }
    } catch (error) {
        console.error('Ticker validation error:', error);
        res.json({ valid: false, error: 'Validation failed' });
    }
});

// Serve edit page
app.get('/edit/:id/:secret', (req, res) => {
    res.sendFile(path.join(__dirname, 'creator.html'));
});

// Serve creator
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'creator.html'));
});

// Serve success page
app.get('/success.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

// Static files after routes (so they don't override our specific routes)
app.use(express.static('.'));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    debugStorage();
});

// Export for Vercel
module.exports = app;
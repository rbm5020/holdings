const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory database
const portfolios = new Map();

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
app.post('/api/portfolios', (req, res) => {
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
    
    portfolios.set(id, portfolio);
    
    res.json({ 
        success: true, 
        id, 
        url: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`}/p/${id}` 
    });
});

app.get('/api/portfolios/:id', async (req, res) => {
    const portfolio = portfolios.get(req.params.id);
    
    if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Check expiration
    if (portfolio.expiresAt && new Date() > portfolio.expiresAt) {
        portfolios.delete(req.params.id);
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
});

// Export for Vercel
module.exports = app;
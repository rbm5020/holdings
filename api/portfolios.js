export default function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'POST') {
            // Create new portfolio with actual form data
            const portfolioData = req.body;
            const portfolioId = Math.random().toString(36).substring(2, 12);
            const editSecret = Math.random().toString(36).substring(2, 22);

            // Store the portfolio data (in-memory for now)
            const portfolio = {
                id: portfolioId,
                editSecret,
                holdings: portfolioData.holdings || [],
                categories: portfolioData.categories || {},
                categoryOrder: portfolioData.categoryOrder || [],
                duration: portfolioData.duration || 'Forever',
                email: portfolioData.email,
                createdAt: new Date().toISOString()
            };

            // Use global storage
            if (!global.portfolios) {
                global.portfolios = new Map();
            }
            global.portfolios.set(portfolioId, portfolio);

            const baseUrl = `https://${req.headers.host}`;
            const viewUrl = `${baseUrl}/view/${portfolioId}`;
            const editUrl = `${baseUrl}/edit/${portfolioId}/${editSecret}`;

            return res.status(200).json({
                success: true,
                viewUrl,
                editUrl,
                portfolioId
            });

        } else if (req.method === 'GET') {
            // Handle portfolio viewing by ID
            const portfolioId = req.query.portfolioId || req.url.split('/').pop();

            if (!portfolioId) {
                return res.status(400).json({ error: 'Portfolio ID required' });
            }

            // Load actual portfolio data from storage
            if (!global.portfolios) {
                global.portfolios = new Map();
            }

            const portfolio = global.portfolios.get(portfolioId);

            if (!portfolio) {
                return res.status(404).json({ error: 'Portfolio not found' });
            }

            // Add placeholder pricing for now (will fetch real prices later)
            const holdingsWithPrices = (portfolio.holdings || []).map(holding => ({
                ...holding,
                currentPrice: 100,  // Placeholder
                change: 2.5,        // Placeholder
                changePercent: 2.5  // Placeholder
            }));

            return res.status(200).json({
                holdings: holdingsWithPrices,
                categories: portfolio.categories || {},
                categoryOrder: portfolio.categoryOrder || []
            });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Portfolio API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

async function fetchRealTimePrices(holdings) {
    const promises = holdings.map(async (holding) => {
        try {
            const price = await getTickerPrice(holding.ticker);
            return {
                ...holding,
                currentPrice: price.currentPrice,
                change: price.change,
                changePercent: price.changePercent
            };
        } catch (error) {
            console.error(`Failed to fetch price for ${holding.ticker}:`, error);
            // Return with fallback data if price fetch fails
            return {
                ...holding,
                currentPrice: 100,
                change: 0,
                changePercent: 0
            };
        }
    });

    return Promise.all(promises);
}

async function getTickerPrice(ticker) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.chart && data.chart.result && data.chart.result.length > 0) {
            const result = data.chart.result[0];
            const meta = result.meta;

            if (meta && meta.regularMarketPrice !== undefined) {
                const currentPrice = meta.regularMarketPrice;
                const previousClose = meta.previousClose || currentPrice;
                const change = currentPrice - previousClose;
                const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

                return {
                    currentPrice: parseFloat(currentPrice.toFixed(2)),
                    change: parseFloat(change.toFixed(2)),
                    changePercent: parseFloat(changePercent.toFixed(2))
                };
            }
        }

        throw new Error('No price data found');

    } catch (error) {
        console.error(`Error fetching price for ${ticker}:`, error);
        throw error;
    }
}
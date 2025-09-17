export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Portfolio ID required' });
        }

        // Load actual portfolio data from storage
        if (!global.portfolios) {
            global.portfolios = new Map();
        }

        const portfolio = global.portfolios.get(id);

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        // Get real-time prices for the actual portfolio holdings
        const holdingsWithPrices = await fetchRealTimePrices(portfolio.holdings);

        return res.status(200).json({
            holdings: holdingsWithPrices,
            categories: portfolio.categories || {},
            categoryOrder: portfolio.categoryOrder || []
        });

    } catch (error) {
        console.error('Portfolio viewing error:', error);
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
            // Return with mock data if price fetch fails
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
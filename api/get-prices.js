export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tickers } = req.body;

        if (!tickers || !Array.isArray(tickers)) {
            return res.status(400).json({ error: 'Tickers array required' });
        }

        // Fetch prices for all tickers in parallel
        const pricePromises = tickers.map(async (ticker) => {
            try {
                const price = await getTickerPrice(ticker);
                return {
                    ticker,
                    ...price,
                    success: true
                };
            } catch (error) {
                console.error(`Failed to fetch price for ${ticker}:`, error);
                return {
                    ticker,
                    currentPrice: 100,
                    change: 0,
                    changePercent: 0,
                    success: false,
                    error: error.message
                };
            }
        });

        const results = await Promise.all(pricePromises);

        return res.status(200).json({
            success: true,
            prices: results
        });

    } catch (error) {
        console.error('Get prices error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

async function getTickerPrice(ticker) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000  // 5 second timeout
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
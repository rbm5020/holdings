export default function handler(req, res) {
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
        const { ticker } = req.query;

        if (!ticker) {
            return res.status(400).json({ error: 'Ticker required' });
        }

        // Real ticker validation against market data
        const tickerUpper = ticker.toUpperCase();
        const isValid = await validateAgainstMarketData(tickerUpper);

        return res.status(200).json({
            valid: isValid,
            ticker: tickerUpper
        });

    } catch (error) {
        console.error('Ticker validation error:', error);
        return res.status(500).json({ error: 'Validation failed' });
    }
}

async function validateAgainstMarketData(ticker) {
    try {
        // Use Yahoo Finance API to check if ticker exists
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();

        // Check if ticker exists and has valid data
        if (data.chart && data.chart.result && data.chart.result.length > 0) {
            const result = data.chart.result[0];

            // Verify the ticker symbol matches what we requested
            if (result.meta && result.meta.symbol) {
                const returnedSymbol = result.meta.symbol.toUpperCase();
                const requestedSymbol = ticker.toUpperCase();

                // Exact match or known variations
                return returnedSymbol === requestedSymbol;
            }
        }

        return false;

    } catch (error) {
        console.error('Market data validation error:', error);

        // Fallback: Basic format check if API fails
        return /^[A-Z]{1,5}(-USD)?(\.[A-Z]{1,3})?$/.test(ticker);
    }
}
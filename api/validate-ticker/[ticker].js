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

        // Basic format validation for now
        const tickerUpper = ticker.toUpperCase();
        const isValid = isValidTickerFormat(tickerUpper);

        return res.status(200).json({
            valid: isValid,
            ticker: tickerUpper
        });

    } catch (error) {
        console.error('Ticker validation error:', error);
        return res.status(500).json({ error: 'Validation failed' });
    }
}

function isValidTickerFormat(ticker) {
    // Stricter validation rules
    if (!ticker || ticker.length < 1 || ticker.length > 10) {
        return false;
    }

    // Valid ticker patterns
    const validPatterns = [
        /^[A-Z]{1,5}$/, // Standard stocks (AAPL, GOOGL, TSLA, etc)
        /^[A-Z]{1,5}-USD$/, // Crypto (BTC-USD, ETH-USD)
        /^[A-Z]{1,5}\.[A-Z]{1,3}$/, // International (TSM.TO, SAP.DE)
        /^[A-Z]{1,4}[0-9]{1,2}$/, // Some special tickers (BRK.A represented as BRKA)
    ];

    return validPatterns.some(pattern => pattern.test(ticker));
}
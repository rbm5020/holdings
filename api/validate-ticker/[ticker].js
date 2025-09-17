module.exports = async function handler(req, res) {
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

        const tickerUpper = ticker.toUpperCase();

        // Validate ticker format
        const isValid = await validateTicker(tickerUpper);

        return res.status(200).json({
            valid: isValid,
            ticker: tickerUpper
        });

    } catch (error) {
        console.error('Ticker validation error:', error);
        return res.status(500).json({ error: 'Validation failed' });
    }
}

async function validateTicker(ticker) {
    try {
        // For now, use basic format validation only
        // Will add real API validation after basic functionality works
        return isValidTickerFormat(ticker);

    } catch (error) {
        console.error('Ticker validation error:', error);
        return isValidTickerFormat(ticker);
    }
}

function isValidTickerFormat(ticker) {
    // Basic validation rules
    if (!ticker || ticker.length < 1 || ticker.length > 10) {
        return false;
    }

    // Allow letters, numbers, hyphens, dots
    const tickerRegex = /^[A-Z0-9\-\.]+$/;

    if (!tickerRegex.test(ticker)) {
        return false;
    }

    // Common valid patterns
    const validPatterns = [
        /^[A-Z]{1,5}$/, // Standard stocks (AAPL, GOOGL)
        /^[A-Z]{1,5}-USD$/, // Crypto (BTC-USD, ETH-USD)
        /^[A-Z]{1,5}\.[A-Z]{1,3}$/, // International (TSM.TO)
    ];

    return validPatterns.some(pattern => pattern.test(ticker));
}
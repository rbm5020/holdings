module.exports = function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { ticker } = req.query;

        if (!ticker) {
            return res.status(400).json({ error: 'Ticker required' });
        }

        // Simple validation - accept most reasonable tickers
        const isValid = /^[A-Z0-9\-\.]{1,10}$/i.test(ticker);

        return res.status(200).json({
            valid: isValid,
            ticker: ticker.toUpperCase()
        });

    } catch (error) {
        console.error('Validation Error:', error);
        return res.status(500).json({ error: 'Validation failed', details: error.message });
    }
};
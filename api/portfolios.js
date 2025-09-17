module.exports = function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'POST') {
            // Create portfolio
            return res.status(200).json({
                success: true,
                message: 'Portfolio created (mock)',
                viewUrl: 'https://myholdings.me/view/test123',
                editUrl: 'https://myholdings.me/edit/test123/secret456'
            });
        }

        if (req.method === 'GET') {
            // Get portfolio
            return res.status(200).json({
                success: true,
                portfolio: {
                    holdings: [
                        { ticker: 'AAPL', quantity: 10, currentPrice: 150, change: 2.5 }
                    ]
                }
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
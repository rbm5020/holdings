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
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Portfolio ID required' });
        }

        // Mock portfolio data for viewing - matches what viewer.html expects
        return res.status(200).json({
            holdings: [
                { ticker: 'AAPL', quantity: 10, currentPrice: 150, change: 2.5, category: 'Stocks' },
                { ticker: 'BTC-USD', quantity: 0.5, currentPrice: 45000, change: -500, category: 'Crypto' },
                { ticker: 'GOOGL', quantity: 5, currentPrice: 2800, change: 15, category: 'Stocks' }
            ],
            categories: { 'Stocks': 'color-stocks', 'Crypto': 'color-crypto' },
            categoryOrder: ['Stocks', 'Crypto']
        });

    } catch (error) {
        console.error('Portfolio viewing error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
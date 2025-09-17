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

            // Mock portfolio data for viewing - will replace with real data later
            return res.status(200).json({
                holdings: [
                    { ticker: 'AAPL', quantity: 10, currentPrice: 150, change: 2.5, category: 'Stocks' },
                    { ticker: 'BTC-USD', quantity: 0.5, currentPrice: 45000, change: -500, category: 'Crypto' }
                ],
                categories: { 'Stocks': 'color-stocks', 'Crypto': 'color-crypto' },
                categoryOrder: ['Stocks', 'Crypto']
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
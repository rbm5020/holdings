// Portfolio edit endpoint
// Use global storage shared with portfolios.js
if (!global.portfolios) {
    global.portfolios = new Map();
}

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { params } = req.query;
        const [portfolioId, editSecret] = params;

        if (!portfolioId || !editSecret) {
            return res.status(400).json({ error: 'Portfolio ID and edit secret required' });
        }

        const portfolio = global.portfolios.get(portfolioId);

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        if (portfolio.editSecret !== editSecret) {
            return res.status(403).json({ error: 'Invalid edit secret' });
        }

        // Check if expired
        if (new Date() > new Date(portfolio.expiresAt)) {
            global.portfolios.delete(portfolioId);
            return res.status(404).json({ error: 'Portfolio expired' });
        }

        if (req.method === 'GET') {
            // Load portfolio for editing
            return res.status(200).json({
                success: true,
                portfolio: {
                    holdings: portfolio.holdings,
                    categories: portfolio.categories,
                    categoryOrder: portfolio.categoryOrder,
                    duration: portfolio.duration
                }
            });

        } else if (req.method === 'PUT') {
            // Update portfolio
            const updateData = req.body;

            portfolio.holdings = updateData.holdings;
            portfolio.categories = updateData.categories;
            portfolio.categoryOrder = updateData.categoryOrder;
            portfolio.duration = updateData.duration;
            portfolio.email = updateData.email;
            portfolio.expiresAt = calculateExpirationDate(updateData.duration);

            global.portfolios.set(portfolioId, portfolio);

            // Generate URLs
            const baseUrl = `https://${req.headers.host}`;
            const viewUrl = `${baseUrl}/view/${portfolioId}`;
            const editUrl = `${baseUrl}/edit/${portfolioId}/${editSecret}`;

            return res.status(200).json({
                success: true,
                viewUrl,
                editUrl
            });

        } else if (req.method === 'DELETE') {
            // Delete portfolio
            global.portfolios.delete(portfolioId);

            return res.status(200).json({
                success: true,
                message: 'Portfolio deleted'
            });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Edit API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

function calculateExpirationDate(duration) {
    const now = new Date();

    switch (duration) {
        case '1 Day':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case '1 Week':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        case '1 Month':
            return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        case 'Forever':
        default:
            return new Date('2099-12-31');
    }
}
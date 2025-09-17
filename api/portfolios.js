import { nanoid } from 'nanoid';

// In-memory storage for now - will replace with database later
let portfolios = new Map();

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'POST') {
            // Create new portfolio
            const portfolioData = req.body;

            // Generate unique IDs
            const portfolioId = nanoid(10);
            const editSecret = nanoid(20);

            // Create portfolio object
            const portfolio = {
                id: portfolioId,
                editSecret,
                holdings: portfolioData.holdings,
                categories: portfolioData.categories,
                categoryOrder: portfolioData.categoryOrder,
                duration: portfolioData.duration,
                email: portfolioData.email,
                createdAt: new Date().toISOString(),
                expiresAt: calculateExpirationDate(portfolioData.duration)
            };

            // Store portfolio
            portfolios.set(portfolioId, portfolio);

            // Generate URLs
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
            // Get portfolio for viewing
            const { query } = req;
            const portfolioId = query.portfolioId;

            if (!portfolioId) {
                return res.status(400).json({ error: 'Portfolio ID required' });
            }

            const portfolio = portfolios.get(portfolioId);

            if (!portfolio) {
                return res.status(404).json({ error: 'Portfolio not found' });
            }

            // Check if expired
            if (new Date() > new Date(portfolio.expiresAt)) {
                portfolios.delete(portfolioId);
                return res.status(404).json({ error: 'Portfolio expired' });
            }

            // Fetch current prices for all holdings
            const holdingsWithPrices = await fetchCurrentPrices(portfolio.holdings);

            return res.status(200).json({
                success: true,
                portfolio: {
                    ...portfolio,
                    holdings: holdingsWithPrices
                }
            });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Portfolio API error:', error);
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
            return new Date('2099-12-31'); // Far future date
    }
}

async function fetchCurrentPrices(holdings) {
    // For now, return mock data - will implement real price fetching later
    return holdings.map(holding => ({
        ...holding,
        currentPrice: Math.random() * 1000 + 10, // Mock price
        change: (Math.random() - 0.5) * 20, // Mock daily change
        quantity: holding.quantity || 0
    }));
}
// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://demo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'demo-key';

async function getFromExternalDB(id) {
    try {
        if (!process.env.SUPABASE_URL) {
            console.log(`⚠️ No SUPABASE_URL configured - cannot retrieve portfolio ${id}`);
            return null;
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/portfolios?id=eq.${id}&select=data`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (response.ok) {
            const results = await response.json();
            if (results && results.length > 0) {
                console.log(`✅ Found portfolio ${id} in Supabase`);
                return results[0].data;
            }
        }

        console.log(`❌ Portfolio ${id} not found in Supabase`);
        return null;
    } catch (error) {
        console.log(`❌ Supabase get error for ${id}:`, error.message);
        return null;
    }
}

export default async function handler(req, res) {
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
        const { id: portfolioId, secret: editSecret } = req.query;

        if (!portfolioId || !editSecret) {
            return res.status(400).json({ error: 'Portfolio ID and edit secret required' });
        }

        // Load portfolio data with external DB priority
        if (!global.portfolios) {
            global.portfolios = new Map();
        }

        // Try in-memory first, then external DB
        let portfolio = global.portfolios.get(portfolioId);
        if (!portfolio) {
            console.log('🔍 Not in memory, checking external DB for:', portfolioId);
            portfolio = await getFromExternalDB(portfolioId);
            if (portfolio) {
                console.log('✅ Found in external DB:', portfolioId);
                global.portfolios.set(portfolioId, portfolio); // Cache it
            } else {
                console.log('❌ Not found in external DB:', portfolioId);
            }
        } else {
            console.log('📋 Found in memory:', portfolioId);
        }

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        // Verify edit secret
        if (portfolio.editSecret !== editSecret) {
            return res.status(403).json({ error: 'Invalid edit secret' });
        }

        // Return portfolio data for editing
        return res.status(200).json({
            success: true,
            portfolio: {
                id: portfolio.id,
                holdings: portfolio.holdings || [],
                categories: portfolio.categories || {},
                categoryOrder: portfolio.categoryOrder || [],
                duration: portfolio.duration || 'Forever',
                email: portfolio.email,
                createdAt: portfolio.createdAt
            }
        });

    } catch (error) {
        console.error('Edit API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
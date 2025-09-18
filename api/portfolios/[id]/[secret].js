// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://demo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'demo-key';

async function saveToExternalDB(id, portfolio) {
    try {
        if (!process.env.SUPABASE_URL) {
            console.log(`⚠️ No SUPABASE_URL configured - portfolio ${id} saved to memory only`);
            return true;
        }

        // Update existing portfolio in Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/portfolios?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                data: portfolio,
                created_at: new Date().toISOString()
            })
        });

        if (response.ok) {
            console.log(`✅ Portfolio ${id} updated in Supabase`);
            return true;
        } else {
            const error = await response.text();
            console.log(`❌ Supabase update failed for ${id}:`, response.status, error);
            return false;
        }
    } catch (error) {
        console.log(`❌ Supabase update error for ${id}:`, error.message);
        return false;
    }
}

async function deleteFromExternalDB(id) {
    try {
        if (!process.env.SUPABASE_URL) {
            console.log(`⚠️ No SUPABASE_URL configured - portfolio ${id} deleted from memory only`);
            return true;
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/portfolios?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (response.ok) {
            console.log(`✅ Portfolio ${id} deleted from Supabase`);
            return true;
        } else {
            const error = await response.text();
            console.log(`❌ Supabase delete failed for ${id}:`, response.status, error);
            return false;
        }
    } catch (error) {
        console.log(`❌ Supabase delete error for ${id}:`, error.message);
        return false;
    }
}

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
    res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { id: portfolioId, secret: editSecret } = req.query;

        if (!portfolioId || !editSecret) {
            return res.status(400).json({ error: 'Portfolio ID and edit secret required' });
        }

        // Load portfolio to verify it exists and secret is correct
        if (!global.portfolios) {
            global.portfolios = new Map();
        }

        let portfolio = global.portfolios.get(portfolioId);
        if (!portfolio) {
            portfolio = await getFromExternalDB(portfolioId);
            if (portfolio) {
                global.portfolios.set(portfolioId, portfolio);
            }
        }

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        if (portfolio.editSecret !== editSecret) {
            return res.status(403).json({ error: 'Invalid edit secret' });
        }

        if (req.method === 'PUT') {
            // Update portfolio
            const updateData = req.body;

            const updatedPortfolio = {
                ...portfolio,
                holdings: updateData.holdings || portfolio.holdings,
                categories: updateData.categories || portfolio.categories,
                categoryOrder: updateData.categoryOrder || portfolio.categoryOrder,
                duration: updateData.duration || portfolio.duration,
                email: updateData.email || portfolio.email,
                updatedAt: new Date().toISOString()
            };

            // Update in memory and external DB
            global.portfolios.set(portfolioId, updatedPortfolio);
            await saveToExternalDB(portfolioId, updatedPortfolio);

            const baseUrl = `https://${req.headers.host}`;
            const viewUrl = `${baseUrl}/view/${portfolioId}`;
            const editUrl = `${baseUrl}/edit/${portfolioId}/${editSecret}`;

            return res.status(200).json({
                success: true,
                viewUrl,
                editUrl,
                portfolioId
            });

        } else if (req.method === 'DELETE') {
            // Delete portfolio
            global.portfolios.delete(portfolioId);
            await deleteFromExternalDB(portfolioId);

            return res.status(200).json({
                success: true,
                message: 'Portfolio deleted successfully'
            });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Portfolio update/delete API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}
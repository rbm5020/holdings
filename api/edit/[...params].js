module.exports = function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        return res.status(200).json({
            success: true,
            message: 'Edit endpoint working (mock)',
            method: req.method,
            params: req.query.params
        });

    } catch (error) {
        console.error('Edit API Error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};
// This will be handled by the main portfolios.js for now
// Vercel dynamic routes will be implemented as we expand
export default function handler(req, res) {
    return res.status(404).json({ error: 'Use /api/portfolios with query params' });
}
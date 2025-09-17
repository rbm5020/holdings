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
        const { ticker } = req.query;

        if (!ticker) {
            return res.status(400).json({ error: 'Ticker required' });
        }

        // Real ticker validation against market data
        const tickerUpper = ticker.toUpperCase();
        const isValid = await validateAgainstMarketData(tickerUpper);

        return res.status(200).json({
            valid: isValid,
            ticker: tickerUpper
        });

    } catch (error) {
        console.error('Ticker validation error:', error);
        return res.status(500).json({ error: 'Validation failed' });
    }
}

async function validateAgainstMarketData(ticker) {
    try {
        // Use Yahoo Finance search API to validate any ticker
        const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}`;

        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Check if ticker exists in search results
        if (data.quotes && data.quotes.length > 0) {
            // Look for exact symbol match
            const exactMatch = data.quotes.find(quote =>
                quote.symbol && quote.symbol.toUpperCase() === ticker.toUpperCase()
            );

            if (exactMatch) {
                return true;
            }

            // If no exact match, check if any result is close enough
            const closeMatch = data.quotes.find(quote => {
                if (!quote.symbol) return false;
                const symbol = quote.symbol.toUpperCase();
                const tickerUpper = ticker.toUpperCase();

                // Handle common variations
                return symbol === tickerUpper ||
                       symbol === tickerUpper + '.TO' || // Canadian stocks
                       symbol === tickerUpper + '.L' ||  // London stocks
                       symbol.replace(/[\.\-].*$/, '') === tickerUpper; // Strip suffixes
            });

            return !!closeMatch;
        }

        return false;

    } catch (error) {
        console.error('Yahoo Finance validation error:', error);

        // Fallback: Accept reasonable format if API fails
        return /^[A-Z]{1,8}(-USD|\.TO|\.L)?$/i.test(ticker);
    }
}
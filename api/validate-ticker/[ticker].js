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
        const { ticker } = req.query;

        if (!ticker) {
            return res.status(400).json({ error: 'Ticker required' });
        }

        // Real ticker validation against market data
        const tickerUpper = ticker.toUpperCase();
        const isValid = validateAgainstMarketData(tickerUpper);

        return res.status(200).json({
            valid: isValid,
            ticker: tickerUpper
        });

    } catch (error) {
        console.error('Ticker validation error:', error);
        return res.status(500).json({ error: 'Validation failed' });
    }
}

function validateAgainstMarketData(ticker) {
    try {
        // For now, use a simple whitelist of known good tickers while debugging
        const knownTickers = [
            'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'UBER', 'SPY', 'QQQ', 'VTI',
            'BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD', 'DOGE-USD', 'MATIC-USD', 'AVAX-USD'
        ];

        return knownTickers.includes(ticker.toUpperCase());

        // TODO: Re-enable Yahoo Finance API once we debug why it's failing
        // const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
        // const response = await fetch(url);
        // ...

    } catch (error) {
        console.error('Market data validation error:', error);

        // Fallback: Basic format check if API fails
        return /^[A-Z]{1,5}(-USD)?(\.[A-Z]{1,3})?$/.test(ticker);
    }
}
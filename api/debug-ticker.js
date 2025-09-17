export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const ticker = req.query.ticker || 'AAPL';

        const knownTickers = [
            'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'UBER', 'SPY', 'QQQ', 'VTI',
            'BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD', 'DOGE-USD', 'MATIC-USD', 'AVAX-USD'
        ];

        const tickerUpper = ticker.toUpperCase();
        const isValid = knownTickers.includes(tickerUpper);

        return res.status(200).json({
            ticker: ticker,
            tickerUpper: tickerUpper,
            isValid: isValid,
            knownTickers: knownTickers,
            includes: knownTickers.includes(tickerUpper)
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
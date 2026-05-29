// api/create-payment.js
// Creates a pending payment order and returns wallet address + amount

const PLANS = {
  '1H': { usd: 2,  seconds: 3600,     label: '1 Hour' },
  '1D': { usd: 5,  seconds: 86400,    label: '1 Day' },
  '1W': { usd: 8,  seconds: 604800,   label: '1 Week' },
  '1M': { usd: 12, seconds: 2592000,  label: '1 Month' },
  'LT': { usd: 20, seconds: null,     label: 'Lifetime' },
};

const WALLETS = {
  BTC: 'bc1qqc6ctmdjlwznwz6r66nrxluz66ud98r7j3727u',
  ETH: '0xbe3b29B1D4f7Bf789F7dF8531eb2464AE1A3C809',
  LTC: 'LeMysHcWkDpfg57EztkHGXBjoy1cuKDmZL',
  SOL: '745sQDPstBRAGBn37aDpdfdE9SbZskChgHkkUZovbZSY',
};

// Fetch live crypto price from CoinGecko (free, no API key)
async function getPrice(coin) {
  const ids = { BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', SOL: 'solana' };
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids[coin]}&vs_currencies=usd`);
  const data = await res.json();
  return data[ids[coin]].usd;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan, coin } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    if (!WALLETS[coin]) return res.status(400).json({ error: 'Invalid coin' });

    const priceUSD = await getPrice(coin);
    const amountCrypto = (PLANS[plan].usd / priceUSD).toFixed(8);
    const orderId = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

    // Store order in Vercel KV or just return — client will poll check-payment
    const order = {
      orderId,
      plan,
      coin,
      wallet: WALLETS[coin],
      amount: amountCrypto,
      amountUSD: PLANS[plan].usd,
      label: PLANS[plan].label,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 min to pay
    };

    return res.status(200).json({ success: true, order });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

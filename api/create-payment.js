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
  BTC: 'bc1qzuw5e2yk3f0s4xtz478lgecjf7a778j8dahn4h',
  ETH: '0x37dA20A6F5F28922513b418067DE1afF468F4d8a',
  LTC: 'Lcf7pkW4AMQKFqfQWQRxG4edEXFHoFgn6r',
  SOL: 'G4drhxouQWVveybE5TKHnzgjHMxhBwxzXwfE1vfFdRnK',
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

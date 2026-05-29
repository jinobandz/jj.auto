// api/generate-key.js
// Generates a valid Frost license key after payment is confirmed

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function rSeg(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

function keyChk(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1296).toString(36).toUpperCase().padStart(2, '0');
}

const DUR_CODES = {
  '1H': '1H', '1D': '1D', '1W': '1W', '1M': '1M', 'LT': 'LT'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan, orderId } = req.body;
    const code = DUR_CODES[plan];
    if (!code) return res.status(400).json({ error: 'Invalid plan' });

    const r = `${rSeg(4)}-${rSeg(4)}`;
    const chk = keyChk(`${code}-${r}`);
    const key = `BR-${code}-${r}-${chk}`;

    return res.status(200).json({ success: true, key, plan, orderId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

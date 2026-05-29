// api/check-payment.js
// Checks blockchain to see if exact payment was received

async function checkBTC(address, expectedAmount, since) {
  try {
    const res = await fetch(`https://blockchair.com/bitcoin/dashboards/address/${address}?limit=5`);
    const data = await res.json();
    const txs = data.data?.[address]?.transactions || [];
    // Check recent transactions
    const received = data.data?.[address]?.address?.received || 0;
    const lastTxTime = data.data?.[address]?.address?.last_seen_receiving;
    if (!lastTxTime) return false;
    const lastTxMs = new Date(lastTxTime).getTime();
    if (lastTxMs < since) return false;
    // Check UTXOs for the exact amount
    const utxos = data.data?.[address]?.utxo || [];
    const expected = Math.round(parseFloat(expectedAmount) * 1e8); // satoshis
    return utxos.some(u => u.value >= expected * 0.99); // 1% tolerance
  } catch { return false; }
}

async function checkETH(address, expectedAmount, since) {
  try {
    const res = await fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=YourApiKeyToken`);
    const data = await res.json();
    const txs = (data.result || []).filter(tx => {
      const txTime = parseInt(tx.timeStamp) * 1000;
      return txTime >= since && tx.to?.toLowerCase() === address.toLowerCase();
    });
    const expected = parseFloat(expectedAmount) * 1e18;
    return txs.some(tx => parseInt(tx.value) >= expected * 0.99);
  } catch { return false; }
}

async function checkLTC(address, expectedAmount, since) {
  try {
    const res = await fetch(`https://blockchair.com/litecoin/dashboards/address/${address}?limit=5`);
    const data = await res.json();
    const lastTxTime = data.data?.[address]?.address?.last_seen_receiving;
    if (!lastTxTime) return false;
    const lastTxMs = new Date(lastTxTime).getTime();
    if (lastTxMs < since) return false;
    const utxos = data.data?.[address]?.utxo || [];
    const expected = Math.round(parseFloat(expectedAmount) * 1e8);
    return utxos.some(u => u.value >= expected * 0.99);
  } catch { return false; }
}

async function checkSOL(address, expectedAmount, since) {
  try {
    const res = await fetch(`https://api.mainnet-beta.solana.com`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 10 }]
      })
    });
    const data = await res.json();
    const sigs = data.result || [];
    const recent = sigs.filter(s => s.blockTime && s.blockTime * 1000 >= since);
    if (!recent.length) return false;

    // Check each recent tx for the expected amount
    for (const sig of recent) {
      const txRes = await fetch(`https://api.mainnet-beta.solana.com`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getTransaction',
          params: [sig.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }]
        })
      });
      const txData = await txRes.json();
      const meta = txData.result?.meta;
      if (!meta) continue;
      const accounts = txData.result?.transaction?.message?.accountKeys || [];
      const addrIdx = accounts.findIndex(a => a === address);
      if (addrIdx === -1) continue;
      const diff = (meta.postBalances[addrIdx] - meta.preBalances[addrIdx]) / 1e9;
      const expected = parseFloat(expectedAmount);
      if (diff >= expected * 0.99) return true;
    }
    return false;
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { coin, wallet, amount, since } = req.body;
    let confirmed = false;

    if (coin === 'BTC') confirmed = await checkBTC(wallet, amount, since);
    else if (coin === 'ETH') confirmed = await checkETH(wallet, amount, since);
    else if (coin === 'LTC') confirmed = await checkLTC(wallet, amount, since);
    else if (coin === 'SOL') confirmed = await checkSOL(wallet, amount, since);

    return res.status(200).json({ confirmed });
  } catch (e) {
    return res.status(500).json({ error: e.message, confirmed: false });
  }
}

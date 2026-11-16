// The Vault Tracker app sends its data here (POST) so Claude can read it. GET checks the connection.
const store = require('./_lib/store');
const auth = require('./_lib/auth');

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };

module.exports = async (req, res) => {
  auth.cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (auth.secret().length < 12) return send(res, 503, { ok: false, error: 'The website has no secret yet. In Vercel, add LEDGER_SECRET (at least 12 characters) and redeploy.' });
  if (!auth.appAllowed(req)) return send(res, 401, { ok: false, error: 'Wrong secret. Type the same secret you saved as LEDGER_SECRET in Vercel.' });
  if (!store.hasDb()) return send(res, 503, { ok: false, error: 'No database yet. In Vercel, open Storage and connect an Upstash Redis database, then redeploy.' });
  try {
    if (req.method === 'GET') {
      const snap = await store.load();
      return send(res, 200, { ok: true, savedAt: snap ? snap.savedAt : null, claudeCode: auth.mcpCode(auth.secret()) });
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST.' });
    const body = await readBody(req);
    const d = body && body.data;
    if (!d || !Array.isArray(d.expenses) || !Array.isArray(d.people)) return send(res, 400, { ok: false, error: 'No ledger data in the request.' });
    if (JSON.stringify(d).length > 4_000_000) return send(res, 413, { ok: false, error: 'Data too large.' });
    const savedAt = Date.now();
    await store.save({ savedAt, appVersion: String(body.appVersion || ''), data: d });
    return send(res, 200, { ok: true, savedAt, claudeCode: auth.mcpCode(auth.secret()) });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
};

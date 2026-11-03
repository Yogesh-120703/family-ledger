// MCP server for Claude (Streamable HTTP, stateless, JSON responses). Address: https://<site>/mcp/<code>
// The code comes from LEDGER_SECRET; the Family Ledger app shows the full address after it connects.
const store = require('./_lib/store');
const auth = require('./_lib/auth');
const { TOOLS, call } = require('./_lib/tools');
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || 'null') : req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
}
const json = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } });

async function handle(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg && msg.id, -32600, 'Invalid request');
  const { id, method, params } = msg;
  if (id === undefined || id === null) return null; // notification, e.g. notifications/initialized
  if (method === 'initialize') {
    const want = params && params.protocolVersion;
    return ok(id, { protocolVersion: VERSIONS.includes(want) ? want : VERSIONS[0], capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'family-ledger', title: 'Family Ledger', version: '1.0.0' },
      instructions: 'Read-only access to one family\'s Family Ledger: income, expenses (Necessary / Lifestyle), savings and monthly reports. Amounts are Indian rupees (₹). Months are YYYY-MM. Data is as last sent from the phone app (see dataSentFromPhone).' });
  }
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })) });
  if (method === 'tools/call') {
    const snap = await store.load();
    if (!snap) return ok(id, { isError: true, content: [{ type: 'text', text: 'No data yet. Open Family Ledger on the phone, go to Settings → Online copy for Claude, and tap Send now.' }] });
    try {
      const out = call(snap, params && params.name, params && params.arguments);
      return ok(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }], structuredContent: out });
    } catch (e) { return ok(id, { isError: true, content: [{ type: 'text', text: e.message }] }); }
  }
  if (method === 'resources/list') return ok(id, { resources: [] });
  if (method === 'prompts/list') return ok(id, { prompts: [] });
  return fail(id, -32601, 'Method not found: ' + method);
}

module.exports = async (req, res) => {
  auth.cors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const code = (req.query && req.query.code) || new URL(req.url, 'http://x').searchParams.get('code');
  if (!auth.claudeAllowed(code)) return json(res, 404, { error: 'Not found' });
  if (req.method === 'GET') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end(); }
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' });
  let body; try { body = await readBody(req); } catch (e) { return json(res, 400, fail(null, -32700, 'Parse error')); }
  try {
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map(handle))).filter(Boolean);
      if (!out.length) { res.statusCode = 202; return res.end(); }
      return json(res, 200, out);
    }
    const out = await handle(body);
    if (!out) { res.statusCode = 202; return res.end(); }
    return json(res, 200, out);
  } catch (e) { return json(res, 500, fail(body && body.id, -32603, e.message)); }
};

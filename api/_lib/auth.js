// One secret (LEDGER_SECRET in Vercel) protects everything.
// The app sends it to save the online copy. Claude's address uses a code made from it, so the secret itself is never in a link.
const crypto = require('crypto');
const secret = () => (process.env.LEDGER_SECRET || '').trim();
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const mcpCode = s => crypto.createHash('sha256').update('family-ledger-mcp:' + s).digest('hex').slice(0, 32);
function appAllowed(req) {
  const s = secret(); if (s.length < 12) return false;
  const h = req.headers.authorization || ''; return h.startsWith('Bearer ') && same(h.slice(7).trim(), s);
}
function claudeAllowed(code) { const s = secret(); return s.length >= 12 && !!code && same(code, mcpCode(s)); }
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version');
}
module.exports = { appAllowed, claudeAllowed, mcpCode, secret, cors };

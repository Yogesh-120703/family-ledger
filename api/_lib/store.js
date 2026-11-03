// Where the online copy is kept: an Upstash Redis database added from the Vercel "Storage" tab.
// Vercel fills in the address and token by itself (KV_REST_API_* or UPSTASH_REDIS_REST_*).
const KEY = 'family-ledger:snapshot';
let memory = null; // used only by the local tests

function conf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}
async function redis(cmd) {
  const c = conf();
  if (!c) throw new Error('No database connected. In Vercel, open Storage and connect an Upstash Redis database.');
  const r = await fetch(c.url, { method: 'POST', headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error('Database error: ' + j.error);
  return j.result;
}
async function save(snapshot) {
  const text = JSON.stringify(snapshot);
  if (process.env.LEDGER_TEST_MEMORY) { memory = text; return; }
  await redis(['SET', KEY, text]);
}
async function load() {
  const text = process.env.LEDGER_TEST_MEMORY ? memory : await redis(['GET', KEY]);
  return text ? JSON.parse(text) : null;
}
module.exports = { save, load, hasDb: () => !!conf() || !!process.env.LEDGER_TEST_MEMORY };

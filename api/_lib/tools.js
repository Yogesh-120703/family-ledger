// Read-only questions Claude can ask about the family's money. Nothing here can change or delete data.
const L = require('../../core.js');

const MONTH_RX = /^(\d{4})-(\d{2})$/;
function nowIST() { return new Date(Date.now() + 5.5 * 3600e3); }
function ym(month) {
  if (month && MONTH_RX.test(month)) { const [, y, m] = month.match(MONTH_RX); return { y: +y, m: +m - 1 }; }
  if (month) throw new Error('Use a month like "2026-10".');
  const d = nowIST(); return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}
const label = (y, m) => L.FULL[m] + ' ' + y;
const r2 = n => Math.round(n * 100) / 100;
const back = (y, m, k) => { const i = y * 12 + m - k; return { y: Math.floor(i / 12), m: i % 12 }; };
const like = (a, b) => String(a || '').toLowerCase().includes(String(b || '').toLowerCase().trim());
const KIND = { need: 'Necessary', life: 'Lifestyle', uns: 'Not sorted yet', save: 'Savings' };

function findCats(S, name) {
  const all = S.cats.filter(c => !c.archived || S.expenses.some(e => e.catId === c.id));
  const exact = all.filter(c => L.same(c.name, name));
  return exact.length ? exact : all.filter(c => like(c.name, name));
}
function row(S, e) {
  return { date: e.date, name: e.name, amount: e.amount, type: KIND[e.type] || e.type, category: e.type === 'uns' ? 'Needs a category' : L.catName(S, e.catId),
    subcategory: L.subName(S, e.catId, e.subId) || undefined, paidBy: L.personName(S, e.paidBy, e.paidName), paidWith: e.mode || undefined, paidTo: e.payee || undefined, note: e.note || undefined };
}

const TOOLS = [
  { name: 'monthly_summary', description: 'Income, total spending (Necessary, Lifestyle, not sorted), money left, recorded savings, the top spending categories, the change from the previous month, and the app\'s suggestions for one month. Amounts are Indian rupees.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'Month as YYYY-MM, e.g. 2026-10. Leave out for the current month.' } } },
    run(S, a) {
      const { y, m } = ym(a.month), r = L.monthReport(S, y, m);
      return { month: label(y, m), income: r.income, incomeRecorded: r.hasIncome, spent: r.expenses, necessary: r.need, lifestyle: r.life, notSortedYet: r.uns,
        leftAfterSpending: r.left, keptPercentOfIncome: r.leftPct, recordedSavings: r.saved, numberOfExpenses: r.nExp,
        topCategories: r.cats.slice(0, 8).map(c => ({ category: c.type === 'uns' ? 'Needs a category' : c.name, type: KIND[c.type], amount: c.v })),
        previousMonth: { month: label(r.py, r.pm), income: r.prev.income, spent: r.prev.expenses, left: r.prev.left },
        suggestions: L.insights(S, y, m).map(t => t.text) };
    } },
  { name: 'list_expenses', description: 'List individual expenses for a month, newest first. Can filter by category, person who paid, payment mode (Cash, UPI, Card…) or who was paid.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM; leave out for the current month.' }, category: { type: 'string' }, paidBy: { type: 'string', description: 'Family member name' },
      paidWith: { type: 'string', description: 'Cash, UPI, Card, Bank transfer or Other' }, paidTo: { type: 'string', description: 'Person or shop paid by UPI' }, limit: { type: 'integer', minimum: 1, maximum: 300 } } },
    run(S, a) {
      const { y, m } = ym(a.month);
      let list = L.inMonth(S.expenses, y, m);
      if (a.category) { const ids = findCats(S, a.category).map(c => c.id); list = list.filter(e => ids.includes(e.catId)); }
      if (a.paidBy) list = list.filter(e => like(L.personName(S, e.paidBy, e.paidName), a.paidBy));
      if (a.paidWith) list = list.filter(e => like(e.mode, a.paidWith));
      if (a.paidTo) list = list.filter(e => like(e.payee, a.paidTo) || like(e.name, a.paidTo));
      list.sort((p, q) => q.date.localeCompare(p.date) || (q.created || 0) - (p.created || 0));
      const lim = Math.min(a.limit || 100, 300);
      return { month: label(y, m), count: list.length, total: r2(list.reduce((s, e) => s + e.amount, 0)), expenses: list.slice(0, lim).map(e => row(S, e)), more: Math.max(0, list.length - lim) };
    } },
  { name: 'category_trend', description: 'How much was spent in one category in each of the last few months, e.g. Groceries over 6 months.',
    inputSchema: { type: 'object', required: ['category'], properties: { category: { type: 'string' }, months: { type: 'integer', minimum: 1, maximum: 24, description: 'How many months back (default 6)' }, endMonth: { type: 'string', description: 'YYYY-MM, default current month' } } },
    run(S, a) {
      const cats = findCats(S, a.category); if (!cats.length) return { error: 'No category matches "' + a.category + '".', categories: S.cats.filter(c => !c.archived).map(c => c.name) };
      const ids = cats.map(c => c.id), { y, m } = ym(a.endMonth), n = a.months || 6, out = [];
      for (let k = n - 1; k >= 0; k--) { const p = back(y, m, k); out.push({ month: label(p.y, p.m), amount: r2(L.inMonth(S.expenses.concat(S.savings), p.y, p.m).filter(e => ids.includes(e.catId)).reduce((s, e) => s + e.amount, 0)) }); }
      return { category: cats.map(c => c.name).join(', '), months: out, total: r2(out.reduce((s, x) => s + x.amount, 0)) };
    } },
  { name: 'year_summary', description: 'Month-by-month income, spending, savings and money left for a whole year, with year totals.',
    inputSchema: { type: 'object', properties: { year: { type: 'integer', description: 'e.g. 2026; leave out for this year' } } },
    run(S, a) {
      const y = a.year || nowIST().getUTCFullYear(), s = L.yearSeries(S, y), t = L.yearTotals(S, y);
      return { year: y, months: s.map((x, i) => ({ month: L.FULL[i], income: x.income, spent: x.total, necessary: x.need, lifestyle: x.life, savings: x.save, balance: x.bal })).filter(x => x.income || x.spent || x.savings),
        totals: { income: t.income, spent: t.total, necessary: t.need, lifestyle: t.life, savings: t.save, balance: t.bal } };
    } },
  { name: 'payments_to', description: 'All UPI or other payments made to one person or shop (by name), over the last months, with the total.',
    inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, months: { type: 'integer', minimum: 1, maximum: 36, description: 'default 12' } } },
    run(S, a) {
      const { y, m } = ym(), from = back(y, m, (a.months || 12) - 1), start = L.mk(from.y, from.m);
      const list = S.expenses.filter(e => e.date.slice(0, 7) >= start && (like(e.payee, a.name) || like(e.name, a.name) || (e.alias || []).some(x => like(x, a.name)))).sort((p, q) => q.date.localeCompare(p.date));
      return { name: a.name, count: list.length, total: r2(list.reduce((s, e) => s + e.amount, 0)), payments: list.slice(0, 200).map(e => row(S, e)) };
    } },
  { name: 'family_income', description: 'Income recorded for each family member in a month.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM; leave out for the current month.' } } },
    run(S, a) {
      const { y, m } = ym(a.month), rec = S.records[L.mk(y, m)] || {};
      const people = S.people.filter(p => !p.archived || rec[p.id]).map(p => { const e = rec[p.id]; return { person: p.name, amount: e && !e.none ? L.amt(e) : 0, note: e ? (e.none ? 'No income this month' + (e.note ? ' (' + e.note + ')' : '') : e.note || undefined) : 'Not entered' }; });
      return { month: label(y, m), total: L.incomeMonth(S, y, m), people };
    } },
  { name: 'list_categories', description: 'All spending and savings categories in the app, grouped as Necessary, Lifestyle and Savings, plus family members.',
    inputSchema: { type: 'object', properties: {} },
    run(S) {
      const g = k => S.cats.filter(c => c.kind === k && !c.archived).map(c => c.name);
      return { necessary: g('need'), lifestyle: g('life'), savings: g('save'), familyMembers: S.people.filter(p => !p.archived).map(p => p.name) };
    } }
];
TOOLS.forEach(t => { t.annotations = { readOnlyHint: true, openWorldHint: false, title: t.name.replace(/_/g, ' ') }; });

function call(snapshot, name, args) {
  const t = TOOLS.find(x => x.name === name); if (!t) throw new Error('Unknown tool: ' + name);
  const S = L.migrate(snapshot.data);
  const result = t.run(S, args || {});
  result.dataSentFromPhone = new Date(snapshot.savedAt).toISOString();
  return result;
}
module.exports = { TOOLS, call };

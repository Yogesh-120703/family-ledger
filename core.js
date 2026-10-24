/* Family Income Ledger — core data and calculations.
   No DOM code here, so it can be tested in Node and reused by any UI. */
(function (L) {
  'use strict';

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const KINDS = { need: 'Necessary', life: 'Lifestyle', uns: 'Not sorted', save: 'Savings' }; // uns = auto-added UPI payment waiting for a category
  const COLORS = ['#5C9EEA','#F09A4E','#3FC1A5','#D77BB0','#9A86F0','#E3C14D','#56C2D6','#EF7E70','#93B85A','#B99A84'];

  const DEFAULT_CATS = {
    need: ['House Rent','Groceries','Electricity Bill','Water Bill','Gas Cylinder','Milk and Dairy','Internet and Wi-Fi','Mobile Recharge','Transportation','Education','Medical Expenses','Loan and EMI','Household Supplies','Insurance','Domestic Help','Other Essentials'],
    life: ['Cinema and Theatre','Restaurant and Hotel Food','Online Food Orders','Shopping','Entertainment','Trips and Travel','Subscriptions','Snacks and Drinks','Other Lifestyle Expenses'],
    save: ['General Savings','Emergency Fund','Bank Savings','Fixed Deposit','Recurring Deposit','Education Savings','Future Purchases','Other Savings']
  };
  const DEFAULT_SUBS = { 'need|Education': ['College Fees','Bus Fees','Exam Fees','Books'] };

  // Category names used by the web version, mapped to the new default names.
  const OLD_NAMES = {
    'Rent': 'House Rent', 'Electricity': 'Electricity Bill', 'Water': 'Water Bill', 'Gas': 'Gas Cylinder',
    'Medical': 'Medical Expenses', 'Other essentials': 'Other Essentials',
    'Cinema & theatre': 'Cinema and Theatre', 'Restaurant & hotel food': 'Restaurant and Hotel Food',
    'Online food orders': 'Online Food Orders', 'Trips': 'Trips and Travel',
    'Other personal spending': 'Other Lifestyle Expenses'
  };

  let seq = 0;
  function uid(p) { seq = (seq + 1) % 1e6; return p + '_' + Date.now().toString(36) + seq.toString(36) + Math.random().toString(36).slice(2, 6); }
  const pad = n => String(n).padStart(2, '0');
  const mk = (y, m) => y + '-' + pad(m + 1);
  const norm = s => String(s || '').trim().replace(/\s+/g, ' ');
  const same = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();

  function makeCats() {
    const out = [];
    Object.keys(DEFAULT_CATS).forEach(kind => DEFAULT_CATS[kind].forEach(name => {
      out.push({ id: uid('c'), kind, name, archived: false,
        subs: (DEFAULT_SUBS[kind + '|' + name] || []).map(s => ({ id: uid('s'), name: s, archived: false })) });
    }));
    return out;
  }

  function defaultUpi() { const sources = {}; Object.keys(UPI_SOURCES).forEach(k => { sources[k] = UPI_SOURCES[k].on; }); return { enabled: false, auto: true, sources, queue: [], seen: {}, skipped: [], payeeCat: {} }; }
  function fresh() {
    return {
      v: 2,
      people: [1, 2, 3, 4].map((n, i) => ({ id: 'p' + n, name: 'Person ' + n, color: COLORS[i], archived: false })),
      records: {},          // income: { 'YYYY-MM': { personId: {amount, note} | {none:true, note} } }
      expenses: [],         // {id,name,amount,date,type:'need'|'life',catId,subId,paidBy,note,created}
      savings: [],          // {id,name,amount,date,catId,subId,by,note,created}
      cats: makeCats(),
      recurring: [],
      upi: defaultUpi(),
      limits: { enabled: false, items: [] }, // item: {id, scope:'total'|'need'|'life'|'cat', catId, amount, month:'YYYY-MM'|'*', on}
      alertSeen: {},
      limitLog: [],
      notify: false,
      log: [{ t: Date.now(), msg: 'Family Income Ledger app set up with Person 1–4' }]
    };
  }

  function ensureCat(S, kind, name) {
    const n = OLD_NAMES[norm(name)] || norm(name) || (kind === 'need' ? 'Other Essentials' : kind === 'life' ? 'Other Lifestyle Expenses' : 'Other Savings');
    let c = S.cats.find(x => x.kind === kind && same(x.name, n));
    if (!c) { c = { id: uid('c'), kind, name: n, archived: false, subs: [] }; S.cats.push(c); }
    return c;
  }

  /* Accepts the web version's data (v1), an app backup (v2) or nothing. Never drops records. */
  function migrate(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.people)) return fresh();
    const S = JSON.parse(JSON.stringify(raw));
    S.records = S.records && typeof S.records === 'object' ? S.records : {};
    S.log = Array.isArray(S.log) ? S.log : [];
    if (S.v !== 2) {
      S.cats = makeCats();
      S.expenses = (Array.isArray(S.expenses) ? S.expenses : []).map(e => {
        const type = e.type === 'life' ? 'life' : 'need';
        const c = ensureCat(S, type, e.cat);
        const out = { id: e.id || uid('x'), name: norm(e.name) || c.name, amount: +e.amount || 0, date: e.date, type,
          catId: c.id, subId: null, paidBy: e.paidBy || null, note: e.note || '', created: e.created || Date.now() };
        if (e.paidName) out.paidName = e.paidName;
        return out;
      }).filter(e => e.amount > 0 && validDate(e.date));
      S.savings = [];
      S.limits = { enabled: false, items: [] };
      S.alertSeen = {}; S.limitLog = []; S.notify = false;
      delete S.sample;
      S.v = 2;
      S.log.unshift({ t: Date.now(), msg: 'Data moved from the web version' });
    }
    S.expenses = Array.isArray(S.expenses) ? S.expenses : [];
    S.savings = Array.isArray(S.savings) ? S.savings : [];
    S.cats = Array.isArray(S.cats) && S.cats.length ? S.cats : makeCats();
    S.cats.forEach(c => { c.subs = Array.isArray(c.subs) ? c.subs : []; });
    S.limits = S.limits && Array.isArray(S.limits.items) ? S.limits : { enabled: false, items: [] };
    S.upi = Object.assign(defaultUpi(), S.upi || {}); S.upi.sources = Object.assign(defaultUpi().sources, S.upi.sources || {});
    ['queue', 'skipped'].forEach(k => { if (!Array.isArray(S.upi[k])) S.upi[k] = []; }); S.upi.seen = S.upi.seen || {}; S.upi.payeeCat = S.upi.payeeCat || {};
    S.recurring = Array.isArray(S.recurring) ? S.recurring : [];
    S.recurring.forEach(r => { r.done = r.done || {}; });
    S.alertSeen = S.alertSeen || {};
    S.limitLog = Array.isArray(S.limitLog) ? S.limitLog : [];
    S.people.forEach((p, i) => { if (!p.color) p.color = COLORS[i % COLORS.length]; });
    return S;
  }

  /* ---------- validation ---------- */
  function parseMoney(raw) {
    const s = String(raw == null ? '' : raw).replace(/[₹,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const n = Math.round(parseFloat(s) * 100) / 100;
    return n > 0 && n < 1e10 ? n : null;
  }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2100;
  }

  /* ---------- lookups ---------- */
  const cat = (S, id) => S.cats.find(c => c.id === id);
  const catName = (S, id) => (cat(S, id) || {}).name || 'Needs a category';
  function subName(S, catId, subId) { const c = cat(S, catId); const s = c && c.subs.find(x => x.id === subId); return s ? s.name : ''; }
  const person = (S, id) => S.people.find(p => p.id === id);
  function personName(S, id, fallback) { const p = person(S, id); return p ? p.name : (fallback || 'Former member'); }
  function catUses(S, catId) { return S.expenses.filter(e => e.catId === catId).length + S.savings.filter(e => e.catId === catId).length; }
  function subUses(S, subId) { return S.expenses.filter(e => e.subId === subId).length + S.savings.filter(e => e.subId === subId).length; }

  /* ---------- totals ---------- */
  const amt = e => (e && !e.none && typeof e.amount === 'number' ? e.amount : 0);
  function incomeMonth(S, y, m) { const r = S.records[mk(y, m)] || {}; return Object.values(r).reduce((a, e) => a + amt(e), 0); }
  function hasIncome(S, y, m) { const r = S.records[mk(y, m)]; return !!r && Object.keys(r).length > 0; }
  const inMonth = (list, y, m) => { const k = mk(y, m); return list.filter(e => e.date.slice(0, 7) === k); };
  const inYear = (list, y) => list.filter(e => e.date.slice(0, 4) === String(y));
  const sum = (list, type) => round2(list.reduce((a, e) => a + (!type || e.type === type ? e.amount : 0), 0));
  function round2(n) { return Math.round(n * 100) / 100; }

  function totals(S, y, m) {
    const ex = inMonth(S.expenses, y, m), sv = inMonth(S.savings, y, m);
    const income = incomeMonth(S, y, m), need = sum(ex, 'need'), life = sum(ex, 'life'), uns = sum(ex, 'uns'), save = sum(sv);
    const total = round2(need + life + uns); // not-sorted payments are real spending, so they count in the total
    return { income, hasIncome: hasIncome(S, y, m), need, life, uns, nUns: ex.filter(e => e.type === 'uns').length, total, save, bal: round2(income - total - save),
      nExp: ex.length, nSave: sv.length, empty: !hasIncome(S, y, m) && !ex.length && !sv.length };
  }
  function yearSeries(S, y) { return MONTHS.map((_, i) => totals(S, y, i)); }
  function yearTotals(S, y) {
    const s = yearSeries(S, y);
    const t = s.reduce((a, x) => { a.income += x.income; a.need += x.need; a.life += x.life; a.uns += x.uns; a.save += x.save; return a; }, { income: 0, need: 0, life: 0, uns: 0, save: 0 });
    t.total = round2(t.need + t.life + t.uns); t.bal = round2(t.income - t.total - t.save);
    t.monthsWithIncome = s.filter(x => x.hasIncome).length;
    return t;
  }
  function byCat(S, list) {
    const map = {};
    list.forEach(e => { const k = e.catId || 'none'; map[k] = map[k] || { catId: e.catId, name: catName(S, e.catId), type: e.type || 'save', v: 0 }; map[k].v = round2(map[k].v + e.amount); });
    return Object.values(map).sort((a, b) => b.v - a.v);
  }

  /* ---------- duplicates ---------- */
  // Exact twin (same name, amount, date, category) saved in the last 10 seconds = double tap; ignore silently.
  // Older exact twin = possible duplicate; the UI asks before saving.
  function findTwin(list, rec, exceptId) {
    return list.find(e => e.id !== exceptId && e.date === rec.date && e.amount === rec.amount && e.catId === rec.catId && same(e.name, rec.name));
  }
  function isDoubleTap(twin, now) { return !!twin && (now || Date.now()) - (twin.created || 0) < 10000; }

  /* ---------- spending limits ---------- */
  const LEVEL = { ok: 0, near: 1, reached: 2, over: 3 };
  function limitLabel(S, it) {
    return it.scope === 'total' ? 'Total monthly expenses' : it.scope === 'need' ? 'Necessary expenses' : it.scope === 'life' ? 'Lifestyle expenses' : catName(S, it.catId);
  }
  // For each scope/category, a limit set for a specific month wins over an "every month" limit.
  function effectiveLimits(S, y, m) {
    const key = mk(y, m), pick = {};
    S.limits.items.forEach(it => {
      if (it.month !== '*' && it.month !== key) return;
      const k = it.scope + '|' + (it.catId || '');
      if (!pick[k] || (pick[k].month === '*' && it.month !== '*')) pick[k] = it;
    });
    return Object.values(pick).filter(it => it.on !== false);
  }
  function limitStatus(S, y, m) {
    if (!S.limits.enabled) return [];
    const ex = inMonth(S.expenses, y, m);
    return effectiveLimits(S, y, m).map(it => {
      const spent = it.scope === 'total' ? sum(ex) : it.scope === 'cat' ? sum(ex.filter(e => e.catId === it.catId)) : sum(ex, it.scope);
      const ratio = it.amount ? spent / it.amount : 0;
      const level = spent > it.amount ? 'over' : spent === it.amount ? 'reached' : ratio >= 0.8 ? 'near' : 'ok';
      return { item: it, label: limitLabel(S, it), limit: it.amount, spent, left: round2(it.amount - spent), ratio, level };
    }).sort((a, b) => b.ratio - a.ratio);
  }
  /* Returns limits that newly reached or went over since the last alert, and remembers them,
     so the same alert is not shown again on every refresh. */
  function checkAlerts(S, y, m, now) {
    const key = mk(y, m), fresh = [];
    limitStatus(S, y, m).forEach(st => {
      const k = st.item.id + '|' + key, seen = S.alertSeen[k] || 0, lv = LEVEL[st.level];
      let next = seen;
      if (lv >= 2 && lv > seen) {
        fresh.push(st); next = lv;
        S.limitLog.unshift({ t: now || Date.now(), month: key, label: st.label, limit: st.limit, spent: st.spent, level: st.level });
        if (S.limitLog.length > 300) S.limitLog.length = 300;
      } else if (lv < seen) next = lv >= 2 ? lv : 0; // spending dropped: allow a new alert if it crosses again
      S.alertSeen[k] = next;
    });
    return fresh;
  }

  /* ---------- CSV ---------- */
  function csvCell(v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCSV(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\r\n'); }
  function yearCSV(S, y) {
    const rows = [['Family Income Ledger — ' + y], [], ['Month','Income','Necessary','Lifestyle','Total expenses','Savings','Available balance','Running balance']];
    yearSeries(S, y).forEach((x, i) => { const rb = runningBalance(S, y, i); rows.push(x.empty ? [FULL[i], '', '', '', '', '', '', rb.started ? rb.total : ''] : [FULL[i], x.income, x.need, x.life, x.total, x.save, x.bal, rb.total]); });
    const t = yearTotals(S, y);
    rows.push(['Total', t.income, t.need, t.life, t.total, t.save, t.bal], [], ['Transactions'],
      ['Date','Record','Type','Name','Category','Subcategory','Amount','Person','Paid with','UPI ref','Notes']);
    const tx = inYear(S.expenses, y).map(e => [e.date, 'Expense', KINDS[e.type], e.name, catName(S, e.catId), subName(S, e.catId, e.subId), e.amount, personName(S, e.paidBy, e.paidName), e.mode || '', e.upiRef || '', e.note || ''])
      .concat(inYear(S.savings, y).map(e => [e.date, 'Savings', 'Savings', e.name, catName(S, e.catId), subName(S, e.catId, e.subId), e.amount, personName(S, e.by, e.byName), '', '', e.note || '']))
      .sort((a, b) => a[0].localeCompare(b[0]));
    tx.forEach(r => rows.push(r));
    rows.push([], ['Income records'], ['Month','Person','Amount','Status','Notes']);
    MONTHS.forEach((_, i) => { const r = S.records[mk(y, i)] || {}; Object.entries(r).forEach(([pid, e]) => rows.push([FULL[i], personName(S, pid), e.none ? 0 : e.amount, e.none ? 'No income' : 'Income', e.note || ''])); });
    return toCSV(rows);
  }

  /* ---------- month helpers ---------- */
  const monthIndex = key => { const [y, m] = key.split('-').map(Number); return y * 12 + m - 1; };
  const keyFromIndex = i => Math.floor(i / 12) + '-' + pad(i % 12 + 1);
  function daysBetween(a, b) { const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 864e5); }
  function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }

  /* ---------- repeating payments and bills ---------- */
  // r: {id, kind:'exp'|'save', name, amount (null = amount changes each time), type, catId, subId, who, note,
  //     freq: months between payments, day: 1–31, start:'YYYY-MM', paused, done:{'YYYY-MM': txId|'skip'}}
  const FREQ = { 1: 'Every month', 2: 'Every 2 months', 3: 'Every 3 months', 6: 'Every 6 months', 12: 'Every year' };
  function isDueIn(r, key) { const d = monthIndex(key) - monthIndex(r.start); return d >= 0 && d % (r.freq || 1) === 0; }
  function dueDate(r, key) { const [y, m] = key.split('-').map(Number); return key + '-' + pad(Math.min(r.day, new Date(y, m, 0).getDate())); }
  function recurStatus(S, r, key) {
    const v = (r.done || {})[key];
    if (v === 'skip') return 'skipped';
    if (v && (r.kind === 'save' ? S.savings : S.expenses).some(e => e.id === v)) return 'done';
    return 'pending';
  }
  /* Pending payments from last month and this month, due on or before today + `ahead` days. */
  function dueList(S, todayStr, ahead) {
    const ti = monthIndex(todayStr.slice(0, 7)), limit = addDays(todayStr, ahead || 0), out = [];
    (S.recurring || []).forEach(r => {
      if (r.paused) return;
      [ti - 1, ti].forEach(i => {
        const key = keyFromIndex(i);
        if (!isDueIn(r, key) || recurStatus(S, r, key) !== 'pending') return;
        const date = dueDate(r, key);
        if (date <= limit) out.push({ r, key, date, days: daysBetween(todayStr, date) });
      });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function nextDue(S, r, todayStr) {
    const ti = monthIndex(todayStr.slice(0, 7));
    for (let i = ti - 1; i <= ti + 24; i++) { const key = keyFromIndex(i); if (isDueIn(r, key) && recurStatus(S, r, key) === 'pending' && (i >= ti || dueDate(r, key) < todayStr)) return dueDate(r, key); }
    return null;
  }

  /* ---------- running balance (what is left over carries into the next month) ---------- */
  function firstMonthKey(S) {
    const keys = Object.keys(S.records).filter(k => Object.keys(S.records[k]).length)
      .concat(S.expenses.map(e => e.date.slice(0, 7)), S.savings.map(e => e.date.slice(0, 7)));
    return keys.sort()[0] || null;
  }
  function runningBalance(S, y, m) {
    const target = monthIndex(mk(y, m)), op = S.opening && S.opening.month ? S.opening : null;
    const startKey = op ? op.month : firstMonthKey(S), bal = totals(S, y, m).bal;
    if (!startKey || target < monthIndex(startKey)) return { carried: 0, bal, total: bal, started: false, opening: 0 };
    let carried = op ? op.amount : 0;
    for (let i = monthIndex(startKey); i < target; i++) { const k = keyFromIndex(i); carried += totals(S, +k.slice(0, 4), +k.slice(5) - 1).bal; }
    carried = round2(carried);
    return { carried, bal, total: round2(carried + bal), started: true, opening: op ? op.amount : 0 };
  }

  /* ---------- this month vs last month ---------- */
  // For the month in progress, last month is cut at the same day so the comparison is fair.
  function compareMonths(S, y, m, todayStr) {
    const py = m ? y : y - 1, pm = m ? m - 1 : 11;
    const isCurrent = todayStr && todayStr.slice(0, 7) === mk(y, m), cut = isCurrent ? +todayStr.slice(8) : 31;
    const upto = list => list.filter(e => +e.date.slice(8) <= cut);
    const exNow = inMonth(S.expenses, y, m), exPrev = upto(inMonth(S.expenses, py, pm));
    const svNow = inMonth(S.savings, y, m), svPrev = upto(inMonth(S.savings, py, pm));
    if (!exPrev.length && !svPrev.length && !hasIncome(S, py, pm)) return null;
    const pair = (a, b) => ({ now: a, before: b, diff: round2(a - b) });
    const now = byCat(S, exNow), prev = byCat(S, exPrev), ids = new Set(now.concat(prev).map(c => c.catId));
    const cats = [...ids].map(id => { const a = now.find(c => c.catId === id), b = prev.find(c => c.catId === id), x = a || b;
      return { catId: id, name: x.name, type: x.type, now: a ? a.v : 0, before: b ? b.v : 0, diff: round2((a ? a.v : 0) - (b ? b.v : 0)) }; })
      .filter(c => c.diff !== 0).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    return { py, pm, partial: isCurrent, cutDay: cut,
      income: pair(incomeMonth(S, y, m), incomeMonth(S, py, pm)),
      need: pair(sum(exNow, 'need'), sum(exPrev, 'need')), life: pair(sum(exNow, 'life'), sum(exPrev, 'life')),
      total: pair(sum(exNow), sum(exPrev)), save: pair(sum(svNow), sum(svPrev)), cats };
  }

  /* ---------- monthly report ---------- */
  // "Left after expenses" = income − expenses. Recorded savings (RD, FD…) are shown separately,
  // so nothing is counted twice.
  const DEFAULT_TARGETS = { needs: 50, wants: 30, save: 20 };
  function targetsOf(S) { const t = Object.assign({}, DEFAULT_TARGETS, S.targets || {}); return t; }
  function pctOf(part, whole) { return whole > 0 ? Math.round(part / whole * 1000) / 10 : null; }
  function monthReport(S, y, m) {
    const t = totals(S, y, m), py = m ? y : y - 1, pm = m ? m - 1 : 11, p = totals(S, py, pm);
    const ex = inMonth(S.expenses, y, m), cats = byCat(S, ex);
    const left = round2(t.income - t.total), prevLeft = round2(p.income - p.total);
    const top = cats[0] || null;
    const r = {
      y, m, py, pm, income: t.income, hasIncome: t.hasIncome, expenses: t.total, need: t.need, life: t.life, uns: t.uns,
      saved: t.save, left, leftPct: pctOf(left, t.income), nExp: t.nExp, cats, top, topPct: top ? pctOf(top.v, t.total) : null,
      prev: { income: p.income, expenses: p.total, left: prevLeft, leftPct: pctOf(prevLeft, p.income), empty: p.empty },
      change: { income: round2(t.income - p.income), expenses: round2(t.total - p.total), left: round2(left - prevLeft) },
      split: { needs: pctOf(t.need, t.income), wants: pctOf(t.life, t.income), save: pctOf(left, t.income) },
      empty: t.empty
    };
    r.change.incomePct = pctOf(r.change.income, p.income); r.change.expensesPct = pctOf(r.change.expenses, p.total);
    return r;
  }
  function lastMonths(S, y, m, n) { // oldest first, ending with (y, m)
    const out = []; for (let i = n - 1; i >= 0; i--) { const k = keyFromIndex(monthIndex(mk(y, m)) - i); const yy = +k.slice(0, 4), mm = +k.slice(5) - 1; out.push(Object.assign({ y: yy, m: mm }, totals(S, yy, mm))); }
    return out;
  }

  /* ---------- smart suggestions ----------
     Built only from saved records. Each item: { key, level: 'good' | 'warn' | 'info', text }.
     Months still in progress are compared day-for-day with last month (compareMonths). */
  function insights(S, y, m, todayStr) {
    const r = monthReport(S, y, m), out = [], tg = targetsOf(S), fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
    const isCurrent = todayStr && todayStr.slice(0, 7) === mk(y, m);
    if (!r.hasIncome && r.nExp < 3) { out.push({ key: 'nodata', level: 'info', text: 'You have not recorded enough income and expenses yet to give useful suggestions. Add this month’s income and a few expenses to see them.' }); return out; }
    if (!r.hasIncome) out.push({ key: 'noincome', level: 'info', text: `Add your income for ${FULL[m]} to see how much of it you are keeping.` });
    if (r.nExp < 3) { out.push({ key: 'fewexp', level: 'info', text: 'Only a few expenses are recorded this month, so suggestions may not be reliable yet.' }); }
    // limits (budget) alerts, if the user has set limits
    limitStatus(S, y, m).filter(x => x.level !== 'ok').slice(0, 2).forEach(x => out.push({ key: 'lim-' + x.item.id, level: x.level === 'near' ? 'info' : 'warn',
      text: x.level === 'over' ? `You have gone ${fmt(-x.left)} over your ${x.label} limit (${fmt(x.limit)}).` : `You have used ${Math.round(x.ratio * 100)}% of your ${x.label} limit. ${fmt(x.left)} left.` }));
    // income kept / overspent
    if (r.hasIncome && r.nExp >= 3) {
      if (r.left < 0) out.push({ key: 'overspent', level: 'warn', text: `You spent ${fmt(-r.left)} more than your income this month. Check the biggest categories below to see where it went.` });
      else if (r.leftPct >= tg.save && !isCurrent) out.push({ key: 'kept', level: 'good', text: `You kept ${Math.round(r.leftPct)}% of your income this month (${fmt(r.left)}). Great progress!` });
      else if (r.leftPct >= tg.save) out.push({ key: 'kept', level: 'good', text: `So far you have kept ${Math.round(r.leftPct)}% of your income this month. Keep it up!` });
      if (!r.prev.empty && r.prev.leftPct != null && r.leftPct != null && !isCurrent && r.leftPct - r.prev.leftPct >= 3)
        out.push({ key: 'improved', level: 'good', text: `You kept more of your income than in ${FULL[r.pm]} (${Math.round(r.leftPct)}% vs ${Math.round(r.prev.leftPct)}%). Nice work!` });
    }
    // category changes vs last month (same days if this month is in progress)
    const cmp = compareMonths(S, y, m, todayStr);
    if (cmp) {
      cmp.cats.filter(c => c.type !== 'uns' && c.before >= 300 && c.diff >= 300 && c.diff / c.before >= 0.15).slice(0, 2).forEach(c => out.push({ key: 'up-' + c.catId, level: 'warn',
        text: `${c.name} spending is up ${Math.round(c.diff / c.before * 100)}% (${fmt(c.diff)} more) compared with ${cmp.partial ? 'the same days of ' : ''}${FULL[cmp.pm]}.` }));
      cmp.cats.filter(c => c.type !== 'uns' && c.before >= 500 && -c.diff >= 300 && -c.diff / c.before >= 0.2).slice(0, 1).forEach(c => out.push({ key: 'down-' + c.catId, level: 'good',
        text: `You spent ${fmt(-c.diff)} less on ${c.name} than in ${FULL[cmp.pm]}. Well done!` }));
    }
    // higher than usual: compared with the average of the previous 3 months that have data
    const hist = [1, 2, 3].map(i => { const k = keyFromIndex(monthIndex(mk(y, m)) - i); return byCat(S, inMonth(S.expenses, +k.slice(0, 4), +k.slice(5) - 1)); });
    const monthsWithData = hist.filter(h => h.length).length;
    if (monthsWithData >= 2 && !isCurrent) {
      r.cats.filter(c => c.type !== 'uns').forEach(c => {
        const avg = hist.reduce((a, h) => a + ((h.find(x => x.catId === c.catId) || {}).v || 0), 0) / monthsWithData;
        if (avg >= 300 && c.v >= 1000 && c.v >= avg * 1.5 && !out.some(o => o.key === 'up-' + c.catId))
          out.push({ key: 'usual-' + c.catId, level: 'warn', text: `${c.name} (${fmt(c.v)}) is higher than usual. You normally spend about ${fmt(avg)}. Consider reviewing it.` });
      });
    }
    // 50/30/20 guide (wants only, gently)
    if (r.hasIncome && r.split.wants != null && r.split.wants > tg.wants + 5 && r.nExp >= 5)
      out.push({ key: 'wants', level: 'info', text: `Lifestyle spending is ${Math.round(r.split.wants)}% of your income. The 50/30/20 guide suggests about ${tg.wants}%. It is only a guide; every family is different.` });
    // practical tip from the biggest lifestyle category
    const topLife = r.cats.find(c => c.type === 'life');
    if (topLife && topLife.v >= 1000 && r.nExp >= 5)
      out.push({ key: 'tip-' + topLife.catId, level: 'info', text: `Your biggest lifestyle spend is ${topLife.name} (${fmt(topLife.v)}). Spending a quarter less there would keep about ${fmt(topLife.v / 4)} more each month.` });
    return out;
  }

  /* ---------- UPI notification reading (Android app only) ----------
     Turns the text of a payment-app notification into a suggestion for review.
     It never decides on its own that money was spent: unclear text is marked for the user to check,
     and a missing amount is left empty for the user to fill in. */
  const UPI_SOURCES = {
    gpay: { name: 'Google Pay', pkgs: ['com.google.android.apps.nbu.paisa.user'], on: true },
    phonepe: { name: 'PhonePe', pkgs: ['com.phonepe.app'], on: true },
    paytm: { name: 'Paytm', pkgs: ['net.one97.paytm'], on: true },
    bhim: { name: 'BHIM', pkgs: ['in.org.npci.upiapp'], on: true },
    cred: { name: 'CRED', pkgs: ['com.dreamplug.androidapp'], on: true },
    sms: { name: 'Bank SMS', pkgs: ['com.google.android.apps.messaging', 'com.samsung.android.messaging', 'com.android.mms', 'com.oneplus.mms', 'com.truecaller', 'com.microsoft.android.smsorganizer'], on: true },
    other: { name: 'Other app', pkgs: [], on: true }
  };
  const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Other'];
  function sourceOfPkg(pkg) { return Object.keys(UPI_SOURCES).find(k => UPI_SOURCES[k].pkgs.includes(pkg)) || null; }
  function upiPackages(sources) { return Object.keys(UPI_SOURCES).filter(k => (sources || {})[k]).reduce((a, k) => a.concat(UPI_SOURCES[k].pkgs), []); }

  const RX = {
    otp: /\b(otp|one[- ]time password|verification code)\b/i,
    promo: /\b(offer|win|won|get up to|upto|up to ₹|off on|discount|rewards?|scratch card|coupon|deal|voucher|earn|loan|pre[- ]?approved|eligible|apply|click|limit|insta|instant|disburs\w*|interest|rates?|t&c|tak|lakh|lac|kyc|bonus|free|sale|cashback)\b/i,
    // TRAI sender codes: "JX-ABCDBF-P" ends in -P for promotional SMS (ads), never a payment
    promoSender: /^[a-z]{2}-[a-z0-9]{3,9}-p$/i,
    failed: /\b(failed|failure|declined|unsuccessful|not successful|could not be (completed|processed)|reversed|cancell?ed|timed out)\b/i,
    refund: /\b(refund(ed)?|cashback|reversal)\b/i,
    request: /\b(requested|requesting|is requesting|collect request|payment request|request(ed)? (money|payment)|bill is due|is due|due on|reminder|pay now|pay your)\b/i,
    credit: /\b(received|credited|has sent you|sent you|added to (your )?(wallet|account|balance|bank))\b/i,
    debit: /(\byou paid\b|\bpaid to\b|\bpaid (₹|rs\b|rs\.|inr\b)|\bpaid successfully\b|\bpayment ((of|to) [^.]{0,40}?)?(was |is |has been )?successful\b|(₹|rs\.?|inr)\s*[0-9][0-9,.]*\s*(has been |was |is )?(paid|sent|debited|spent)\b|\bsent (₹|rs\b|rs\.|inr\b)|\byou sent\b|\bmoney sent\b|\bdebited\b|\btransferred to\b|\bspent\b)/i
  };
  const RX_UPI_NAME = /\bupi[-\/]([A-Za-z][A-Za-z .&']{1,40}?)[-\/]/i;
  const RX_PAYEE = /\b(?:paid|sent|transferred|payment|debited|trf)\b(?:[^.]|\.(?=[0-9])){0,80}?\bto\s+(?:vpa\s+)?([A-Za-z0-9@._&' -]{2,40}?)(?=\s+(?:on|via|using|from|for|upi|ref|refno|successfully|is|was|has|with|thru|through|not)\b|[.,!;(]|$)/i;
  const RX_TO_ACCT = /\bcredited\s+to\s+(?:a\/c|ac|account)\.?\s*(?:no\.?)?\s*[x*]*([0-9]{3,6})\b/i;
  function parseUpi(title, text) {
    const t = ((title || '') + ' . ' + (text || '')).replace(/\s+/g, ' ').trim();
    const out = { kind: 'unknown', amount: null, payee: null, ref: null, issues: [] };
    if (RX.otp.test(t) || RX.promoSender.test((title || '').trim())) { out.kind = 'ignore'; return out; }
    // amount: every ₹/Rs/INR figure that is not an account balance or limit
    const amounts = [], re = /(?:₹|\brs\.?|\binr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi; let mt;
    while ((mt = re.exec(t))) {
      const before = t.slice(Math.max(0, mt.index - 18), mt.index).toLowerCase();
      if (/(bal|balance|avl|available|limit|outstanding)\W*$/.test(before) || /(bal|balance)[^a-z]{0,6}(is|:)?\W*$/.test(before)) continue;
      const v = parseMoney(mt[1]); if (v != null && !amounts.includes(v)) amounts.push(v);
    }
    // some banks (SBI) write the amount without ₹/Rs: "debited by 100.0"
    if (!amounts.length) { const bm = t.match(/\bdebited\s+(?:by|for|with)\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b/i); if (bm) { const v = parseMoney(bm[1]); if (v != null) amounts.push(v); } }
    if (amounts.length === 1) out.amount = amounts[0];
    else out.issues.push(amounts.length ? 'amount-ambiguous' : 'amount-missing');
    const refM = t.match(/\b(?:upi\s*)?(?:ref(?:erence)?\.?\s*(?:no\.?|number|id)?|utr|rrn|txn\.?\s*id|transaction\s*id)\s*[:#-]?\s*([0-9]{12})\b/i) || (/\bupi\b/i.test(t) && t.match(/\b([0-9]{12})\b/));
    if (refM) out.ref = refM[1];
    const vpaM = t.match(/\bto\s+(?:vpa\s+)?([A-Za-z0-9._-]+@[A-Za-z0-9.-]*[A-Za-z0-9])/i);
    // who was paid: UPI ID, then "UPI-NAME-" (ICICI), then "... to NAME", then the receiving account number
    const payM = vpaM ? [null, vpaM[1]] : t.match(RX_UPI_NAME) || t.match(RX_PAYEE);
    if (payM && !/^(a\/c|ac|account|your)\b/i.test(payM[1].trim())) out.payee = payM[1].trim().replace(/^(mr|mrs|ms|miss|shri|smt|dr)\.?\s+/i, '');
    if (!out.payee) { const am = t.match(RX_TO_ACCT); if (am) out.payee = 'A/c ending ' + am[1]; }
    const isDebit = RX.debit.test(t);
    if (RX.promo.test(t) && !isDebit) { out.kind = 'ignore'; return out; } // ads and offers from payment apps
    if (RX.failed.test(t)) out.kind = 'failed';
    else if (RX.refund.test(t)) out.kind = 'refund';
    else if (RX.request.test(t)) out.kind = 'request';
    else {
      const d = RX.debit.test(t), c = RX.credit.test(t);
      out.kind = d && c ? 'unknown' : d ? 'debit' : c ? 'credit' : 'unknown';
    }
    if (out.kind === 'unknown' && out.amount == null && !out.issues.includes('amount-ambiguous')) out.kind = 'ignore';
    // a message without a clear payment word counts only if it is clearly about a UPI payment (a UPI word or reference)
    if (out.kind === 'unknown' && !out.ref && !/\bupi\b/i.test(t)) out.kind = 'ignore';
    return out;
  }
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
  /* The "shape" of a payment message: the text with amount, date, time, balance and reference number taken out.
     Two payments to the same person from the same bank leave the same shape, even when the person's name
     cannot be picked out of the message. */
  function upiShape(title, text) {
    let t = ((title || '') + ' . ' + (text || '')).toLowerCase().replace(/\s+/g, ' ');
    t = t.replace(/\b(?:avl\.?\s*|avail\.?\s*|available\s*)?bal(?:ance)?\b[^a-z]{0,30}/g, ' ')
      .replace(/(?:₹|\brs\.?|\binr)\s*[0-9][0-9,]*(?:\.[0-9]+)?/g, ' ')
      .replace(/\b(debited|credited)\s+(by|for|with)\s+[0-9][0-9,]*(?:\.[0-9]+)?/g, '$1 $2 ')
      .replace(/\b\d{1,2}(?:st|nd|rd|th)?[-\/ .]?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\/ .,]?\s?\d{2,4}\b/g, ' ')
      .replace(/\b\d{1,4}[-\/.]\d{1,2}[-\/.]\d{1,4}\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|hrs)?\b/g, ' ')
      .replace(/\b\d{11,}\b/g, ' ')
      .replace(/\b\d+\.\d+\b/g, ' ')
      .replace(/[^a-z0-9@]+/g, ' ').trim();
    return t.length >= 8 ? fnv(t) : null;
  }
  function upiKey(raw, parsed) { return parsed.ref ? 'ref:' + parsed.ref : 'h:' + fnv(raw.pkg + '|' + (raw.title || '') + '|' + (raw.text || '')); }

  /* ---------- sample data (opt-in, tagged so it can be removed cleanly) ---------- */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function loadSample(S, todayStr) {
    if (S.sampleLoaded) return 0;
    const r = rng(20261013), pick = a => a[Math.floor(r() * a.length)], vary = (n, p) => Math.round(n * (1 + (r() * 2 - 1) * p) / 10) * 10;
    const [ty, tm, td] = todayStr.split('-').map(Number);
    while (S.people.filter(p => !p.archived).length < 4) { const n = S.people.length + 1; S.people.push({ id: uid('p'), name: 'Person ' + n, color: COLORS[(n - 1) % COLORS.length], archived: false }); }
    const P = S.people.filter(p => !p.archived).slice(0, 4).map(p => p.id);
    const cid = (kind, name) => ensureCat(S, kind, name).id;
    const sid = (catId, name) => { const c = cat(S, catId); let s = c.subs.find(x => same(x.name, name)); if (!s) { s = { id: uid('s'), name, archived: false }; c.subs.push(s); } return s.id; };
    let n = 0; const t0 = Date.now();
    const ex = (date, type, catName, name, amount, who, sub, note) => { const c = cid(type, catName); S.expenses.push({ id: uid('x'), name, amount, date, type, catId: c, subId: sub ? sid(c, sub) : null, paidBy: who, note: note || '', created: t0 + n++, sample: true }); };
    const sv = (date, catName, name, amount, who, note) => { S.savings.push({ id: uid('v'), name, amount, date, catId: cid('save', catName), subId: null, by: who, note: note || '', created: t0 + n++, sample: true }); };
    for (let m = 0; m < tm; m++) {
      const y = ty, key = mk(y, m), last = new Date(y, m + 1, 0).getDate(), maxDay = m === tm - 1 ? td : last;
      const D = d => (d <= maxDay ? key + '-' + pad(d) : null), at = (d, f) => { const dd = D(d); if (dd) f(dd); };
      // income — only where the person has nothing recorded yet
      const rec = S.records[key] = S.records[key] || {};
      const inc = { [P[0]]: m >= 6 ? 92000 : 85000, [P[1]]: 55000 };
      if (m !== 3 && m !== 7) inc[P[2]] = vary(14000, 0.35); else inc[P[2]] = null;
      Object.entries(inc).forEach(([pid, a]) => { if (!rec[pid]) rec[pid] = a == null ? { none: true, note: 'No freelance work', sample: true } : { amount: a, note: pid === P[0] && m === 6 ? 'Salary hike' : pid === P[2] ? 'Freelance' : '', sample: true }; });
      if (!rec[P[3]]) rec[P[3]] = { none: true, note: 'Student', sample: true };
      // necessary
      at(1, d => ex(d, 'need', 'House Rent', 'House rent', 18000, P[0]));
      at(5, d => ex(d, 'need', 'Loan and EMI', 'Bike loan EMI', 6500, P[0]));
      at(5, d => ex(d, 'need', 'Domestic Help', 'Maid salary', 4000, P[1]));
      [3, 12, 22].forEach((d, i) => at(d, dd => ex(dd, 'need', 'Groceries', pick(['Monthly provisions', 'Vegetables & fruits', 'Supermarket run', 'Weekly groceries']), i === 0 ? vary(9500, .1) : vary(3200, .25), P[1])));
      at(4, d => ex(d, 'need', 'Milk and Dairy', 'Aavin milk card', 2400, P[1]));
      at(8, d => ex(d, 'need', 'Electricity Bill', 'TNEB bill', m >= 3 && m <= 5 ? vary(3900, .1) : vary(2100, .15), P[0]));
      at(10, d => ex(d, 'need', 'Water Bill', 'Water can + tax', 450, P[1]));
      if (m % 2 === 0 || m === 9) at(14, d => ex(d, 'need', 'Gas Cylinder', 'Indane cylinder', 905, P[1]));
      at(7, d => ex(d, 'need', 'Internet and Wi-Fi', 'ACT Fibernet', 799, P[0]));
      at(15, d => ex(d, 'need', 'Mobile Recharge', 'Jio recharge ×2', 598, P[0]));
      at(6, d => ex(d, 'need', 'Transportation', 'Petrol', vary(2800, .2), P[0]));
      at(20, d => ex(d, 'need', 'Transportation', 'Petrol', vary(1800, .25), P[1]));
      if (m !== 4) at(2, d => ex(d, 'need', 'Education', 'College bus fee', 1500, P[1], 'Bus Fees'));
      if (m === 5) { at(10, d => ex(d, 'need', 'Education', 'Semester fee', 42000, P[0], 'College Fees')); at(12, d => ex(d, 'need', 'Education', 'Textbooks', 2850, P[1], 'Books')); }
      if (m === 10) at(18, d => ex(d, 'need', 'Education', 'Exam fee', 1800, P[0], 'Exam Fees'));
      at(18, d => ex(d, 'need', 'Household Supplies', 'Cleaning & toiletries', vary(1600, .2), P[1]));
      if (m === 2) at(25, d => ex(d, 'need', 'Insurance', 'Family health insurance', 24500, P[0], null, 'Annual premium'));
      if ([1, 6, 8].includes(m)) at(16, d => ex(d, 'need', 'Medical Expenses', pick(['Clinic visit', 'Pharmacy']), vary(1400, .4), P[1]));
      // lifestyle
      at(13, d => ex(d, 'life', 'Cinema and Theatre', pick(['Movie night', 'Weekend movie', 'IMAX show']), vary(900, .3), pick([P[0], P[2]])));
      if (r() > .5) at(27, d => ex(d, 'life', 'Cinema and Theatre', 'Movie tickets', vary(700, .3), P[2]));
      [9, 24].forEach(d => at(d, dd => ex(dd, 'life', 'Restaurant and Hotel Food', pick(['Family dinner', 'Biryani lunch', 'Hotel breakfast']), vary(1500, .35), P[0])));
      [6, 11, 17, 23, 28].slice(0, 3 + Math.floor(r() * 3)).forEach(d => at(d, dd => ex(dd, 'life', 'Online Food Orders', pick(['Swiggy', 'Zomato']), vary(480, .35), pick(P.slice(0, 3)))));
      at(19, d => ex(d, 'life', 'Shopping', m === 9 ? 'Diwali clothes' : pick(['Clothes', 'Amazon order', 'Footwear', 'Home décor']), m === 9 ? 12500 : vary(2600, .5), pick([P[0], P[1]])));
      at(1, d => ex(d, 'life', 'Subscriptions', 'Netflix + Spotify', 768, P[0]));
      at(21, d => ex(d, 'life', 'Snacks and Drinks', 'Bakery & juice', vary(650, .3), P[2]));
      if (m === 4) at(17, d => ex(d, 'life', 'Trips and Travel', 'Kodaikanal family trip', 14200, P[0]));
      if (m === 11) at(26, d => ex(d, 'life', 'Trips and Travel', 'Year-end trip', 18000, P[0]));
      if ([2, 7].includes(m)) at(26, d => ex(d, 'life', 'Entertainment', pick(['Theme park', 'Concert tickets']), vary(2400, .2), P[1]));
      // savings
      at(5, d => sv(d, 'Recurring Deposit', 'SBI RD', 5000, P[0]));
      at(5, d => sv(d, 'Education Savings', 'Sukanya / education fund', 2000, P[1]));
      at(28, d => sv(d, 'Emergency Fund', 'Emergency fund top-up', m === 9 ? 1500 : 3000, P[1]));
      if (m === 2) at(28, d => sv(d, 'Fixed Deposit', 'FD from bonus', 50000, P[0], 'One-year FD'));
      if ([3, 7, 10].includes(m)) at(20, d => sv(d, 'Future Purchases', 'New fridge fund', 4000, P[2]));
    }
    // repeating payments and bills, linked to the matching sample entries
    const rc = (kind, type, catName, name, amount, day, freq, who, startM, sub) => {
      const catId = kind === 'save' ? cid('save', catName) : cid(type, catName);
      const r = { id: uid('r'), kind, name, amount, type: kind === 'save' ? 'save' : type, catId, subId: sub ? sid(catId, sub) : null, who, note: '', freq, day, start: mk(ty, startM), paused: false, done: {}, sample: true };
      const list = kind === 'save' ? S.savings : S.expenses;
      for (let m = startM; m < tm; m++) { const key = mk(ty, m); if (!isDueIn(r, key)) continue; const hit = list.find(e => e.sample && e.catId === catId && e.date.slice(0, 7) === key && (amount == null || e.amount === amount)); if (hit) r.done[key] = hit.id; }
      S.recurring.push(r);
    };
    rc('exp', 'need', 'House Rent', 'House rent', 18000, 1, 1, P[0], 0);
    rc('exp', 'need', 'Loan and EMI', 'Bike loan EMI', 6500, 5, 1, P[0], 0);
    rc('exp', 'need', 'Domestic Help', 'Maid salary', 4000, 5, 1, P[1], 0);
    rc('exp', 'need', 'Electricity Bill', 'TNEB bill', null, 8, 1, P[0], 0);
    rc('exp', 'need', 'Internet and Wi-Fi', 'ACT Fibernet', 799, 7, 1, P[0], 0);
    rc('exp', 'need', 'Mobile Recharge', 'Jio recharge ×2', 598, 15, 1, P[0], 0);
    rc('exp', 'need', 'Gas Cylinder', 'Indane cylinder', 905, 14, 2, P[1], 0);
    rc('exp', 'need', 'Insurance', 'Family health insurance', 24500, 25, 12, P[0], 2);
    rc('exp', 'life', 'Subscriptions', 'Netflix + Spotify', 768, 1, 1, P[0], 0);
    rc('save', null, 'Recurring Deposit', 'SBI RD', 5000, 5, 1, P[0], 0);
    rc('save', null, 'Emergency Fund', 'Emergency fund top-up', null, 28, 1, P[1], 0);
    // a few example limits so the alerts feature has something to show
    const lim = (scope, catId, amount) => S.limits.items.push({ id: uid('l'), scope, catId, amount, month: '*', on: true, sample: true });
    lim('life', null, 15000); lim('total', null, 110000); lim('cat', cid('life', 'Online Food Orders'), 1500);
    if (!S.limits.enabled) { S.limits.enabled = true; S.sampleTurnedOnLimits = true; }
    const before = S.limitLog.length;
    for (let m = 0; m < tm; m++) checkAlerts(S, ty, m, t0);
    S.limitLog.slice(0, S.limitLog.length - before).forEach(x => { x.sample = true; });
    S.sampleLoaded = true;
    return n;
  }
  function removeSample(S) {
    S.expenses = S.expenses.filter(e => !e.sample);
    S.savings = S.savings.filter(e => !e.sample);
    Object.keys(S.records).forEach(k => { Object.keys(S.records[k]).forEach(pid => { if (S.records[k][pid].sample) delete S.records[k][pid]; }); if (!Object.keys(S.records[k]).length) delete S.records[k]; });
    S.limits.items = S.limits.items.filter(it => !it.sample);
    S.recurring = (S.recurring || []).filter(r => !r.sample);
    if (S.sampleTurnedOnLimits) S.limits.enabled = false;
    S.limitLog = S.limitLog.filter(x => !x.sample);
    S.alertSeen = {};
    delete S.sampleTurnedOnLimits; S.sampleLoaded = false;
  }

  Object.assign(L, { DEFAULT_TARGETS, targetsOf, pctOf, monthReport, lastMonths, insights, UPI_SOURCES, PAY_MODES, sourceOfPkg, upiPackages, parseUpi, upiShape, upiKey, defaultUpi, loadSample, removeSample, FREQ, monthIndex, keyFromIndex, daysBetween, addDays, isDueIn, dueDate, recurStatus, dueList, nextDue, firstMonthKey, runningBalance, compareMonths, MONTHS, FULL, KINDS, COLORS, DEFAULT_CATS, uid, pad, mk, norm, same, fresh, migrate, ensureCat,
    parseMoney, validDate, cat, catName, subName, person, personName, catUses, subUses, amt, incomeMonth, hasIncome,
    inMonth, inYear, sum, round2, totals, yearSeries, yearTotals, byCat, findTwin, isDoubleTap, LEVEL, limitLabel,
    effectiveLimits, limitStatus, checkAlerts, yearCSV, toCSV });
})(typeof module !== 'undefined' && module.exports ? module.exports : (window.Ledger = {}));

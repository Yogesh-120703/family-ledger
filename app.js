/* Family Income Ledger — app screens. Depends on core.js (window.Ledger). */
(function () {
  'use strict';
  const L = window.Ledger;
  const { MONTHS, FULL, KINDS, COLORS, mk, pad } = L;
  const KEY = 'fil-app-v2', BACKUP_KEY = 'fil-app-v2:before-import', PREF_KEY = 'fil-app-v2:prefs';

  /* ---------- Android bridge (present only inside the Android app build) ---------- */
  const CAP = window.Capacitor;
  const IS_NATIVE = !!(CAP && typeof CAP.isNativePlatform === 'function' && CAP.isNativePlatform());
  const Native = IS_NATIVE ? (typeof CAP.registerPlugin === 'function' ? CAP.registerPlugin('LedgerNative') : (CAP.Plugins || {}).LedgerNative) : null;

  /* ---------- formatting ---------- */
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const fmtINR = n => { const a = Math.abs(n); const s = a.toLocaleString('en-IN', { minimumFractionDigits: a % 1 ? 2 : 0, maximumFractionDigits: 2 }); return (n < 0 ? '−' : '') + '₹' + s; };
  const plain = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('en-IN');
  const short = n => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e7 ? s + '₹' + (a / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr' : a >= 1e5 ? s + '₹' + (a / 1e5).toFixed(1).replace(/\.0$/, '') + 'L' : a >= 1e3 ? s + '₹' + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : s + '₹' + Math.round(a); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const fmtDate = d => { const [, m, dd] = d.split('-'); return +dd + ' ' + MONTHS[+m - 1]; };
  const fmtTime = t => { const d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  /* ---------- storage ---------- */
  let tt; // toast timer (declared early: storage errors can show a toast during start-up)
  let storageOK = true;
  function loadState() {
    try { const raw = localStorage.getItem(KEY); return L.migrate(raw ? JSON.parse(raw) : null); }
    catch (e) { storageOK = false; return L.fresh(); }
  }
  let S = loadState();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); storageOK = true; }
    catch (e) { storageOK = false; toast('Could not save. Your phone storage may be full.'); }
  }
  persist();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
  let prefs = {}; try { prefs = JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) {}
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} };
  function addLog(msg) { S.log.unshift({ t: Date.now(), msg }); if (S.log.length > 500) S.log.length = 500; }

  /* ---------- ui state ---------- */
  const VIEWS = [['home', 'Home'], ['income', 'Income'], ['expenses', 'Expenses'], ['savings', 'Savings'], ['analytics', 'Analytics'], ['reports', 'Reports']];
  const ICON = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    income: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/>',
    expenses: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    savings: '<path d="M7 7h10l1 4v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8z"/><path d="M8 3h8v4H8z"/><path d="M12 12v5M10 14.5h4"/>',
    analytics: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    back: '<path d="M15 18l-6-6 6-6"/>'
  };
  const d0 = new Date();
  let savedPay = 'cash'; try { savedPay = localStorage.getItem('fil-app-v2:pay') || 'cash'; } catch (e) {}
  const ui = { pay: savedPay, view: 'home', year: d0.getFullYear(), month: d0.getMonth(), draft: {}, dirty: false, xf: 'all', aMode: 'month', catTab: 'need', openCat: null, showAllLog: false, saving: false };
  function freshDraft() { ui.draft = JSON.parse(JSON.stringify(S.records[mk(ui.year, ui.month)] || {})); ui.dirty = false; }
  freshDraft();

  const active = () => S.people.filter(p => !p.archived);
  const person = id => L.person(S, id);
  const activeCats = kind => S.cats.filter(c => c.kind === kind && !c.archived);

  /* ---------- shell ---------- */
  const app = document.getElementById('app'), navEl = document.getElementById('nav'), layer = document.getElementById('layer');
  const svg = (k, cls) => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ' class="' + cls + '"' : ''}>${ICON[k]}</svg>`;
  function renderNav() {
    navEl.innerHTML = VIEWS.map(([k, l]) => `<li><button data-act="go" data-v="${k}" ${ui.view === k ? 'aria-current="page"' : ''}>${svg(k)}${l}</button></li>`).join('');
  }
  function header(title, mode) {
    const step = mode === 'year'
      ? `<div class="stepper" role="group" aria-label="Year"><button data-act="stepY" data-d="-1" aria-label="Previous year">‹</button><strong>${ui.year}</strong><button data-act="stepY" data-d="1" aria-label="Next year">›</button></div>`
      : mode === 'month'
        ? `<div class="stepper" role="group" aria-label="Month"><button data-act="stepM" data-d="-1" aria-label="Previous month">‹</button><strong>${MONTHS[ui.month]} ${ui.year}</strong><button data-act="stepM" data-d="1" aria-label="Next month">›</button></div>` : '';
    const left = ui.view === 'settings' || ui.view === 'review'
      ? `<div style="display:flex;align-items:center;gap:10px"><button class="iconbtn" data-act="go" data-v="${ui.prevView || 'home'}" aria-label="Back">${svg('back')}</button><h1>${title}</h1></div>`
      : `<div><div class="brand">Family Income Ledger</div><h1>${title}</h1></div>`;
    return `<div class="top">${left}<div class="tools">${step}
    ${ui.view !== 'settings' && ui.view !== 'review' ? `<button class="iconbtn" data-act="go" data-v="settings" aria-label="Settings">${svg('gear')}</button>` : ''}</div></div>`;
  }
  function render() {
    renderNav();
    const v = ui.view;
    let html = v === 'home' ? vHome() : v === 'income' ? vIncome() : v === 'expenses' ? vExpenses() : v === 'savings' ? vSavings()
      : v === 'analytics' ? vAnalytics() : v === 'reports' ? vReports() : vSettings();
    if (!storageOK) html = html.replace('</div></div>', '</div></div><div class="err-banner">Changes are not being saved on this phone. Check that the browser allows site storage, then try again.</div>');
    const fab = v === 'home' || v === 'expenses' ? `<button class="fab" data-act="newExp"><span>+</span>Expense</button>`
      : v === 'savings' ? `<button class="fab" data-act="newSave"><span>+</span>Savings</button>` : '';
    app.innerHTML = html + fab;
  }

  /* ---------- routing (Android back button moves between screens) ---------- */
  const VALID = VIEWS.map(v => v[0]).concat('settings');
  function route() {
    const v = (location.hash || '#home').slice(1);
    const next = VALID.includes(v) ? v : 'home';
    if (next === ui.view && app.querySelector('.top')) return;
    if (ui.dirty && ui.view === 'income' && next !== 'income') {
      history.replaceState(null, '', '#income');
      return guardDirty(() => { location.hash = next; });
    }
    if ((next === 'settings' || next === 'review') && ui.view !== next && ui.view !== 'settings' && ui.view !== 'review') ui.prevView = ui.view;
    ui.view = next;
    if (next !== 'income') freshDraft();
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', () => { if (layer.innerHTML) closeSheet(); });

  /* ---------- HOME ---------- */
  function txRow(e, kind) {
    const isSave = kind === 'save';
    const c = L.catName(S, e.catId), sub = L.subName(S, e.catId, e.subId);
    const who = L.personName(S, isSave ? e.by : e.paidBy, isSave ? e.byName : e.paidName);
    return `<button class="tx" data-act="${isSave ? 'editSave' : 'editExp'}" data-id="${e.id}"><i class="mark ${isSave ? 'save' : e.type}" aria-hidden="true"></i>
      <span class="t"><strong>${e.catAuto ? '<span class="muted" title="Category remembered">⟳</span> ' : ''}${esc(e.name)}</strong><span>${esc(c)}${sub ? ' › ' + esc(sub) : ''} · ${esc(who)} · ${fmtDate(e.date)}${e.mode ? ' · ' + esc(e.mode) : ''}${e.note ? ' · ' + esc(e.note) : ''}</span></span>
      <span class="a">${fmtINR(e.amount)}</span></button>`;
  }
  function limitsBlock(y, m, max) {
    const st = L.limitStatus(S, y, m);
    if (!st.length) return '';
    const list = max ? st.slice(0, max) : st;
    return `<div class="limits">${list.map(x => `<div class="lim"><div class="r1"><strong>${esc(x.label)}</strong><span class="num ${x.level !== 'ok' ? 't-' + x.level : ''}">${fmtINR(x.spent)} / ${fmtINR(x.limit)}</span></div>
      <div class="track"><i class="lv-${x.level}" style="width:${Math.min(100, x.ratio * 100)}%"></i></div>
      <div class="r2">${x.level === 'over' ? `<span class="t-over">${fmtINR(-x.left)} over the limit</span>` : x.level === 'reached' ? '<span class="t-reached">Limit reached</span>' : fmtINR(x.left) + ' remaining'}</div></div>`).join('')}</div>`;
  }
  function vHome() {
    const y = ui.year, m = ui.month, t = L.totals(S, y, m);
    const base = Math.max(t.income, t.total + t.save) || 1;
    const recent = L.inMonth(S.expenses, y, m).map(e => [e, 'exp']).concat(L.inMonth(S.savings, y, m).map(e => [e, 'save']))
      .sort((a, b) => b[0].date.localeCompare(a[0].date) || (b[0].created || 0) - (a[0].created || 0)).slice(0, 6);
    const st = L.limitStatus(S, y, m), attention = st.filter(x => x.level !== 'ok').length;
    const rb = L.runningBalance(S, y, m), cmp = L.compareMonths(S, y, m, today());
    const isNowMonth = today().slice(0, 7) === mk(y, m), due = isNowMonth ? L.dueList(S, today(), 7) : [];
    const delta = (pair, upIsGood) => { if (!cmp || !pair || pair.diff === 0) return ''; const up = pair.diff > 0, good = up === upIsGood;
      return `<span class="delta ${good ? 'pos' : 'neg'}">${up ? '▲' : '▼'} ${fmtINR(Math.abs(pair.diff))}</span>`; };
    const vsLabel = cmp ? (cmp.partial ? `vs 1–${cmp.cutDay} ${MONTHS[cmp.pm]}` : `vs ${MONTHS[cmp.pm]}`) : '';
    const isEmpty = !S.expenses.length && !S.savings.length && !Object.keys(S.records).length;
    const card = (label, v, sub, has, sw, dl) => `<div class="card"><span class="label">${sw ? `<i class="sw" style="background:${sw}"></i>` : ''}${label}</span>${has ? `<span class="v">${fmtINR(v)}</span>` : `<span class="v nil">Not recorded</span>`}<span class="s">${dl ? dl + ' <span class="muted">' + vsLabel + '</span>' : sub}</span></div>`;
    return header('Home', 'month') + `
    ${deferredInstall && !prefs.hideInstall ? `<div class="notice"><span>Install Family Ledger on this phone for one-tap access, even offline.</span><span style="display:flex;gap:6px"><button class="btn ghost small" data-act="hideInstall">Not now</button><button class="btn primary small" data-act="install">Install app</button></span></div>` : ''}
    ${isEmpty ? `<div class="notice"><span>New here? Load sample data to see how every screen works, or bring data from the web version.</span><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn primary small" data-act="loadSample">Load sample data</button><button class="btn small" data-act="go" data-v="settings">Import data</button></span></div>` : ''}
    ${needsCatPanel()}
    ${S.sampleLoaded ? `<div class="notice"><span><strong>Sample data is showing.</strong> Remove it before you start entering real figures. Your own entries are kept.</span><button class="btn small" data-act="removeSample">Remove sample data</button></div>` : ''}
    <section class="balance" aria-label="Available balance">
      <span class="label">Available balance · ${FULL[m]} ${y}</span>
      ${t.empty ? `<span class="v muted" style="font-size:1.4rem;font-family:var(--body)">No records yet</span><span class="eq">Add income, expenses or savings for ${FULL[m]}.</span>`
        : `<span class="v ${t.bal > 0 ? 'pos' : t.bal < 0 ? 'neg' : ''}">${fmtINR(t.bal)}</span>
      <span class="eq">${fmtINR(t.income)} income − ${fmtINR(t.total)} expenses − ${fmtINR(t.save)} savings</span>
      <div class="meter" aria-hidden="true"><i style="width:${t.need / base * 100}%;background:var(--need)"></i><i style="width:${t.life / base * 100}%;background:var(--life)"></i><i style="width:${t.save / base * 100}%;background:var(--save)"></i></div>
      <div class="mkey"><span><i class="sw" style="background:var(--need)"></i>Necessary</span><span><i class="sw" style="background:var(--life)"></i>Lifestyle</span><span><i class="sw" style="background:var(--save)"></i>Savings</span><span><i class="sw" style="background:var(--sunk)"></i>Available</span></div>`}
      ${rb.started && (rb.carried !== 0 || rb.opening) ? `<div class="carry"><div><span class="label">Carried from earlier months</span><span class="num ${rb.carried < 0 ? 'neg' : ''}">${fmtINR(rb.carried)}</span></div><div><span class="label">Total balance</span><span class="num big ${rb.total > 0 ? 'pos' : rb.total < 0 ? 'neg' : ''}">${fmtINR(rb.total)}</span></div></div>` : ''}
    </section>
    ${due.length ? `<section class="panel" aria-label="Bills and repeating payments"><div class="phead"><div><h2>Bills and repeating payments</h2><p>${due.filter(d => d.days <= 0).length ? due.filter(d => d.days <= 0).length + ' due now · ' : ''}next 7 days</p></div><button class="linkbtn" data-act="goRecurring">Manage</button></div>
      ${due.slice(0, 6).map(d => `<div class="duerow"><button class="dt" data-act="dueOpen" data-id="${d.r.id}" data-k="${d.key}"><strong>${esc(d.r.name)}</strong><span class="${d.days < 0 ? 't-over' : d.days === 0 ? 't-reached' : 'muted'}">${d.days < 0 ? -d.days + ' day' + (d.days === -1 ? '' : 's') + ' late' : d.days === 0 ? 'Due today' : d.days === 1 ? 'Due tomorrow' : 'Due in ' + d.days + ' days'} · ${fmtDate(d.date)}</span></button>
        <span class="num">${d.r.amount == null ? '<span class="muted" style="font-family:var(--body);font-size:.84rem">Amount varies</span>' : fmtINR(d.r.amount)}</span>
        <span class="acts"><button class="btn small ghost" data-act="dueSkip" data-id="${d.r.id}" data-k="${d.key}">Skip</button><button class="btn small primary" data-act="dueAdd" data-id="${d.r.id}" data-k="${d.key}">${d.r.amount == null ? 'Enter' : 'Add'}</button></span></div>`).join('')}
      ${due.length > 6 ? `<button class="linkbtn" data-act="goRecurring">${due.length - 6} more</button>` : ''}</section>` : ''}
    <section class="cards" aria-label="Month summary">
      ${card('Family income', t.income, t.hasIncome ? active().length + ' members' : `<button class="linkbtn" data-act="go" data-v="income">Add income</button>`, t.hasIncome, null, t.hasIncome && cmp && !cmp.partial ? delta(cmp.income, true) : '')}
      ${card('Necessary', t.need, t.nExp ? 'Essentials' : 'No expenses yet', t.nExp > 0, 'var(--need)', cmp ? delta(cmp.need, false) : '')}
      ${card('Lifestyle', t.life, 'Personal spending', t.nExp > 0, 'var(--life)', cmp ? delta(cmp.life, false) : '')}
      ${card('Total expenses', t.total, t.uns ? `incl. ${fmtINR(t.uns)} not sorted` : t.nExp + ' record' + (t.nExp === 1 ? '' : 's'), t.nExp > 0, null, cmp && !t.uns ? delta(cmp.total, false) : '')}
      ${card('Savings', t.save, t.nSave + ' entr' + (t.nSave === 1 ? 'y' : 'ies'), t.nSave > 0, 'var(--save)', cmp ? delta(cmp.save, true) : '')}
      ${rb.started ? `<div class="card"><span class="label">Total balance</span><span class="v ${rb.total > 0 ? 'pos' : rb.total < 0 ? 'neg' : ''}">${fmtINR(rb.total)}</span><span class="s">Incl. earlier months</span></div>` : ''}
    </section>
    ${cmp && cmp.cats.length && t.nExp ? `<section class="panel"><div class="phead"><div><h2>Compared with ${cmp.partial ? '1–' + cmp.cutDay + ' ' : ''}${FULL[cmp.pm]}</h2><p>Biggest changes in spending${cmp.partial ? ' for the same days' : ''}</p></div></div>
      <div class="cmp">${cmp.cats.slice(0, 4).map(c => `<div class="cmprow"><span class="tag ${c.type}">${KINDS[c.type]}</span><strong>${esc(c.name)}</strong><span class="num muted">${fmtINR(c.before)} → ${fmtINR(c.now)}</span><span class="num ${c.diff > 0 ? 'neg' : 'pos'}">${c.diff > 0 ? '▲' : '▼'} ${fmtINR(Math.abs(c.diff))}</span></div>`).join('')}</div>
      <p class="muted" style="margin:0;font-size:.84rem">Spending ${cmp.total.diff > 0 ? 'is up' : cmp.total.diff < 0 ? 'is down' : 'is the same'}${cmp.total.diff ? ' by ' + fmtINR(Math.abs(cmp.total.diff)) : ''} overall.</p></section>` : ''}
    ${st.length ? `<section class="panel"><div class="phead"><div><h2>Spending limits</h2><p>${attention ? attention + ' need attention' : 'All within limits'}</p></div><button class="linkbtn" data-act="goLimits">Manage</button></div>${limitsBlock(y, m, 3)}</section>` : ''}
    <section class="panel"><div class="phead"><div><h2>Recent transactions</h2><p>${FULL[m]} ${y}</p></div></div>
      ${recent.length ? recent.map(([e, k]) => txRow(e, k)).join('') : `<div class="empty"><b>Nothing recorded in ${FULL[m]}</b>Tap + Expense when you spend money.</div>`}
    </section>`;
  }

  /* ---------- EXPENSES ---------- */
  function grouped(list, kind) {
    const days = {}; list.forEach(e => { (days[e.date] = days[e.date] || []).push(e); });
    return Object.entries(days).map(([d, es]) => `<div><div class="dayhead"><span>${fmtDate(d)}</span><span class="num">${fmtINR(L.sum(es))}</span></div>${es.map(e => txRow(e, kind)).join('')}</div>`).join('');
  }
  const byNewest = (a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0);
  const isUpi = e => e.mode === 'UPI';
  function vExpenses() {
    const y = ui.year, m = ui.month, all = L.inMonth(S.expenses, y, m);
    const pay = ui.pay === 'upi' ? 'upi' : 'cash';
    const cash = all.filter(e => !isUpi(e)), upi = all.filter(isUpi);
    const tabs = `<div class="seg paytabs" role="tablist" aria-label="Payment type">
      <button role="tab" aria-selected="${pay === 'cash'}" class="${pay === 'cash' ? 'on' : ''}" data-act="payTab" data-v="cash">Cash · <span class="num">${short(L.sum(cash))}</span></button>
      <button role="tab" aria-selected="${pay === 'upi'}" class="${pay === 'upi' ? 'on' : ''}" data-act="payTab" data-v="upi">UPI · <span class="num">${short(L.sum(upi))}</span></button></div>`;
    if (pay === 'upi') return header('Expenses', 'month') + tabs + vUpiTab(upi);
    const list = cash.filter(e => ui.xf === 'all' || e.type === ui.xf).sort(byNewest);
    const chip = (k, l, v) => `<button class="chip ${ui.xf === k ? 'on' : ''}" data-act="xf" data-f="${k}">${l} · <span class="num">${short(v)}</span></button>`;
    return header('Expenses', 'month') + tabs + `<section class="panel">
      <div class="chips">${chip('all', 'All', L.sum(cash))}${chip('need', 'Necessary', L.sum(cash, 'need'))}${chip('life', 'Lifestyle', L.sum(cash, 'life'))}</div>
      ${list.length ? grouped(list, 'exp') : `<div class="empty"><b>No cash expenses in ${FULL[m]} ${y}</b>Tap + Expense to add what you spent in cash.</div>`}
    </section>`;
  }
  /* UPI tab: payments added automatically from this phone's payment notifications. */
  function vUpiTab(list) {
    if (Native) { Native.clearAlerts().catch(() => {}); const now = Date.now(); if (!ui.natAt || now - ui.natAt > 5000) { ui.natAt = now; refreshNative().then(() => { if (ui.view === 'expenses' && ui.pay === 'upi') render(); }); } }
    const needs = S.expenses.filter(e => e.type === 'uns');
    const sorted = list.filter(e => e.type !== 'uns').sort(byNewest);
    return upiSetupCard()
      + (needs.length ? `<section class="panel needscat"><div class="phead"><div><h2>Needs a category</h2><p>${needs.length} payment${needs.length === 1 ? '' : 's'} added automatically · tap to choose a category</p></div></div>${needs.sort(byNewest).map(e => txRow(e, 'exp')).join('')}</section>` : '')
      + `<section class="panel"><div class="phead"><div><h2>UPI payments · ${FULL[ui.month]}</h2><p>${sorted.length} with a category${sorted.some(e => e.catAuto) ? ' · ⟳ = category remembered' : ''}</p></div></div>
      ${sorted.length ? grouped(sorted, 'exp') : `<div class="empty"><b>No UPI payments yet</b>${IS_NATIVE ? 'Payments you make with GPay, PhonePe, Paytm, BHIM or CRED appear here by themselves.' : 'Payments appear here automatically in the Family Ledger Android app.'}</div>`}</section>` + rememberedList();
  }
  /* Shows what the phone has actually delivered, so a missed payment can be traced. */
  function detectionCheck(n) {
    const seen = n.seenApps || {}, rows = Object.entries(seen).sort((a, b) => (b[1].last || 0) - (a[1].last || 0));
    const known = pkg => { const k = L.sourceOfPkg(pkg); return k ? L.UPI_SOURCES[k].name : null; };
    const watching = pkg => !!(L.sourceOfPkg(pkg) || (S.upi.extraPkgs || []).includes(pkg));
    return `<details class="detcheck" ${rows.length ? '' : 'open'}><summary><strong>Detection check</strong> <span class="muted">· ${n.connectedAt ? 'reader running' : 'reader not started yet'}</span></summary>
      ${n.connectedAt ? '' : '<p class="flag">Android has not started the payment reader yet. Turn notification access for Family Ledger off and on again, or restart the phone.</p>'}
      ${rows.length ? `<p class="muted" style="margin:6px 0;font-size:.84rem">Apps that showed a ₹ notification since you turned this on:</p>
        ${rows.map(([pkg, o]) => `<div class="rowline"><span><strong>${esc(known(pkg) || o.label || pkg)}</strong> <span class="muted">· ${o.n} · last ${fmtStamp(o.last)}</span><br><span class="muted" style="font-size:.76rem">${esc(pkg)}</span></span>
          ${watching(pkg) ? '<span class="pos" style="font-size:.84rem">Watching</span>' : `<button class="btn small" data-act="watchPkg" data-p="${esc(pkg)}">Watch this app</button>`}</div>`).join('')}`
        : '<p class="muted" style="margin:6px 0;font-size:.86rem">No ₹ notification has reached Family Ledger yet. Make a payment, then come back here. If nothing appears, your UPI app did not show a notification and your bank SMS app may be turned off for notifications.</p>'}
    </details>`;
  }
  function askRememberSheet(a) {
    ui.pendingRemember = a;
    sheet(`<h3>Change for future payments too?</h3>
      <p>Payments to <strong style="color:var(--ink)">${esc(a.payee)}</strong> usually go to <strong style="color:var(--ink)">${esc(a.from)}</strong>. You changed this one to <strong style="color:var(--ink)">${esc(a.to)}</strong>.</p>
      <div class="choices">
        <button class="choice" data-act="rememberOnlyThis"><strong>Only this payment</strong><span>Future payments to ${esc(a.payee)} still go to ${esc(a.from)}.</span></button>
        <button class="choice" data-act="rememberAll"><strong>All future payments</strong><span>From now on, payments to ${esc(a.payee)} go to ${esc(a.to)}.</span></button>
      </div>`);
  }
  /* Remembered people: shown in the UPI tab so a wrong choice can be forgotten. */
  function rememberedList() {
    const rows = Object.entries(S.upi.payeeCat || {}).map(([k, m]) => ({ k, m, c: L.cat(S, m.catId) })).filter(x => x.c && !x.c.archived && (x.c.kind === 'need' || x.c.kind === 'life'))
      .sort((a, b) => (b.m.t || 0) - (a.m.t || 0));
    if (!rows.length) return '';
    return `<section class="panel"><details><summary><strong>Remembered categories</strong> <span class="muted">· ${rows.length} ${rows.length === 1 ? 'person' : 'people'}</span></summary>
      <p class="muted" style="margin:6px 0;font-size:.84rem">Payments to these people get their category automatically. To change one, edit any of their payments.</p>
      ${rows.map(x => `<div class="rowline"><span><strong>${esc(x.m.name || x.k)}</strong><br><span class="muted" style="font-size:.82rem"><span class="tag ${x.c.kind}">${KINDS[x.c.kind]}</span> ${esc(x.c.name)}${x.m.subId ? ' › ' + esc(L.subName(S, x.c.id, x.m.subId)) : ''}</span></span><button class="btn small ghost" data-act="forgetPayee" data-k="${esc(x.k)}">Forget</button></div>`).join('')}
    </details></section>`;
  }
  function upiSetupCard() {
    if (!Native) return `<section class="panel"><div class="phead"><div><h2>Automatic UPI</h2><p>In the Family Ledger Android app, every UPI payment you make is added here automatically. This browser version cannot read payment notifications.</p></div></div></section>`;
    const n = ui.nat || {}, granted = !!n.permission;
    if (S.upi.enabled && granted) return `<section class="panel upion"><div class="phead"><div><h2>Automatic UPI is on</h2><p>Every payment from GPay, PhonePe, Paytm, BHIM, CRED or a bank debit SMS is added here within seconds.</p></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${n.alerts ? '' : '<button class="btn small" data-act="allowAlerts">Show an alert when a payment is added</button>'}
        <label class="field" style="flex:1;min-width:180px"><span>Payments on this phone are made by</span><select id="upi-owner">${active().map(p => `<option value="${p.id}" ${p.id === upiOwner() ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
      ${detectionCheck(n)}
      <div><button class="linkbtn" data-act="upiPause">Turn off automatic UPI</button></div></section>`;
    return `<section class="panel upisetup"><div class="phead"><div><h2>Turn on automatic UPI</h2><p>One-time setup. After this, every UPI payment you make is added here by itself. Android asks you to allow it once.</p></div></div>
      <ol class="steps"><li class="${S.upi.enabled ? 'done' : ''}">Tap <strong>Turn on</strong></li><li class="${granted ? 'done' : ''}">On the next screen, switch on <strong>Family Ledger</strong>, then come back</li></ol>
      ${n.sdk >= 33 && S.upi.enabled && !granted ? `<p class="muted" style="margin:0;font-size:.84rem">If the switch is greyed out or says "Restricted setting": tap <strong>Open App info</strong> → ⋮ (top right) → <strong>Allow restricted settings</strong>, then try again.</p>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="upiTurnOn">${S.upi.enabled ? 'Allow access' : 'Turn on'}</button>${n.sdk >= 33 && S.upi.enabled && !granted ? '<button class="btn" data-act="openAppInfo">Open App info</button>' : ''}</div></section>`;
  }

  /* ---------- SAVINGS ---------- */
  function vSavings() {
    const y = ui.year, m = ui.month, list = L.inMonth(S.savings, y, m).sort(byNewest), yt = L.yearTotals(S, y);
    const cats = L.byCat(S, list), tot = L.sum(list);
    return header('Savings', 'month') + `
    <section class="cards">
      <div class="card"><span class="label"><i class="sw" style="background:var(--save)"></i>${MONTHS[m]} savings</span>${list.length ? `<span class="v">${fmtINR(tot)}</span>` : '<span class="v nil">Not recorded</span>'}<span class="s">${list.length} entr${list.length === 1 ? 'y' : 'ies'}</span></div>
      <div class="card"><span class="label">${y} so far</span><span class="v">${fmtINR(yt.save)}</span><span class="s">From saved entries</span></div>
    </section>
    ${cats.length ? `<section class="panel"><div class="phead"><div><h2>By category</h2><p>${FULL[m]} ${y}</p></div></div><ol class="toplist">${cats.map(c => `<li><div class="r1"><span><strong>${esc(c.name)}</strong></span><span class="num">${fmtINR(c.v)} <span class="muted">${pct(c.v, tot)}%</span></span></div><div class="track"><i style="width:${c.v / cats[0].v * 100}%;background:var(--save)"></i></div></li>`).join('')}</ol></section>` : ''}
    <section class="panel"><div class="phead"><div><h2>Savings entries</h2><p>Money set aside on purpose. It lowers your available balance but is not an expense.</p></div></div>
      ${list.length ? grouped(list, 'save') : `<div class="empty"><b>No savings recorded in ${FULL[m]}</b>Tap + Savings each time you put money aside. You can add as many entries as you like.</div>`}
    </section>`;
  }

  /* ---------- INCOME ---------- */
  function vIncome() {
    const y = ui.year, m = ui.month, pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
    return header('Income', 'month') + `
    <section class="panel">
      <div class="phead"><div><h2>${FULL[m]} ${y} income</h2><p>Type each person's income. Leave blank if not known.</p></div>
        <button class="btn small" data-act="copyPrev" ${L.hasIncome(S, py, pm) ? '' : 'disabled'}>Copy ${MONTHS[pm]}</button></div>
      <div>${entryRows()}</div>
      <div class="entryfoot"><span class="muted">Family total <strong class="num" id="drafttot" style="color:var(--ink)">${fmtINR(Object.values(ui.draft).reduce((a, e) => a + L.amt(e), 0))}</strong></span>
        <span style="display:flex;gap:8px"><button class="btn ghost" data-act="discard" ${ui.dirty ? '' : 'hidden'}>Discard</button><button class="btn primary" data-act="saveIncome" id="savebtn" ${ui.dirty ? '' : 'disabled'}>Save ${MONTHS[m]}</button></span></div>
    </section>
    <section class="panel"><div class="phead"><div><h2>Income history ${y}</h2><p>· not entered &nbsp; — no income</p></div></div>${incomeTable(y)}</section>
    <section class="panel">
      <div class="phead"><div><h2>Family members</h2><p>Renaming keeps all history. Archived people stay in reports.</p></div></div>
      <div class="people">
        ${active().map(p => `<div class="pcard"><div class="pt"><i class="dot" style="background:${p.color}"></i><strong>${esc(p.name)}</strong></div>
          <div class="acts"><button class="btn small" data-act="rename" data-id="${p.id}">Rename</button><button class="btn danger small" data-act="removePerson" data-id="${p.id}" ${active().length <= 1 ? 'disabled' : ''}>Remove</button></div></div>`).join('')}
        <button class="addcard" data-act="addPerson">+ Add person</button>
      </div>
      ${S.people.some(p => p.archived) ? `<span class="label">Archived</span>${S.people.filter(p => p.archived).map(p => `<div class="rowline"><span><i class="dot" style="background:${p.color}"></i> ${esc(p.name)}</span><span style="display:flex;gap:6px"><button class="btn small" data-act="restorePerson" data-id="${p.id}">Restore</button><button class="btn danger small" data-act="purgePerson" data-id="${p.id}">Delete</button></span></div>`).join('')}` : ''}
    </section>`;
  }
  function entryRows() {
    const rows = S.people.filter(p => !p.archived || ui.draft[p.id]);
    return rows.map(p => {
      const e = ui.draft[p.id] || {}, none = !!e.none, val = !none && typeof e.amount === 'number' ? e.amount : '';
      return `<div class="erow ${none ? 'none' : ''}" data-id="${p.id}">
        <div class="who"><i class="dot" style="background:${p.color}"></i><span>${esc(p.name)}${p.archived ? ' <small>archived</small>' : ''}</span></div>
        <label class="money"><b>₹</b><input id="amt-${p.id}" inputmode="numeric" enterkeyhint="next" placeholder="Amount" value="${val}" data-in="amount" ${none ? 'disabled' : ''} aria-label="${esc(p.name)} income"></label>
        <button class="toggle ${none ? 'on' : ''}" data-act="noIncome" data-id="${p.id}" aria-pressed="${none}">No income</button>
        <button class="xbtn" data-act="clearIncome" data-id="${p.id}" ${ui.draft[p.id] ? '' : 'disabled'} aria-label="Delete ${esc(p.name)}'s record">×</button>
        <input class="note" id="note-${p.id}" placeholder="Note (optional)" value="${esc(e.note || '')}" data-in="note" aria-label="${esc(p.name)} note">
      </div>`;
    }).join('');
  }
  function incomeTable(y) {
    const rows = S.people.filter(p => !p.archived || MONTHS.some((_, i) => (S.records[mk(y, i)] || {})[p.id]));
    const any = MONTHS.some((_, i) => L.hasIncome(S, y, i));
    if (!any) return `<div class="empty">No income saved for ${y} yet.</div>`;
    return `<div class="tablebox"><table class="rep"><thead><tr><th>Person</th>${MONTHS.map((n, i) => `<th class="${i === ui.month ? 'sel' : ''}">${n}</th>`).join('')}<th>Total</th></tr></thead><tbody>
      ${rows.map(p => { let tot = 0; return `<tr><td>${esc(p.name)}</td>${MONTHS.map((_, i) => { const e = (S.records[mk(y, i)] || {})[p.id], c = i === ui.month ? ' sel' : ''; if (!e) return `<td class="blank${c}">·</td>`; if (e.none) return `<td class="blank${c}">—</td>`; tot += e.amount; return `<td class="n${c}">${plain(e.amount)}</td>`; }).join('')}<td class="n">${plain(tot)}</td></tr>`; }).join('')}
      <tr class="total"><td>Family</td>${MONTHS.map((_, i) => `<td class="n">${L.hasIncome(S, y, i) ? plain(L.incomeMonth(S, y, i)) : ''}</td>`).join('')}<td class="n">${plain(L.yearTotals(S, y).income)}</td></tr>
    </tbody></table></div>`;
  }

  /* ---------- CHARTS ---------- */
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  function scale(max) { const step = niceStep(Math.max(max, 1) / 4); return { step, top: Math.ceil(Math.max(max, 1) / step) * step }; }
  function frame(W, H, Lp, T, B, R, top, step) {
    const ch = H - B - T, sy = v => T + ch - (v / top) * ch; let g = '', ax = '';
    for (let v = 0; v <= top + step / 2; v += step) { g += `<line x1="${Lp}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/>`; ax += `<text x="${Lp - 8}" y="${sy(v) + 4}" text-anchor="end">${v ? short(v) : '0'}</text>`; }
    return { sy, svg: `<g class="grid">${g}</g><g class="axis">${ax}</g>` };
  }
  const monthLabels = (W, H, Lp, cw) => MONTHS.map((n, i) => `<text x="${Lp + i * cw + cw / 2}" y="${H - 8}" text-anchor="middle" fill="${i === ui.month ? 'var(--ink)' : 'var(--muted)'}" font-family="var(--mono)" font-size="11" font-weight="${i === ui.month ? 700 : 400}">${n}</text>`).join('');
  function pie(items, emptyMsg, label) {
    const total = items.reduce((a, x) => a + x.v, 0);
    if (!total) return `<div class="empty"><b>No data</b>${emptyMsg}</div>`;
    let parts = items.slice().sort((a, b) => b.v - a.v).map((x, i) => ({ ...x, color: COLORS[i % COLORS.length] }));
    if (parts.length > 7) { const rest = parts.slice(6); parts = parts.slice(0, 6); parts.push({ label: 'Others (' + rest.length + ')', v: rest.reduce((a, x) => a + x.v, 0), color: '#8A94A0' }); }
    const R = 70, C = 2 * Math.PI * R; let off = 0;
    const segs = parts.map(x => { const len = x.v / total * C; const s = `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${x.color}" stroke-width="28" stroke-dasharray="${Math.max(len - (parts.length > 1 ? 2 : 0), 0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"/>`; off += len; return s; }).join('');
    return `<div class="donutwrap"><svg class="donut" viewBox="0 0 200 200" role="img" aria-label="${esc(label)}"><circle r="${R}" cx="100" cy="100" fill="none" stroke="var(--sunk)" stroke-width="28"/>${segs}
      <text x="100" y="96" text-anchor="middle" fill="var(--muted)" font-size="11" font-family="var(--body)">TOTAL</text><text x="100" y="117" text-anchor="middle" fill="var(--ink)" font-size="18" font-family="var(--mono)">${short(total)}</text></svg>
      <table class="legend">${parts.map(x => `<tr><td><span class="nm"><i class="dot" style="background:${x.color}"></i>${esc(x.label)}</span></td><td class="n">${fmtINR(x.v)}</td><td class="p">${pct(x.v, total)}%</td></tr>`).join('')}</table></div>`;
  }
  function groupedBars(y) {
    const s = L.yearSeries(S, y), max = Math.max(...s.map(x => x.total));
    const W = 680, H = 240, Lp = 54, T = 12, B = 28, R = 8, { top, step } = scale(max), f = frame(W, H, Lp, T, B, R, top, step), cw = (W - Lp - R) / 12, bw = Math.min(13, cw * .24);
    let b = ''; s.forEach((x, i) => { const cx = Lp + i * cw + cw / 2;
      [[x.need, 'var(--need)', 'Necessary'], [x.life, 'var(--life)', 'Lifestyle'], [x.total, 'var(--ink)', 'Total']].forEach(([v, c, n], j) => { if (v > 0) { const yy = f.sy(v); b += `<rect x="${cx - 1.5 * bw - 1 + j * (bw + 1)}" y="${yy}" width="${bw}" height="${f.sy(0) - yy}" fill="${c}" rx="2"><title>${MONTHS[i]} ${n}: ${fmtINR(v)}</title></rect>`; } }); });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly spending ${y}">${f.svg}${b}${monthLabels(W, H, Lp, cw)}</svg>`;
  }
  function lastMonthIdx(y, s, key) { let last = -1; s.forEach((x, i) => { if (key(x)) last = i; }); const n = new Date(); if (y === n.getFullYear()) last = Math.max(last, n.getMonth()); else if (y < n.getFullYear() && last >= 0) last = 11; return last; }
  function trendLines(y) {
    const s = L.yearSeries(S, y), last = lastMonthIdx(y, s, x => x.nExp), max = Math.max(...s.map(x => x.total));
    const W = 680, H = 240, Lp = 54, T = 14, B = 28, R = 12, { top, step } = scale(max), f = frame(W, H, Lp, T, B, R, top, step), cw = (W - Lp - R) / 12, px = i => Lp + i * cw + cw / 2;
    const line = (k, c, w) => { const pts = s.slice(0, last + 1).map((x, i) => [px(i), f.sy(x[k])]); if (!pts.length) return '';
      return `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === last ? 4.5 : 3}" fill="${c}"><title>${MONTHS[i]}: ${fmtINR(s[i][k])}</title></circle>`).join(''); };
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending trend ${y}">${f.svg}${line('need', 'var(--need)', 2)}${line('life', 'var(--life)', 2)}${line('total', 'var(--ink)', 2.5)}${monthLabels(W, H, Lp, cw)}</svg>`;
  }
  function savingsBars(y) {
    const s = L.yearSeries(S, y), max = Math.max(...s.map(x => x.save));
    const W = 680, H = 220, Lp = 54, T = 12, B = 28, R = 8, { top, step } = scale(max), f = frame(W, H, Lp, T, B, R, top, step), cw = (W - Lp - R) / 12, bw = Math.min(28, cw * .5);
    let b = ''; s.forEach((x, i) => { const cx = Lp + i * cw + cw / 2;
      if (x.save > 0) { const yy = f.sy(x.save); b += `<rect x="${cx - bw / 2}" y="${yy}" width="${bw}" height="${f.sy(0) - yy}" fill="var(--save)" rx="3"><title>${MONTHS[i]} savings: ${fmtINR(x.save)}</title></rect>`; }
      else if (!x.nSave) b += `<rect x="${cx - bw / 2}" y="${f.sy(0) - 2}" width="${bw}" height="2" fill="var(--line)"/>`; });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly savings ${y}">${f.svg}${b}${monthLabels(W, H, Lp, cw)}</svg>`;
  }
  function stackedYear(y) {
    const s = L.yearSeries(S, y), max = Math.max(...s.map(x => Math.max(x.total, x.income)));
    const W = 680, H = 250, Lp = 54, T = 12, B = 28, R = 8, { top, step } = scale(max), f = frame(W, H, Lp, T, B, R, top, step), cw = (W - Lp - R) / 12, bw = Math.min(28, cw * .52);
    let b = ''; s.forEach((x, i) => { const x0 = Lp + i * cw + cw / 2 - bw / 2;
      if (x.need > 0) { const yy = f.sy(x.need); b += `<rect x="${x0}" y="${yy}" width="${bw}" height="${f.sy(0) - yy}" fill="var(--need)"><title>${MONTHS[i]} necessary: ${fmtINR(x.need)}</title></rect>`; }
      if (x.life > 0) { const y1 = f.sy(x.need + x.life); b += `<rect x="${x0}" y="${y1}" width="${bw}" height="${f.sy(x.need) - y1}" fill="var(--life)"><title>${MONTHS[i]} lifestyle: ${fmtINR(x.life)}</title></rect>`; }
      if (x.hasIncome) { const yy = f.sy(x.income); b += `<line x1="${x0 - 5}" x2="${x0 + bw + 5}" y1="${yy}" y2="${yy}" stroke="var(--good)" stroke-width="3" stroke-linecap="round"><title>${MONTHS[i]} income: ${fmtINR(x.income)}</title></line>`; } });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending by month ${y}">${f.svg}${b}${monthLabels(W, H, Lp, cw)}</svg>`;
  }
  const key = items => `<div class="ckey">${items.map(([l, c, ln]) => `<span><i class="${ln ? 'ln' : 'sw'}" style="background:${c}"></i>${l}</span>`).join('')}</div>`;
  function topList(cats, tot) {
    return `<ol class="toplist">${cats.slice(0, 8).map(c => `<li><div class="r1"><span><span class="tag ${c.type}">${KINDS[c.type]}</span><strong>${esc(c.name)}</strong></span><span class="num">${fmtINR(c.v)} <span class="muted">${pct(c.v, tot)}%</span></span></div><div class="track"><i style="width:${c.v / cats[0].v * 100}%;background:var(--${c.type})"></i></div></li>`).join('')}</ol>`;
  }

  /* ---------- ANALYTICS ---------- */
  function vAnalytics() {
    const y = ui.year, m = ui.month, yr = ui.aMode === 'year';
    const ex = yr ? L.inYear(S.expenses, y) : L.inMonth(S.expenses, y, m), sv = yr ? L.inYear(S.savings, y) : L.inMonth(S.savings, y, m);
    const period = yr ? 'Full year ' + y : FULL[m] + ' ' + y;
    const cats = L.byCat(S, ex), tot = L.sum(ex), anyYear = L.inYear(S.expenses, y).length > 0, anySaveYear = L.inYear(S.savings, y).length > 0;
    return header('Analytics', 'month') + `
    <div class="seg" role="group" aria-label="Period"><button class="${!yr ? 'on' : ''}" data-act="aMode" data-v="month">${FULL[m]}</button><button class="${yr ? 'on' : ''}" data-act="aMode" data-v="year">Full year ${y}</button></div>
    <section class="panel"><div class="phead"><div><h2>Necessary expenses</h2><p>${period}</p></div></div>
      ${pie(cats.filter(c => c.type === 'need').map(c => ({ label: c.name, v: c.v })), 'No necessary expenses in this period.', 'Necessary expenses by category')}</section>
    <section class="panel"><div class="phead"><div><h2>Lifestyle expenses</h2><p>${period}</p></div></div>
      ${pie(cats.filter(c => c.type === 'life').map(c => ({ label: c.name, v: c.v })), 'No lifestyle expenses in this period.', 'Lifestyle expenses by category')}</section>
    <section class="panel"><div class="phead"><div><h2>Top spending categories</h2><p>${period} · ${fmtINR(tot)} spent</p></div></div>
      ${cats.length ? topList(cats, tot) : `<div class="empty"><b>No data</b>Add expenses to see where the money goes.</div>`}</section>
    <section class="panel"><div class="phead"><div><h2>Monthly spending ${y}</h2></div>${key([['Necessary', 'var(--need)'], ['Lifestyle', 'var(--life)'], ['Total', 'var(--ink)']])}</div>
      ${anyYear ? `<div class="chartbox">${groupedBars(y)}</div>` : `<div class="empty"><b>No expenses in ${y}</b>This chart fills in as you add expenses.</div>`}</section>
    <section class="panel"><div class="phead"><div><h2>Spending trend ${y}</h2></div>${key([['Total', 'var(--ink)', 1], ['Necessary', 'var(--need)', 1], ['Lifestyle', 'var(--life)', 1]])}</div>
      ${anyYear ? `<div class="chartbox">${trendLines(y)}</div>` : `<div class="empty"><b>No expenses in ${y}</b>Add expenses to see the trend.</div>`}</section>
    <section class="panel"><div class="phead"><div><h2>Savings by category</h2><p>${period}</p></div></div>
      ${pie(L.byCat(S, sv).map(c => ({ label: c.name, v: c.v })), 'No savings recorded in this period.', 'Savings by category')}</section>
    <section class="panel"><div class="phead"><div><h2>Monthly savings ${y}</h2><p>Actual savings recorded each month</p></div></div>
      ${anySaveYear ? `<div class="chartbox">${savingsBars(y)}</div>` : `<div class="empty"><b>No savings in ${y}</b>Record savings on the Savings screen.</div>`}</section>`;
  }

  /* ---------- REPORTS ---------- */
  function breakdown(list, kind, total) {
    const c = L.byCat(S, list);
    if (!c.length) return `<div class="empty">Nothing recorded.</div>`;
    return `<table class="legend">${c.map(x => `<tr><td><span class="nm">${esc(x.name)}</span><div class="track" style="margin-top:4px"><i style="width:${x.v / c[0].v * 100}%;background:var(--${kind})"></i></div></td><td class="n">${fmtINR(x.v)}</td><td class="p">${pct(x.v, total)}%</td></tr>`).join('')}</table>`;
  }
  function vReports() {
    const y = ui.year, s = L.yearSeries(S, y), t = L.yearTotals(S, y), ex = L.inYear(S.expenses, y), sv = L.inYear(S.savings, y);
    const any = ex.length || sv.length || t.monthsWithIncome;
    const tile = (l, v, sub, cls) => `<div class="card"><span class="label">${l}</span><span class="v ${cls || ''}">${fmtINR(v)}</span><span class="s">${sub}</span></div>`;
    const log = S.limitLog.filter(x => x.month.slice(0, 4) === String(y));
    return header('Annual report', 'year') + `
    <div class="noprint" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="csv">Export CSV</button><button class="btn" data-act="print">Print / Save PDF</button></div>
    <section class="cards" aria-label="Annual totals">
      ${tile('Total income', t.income, t.monthsWithIncome + ' months recorded')}
      ${tile('<i class="sw" style="background:var(--need)"></i>Necessary', t.need, pct(t.need, t.total) + '% of expenses')}
      ${tile('<i class="sw" style="background:var(--life)"></i>Lifestyle', t.life, pct(t.life, t.total) + '% of expenses')}
      ${tile('Total expenses', t.total, ex.length + ' records')}
      ${tile('<i class="sw" style="background:var(--save)"></i>Savings', t.save, sv.length + ' entries')}
      ${tile('Available balance', t.bal, 'Income − expenses − savings', t.bal > 0 ? 'pos' : t.bal < 0 ? 'neg' : '')}
    </section>
    <section class="panel"><div class="phead"><div><h2>Monthly summary ${y}</h2><p>· nothing recorded. Running = balance carried forward to the end of that month.</p></div></div>
      <div class="tablebox"><table class="rep"><thead><tr><th>Month</th><th>Income</th><th>Necessary</th><th>Lifestyle</th><th>Total exp.</th><th>Savings</th><th>Balance</th><th>Running</th></tr></thead><tbody>
      ${s.map((x, i) => { const rb = L.runningBalance(S, y, i); const run = rb.started ? `<td class="n ${rb.total < 0 ? 'neg' : ''}">${plain(rb.total)}</td>` : '<td class="blank">·</td>'; return `<tr><td>${FULL[i]}</td>${x.empty ? '<td class="blank">·</td>'.repeat(6) : `<td class="n">${x.hasIncome ? plain(x.income) : '·'}</td><td class="n">${plain(x.need)}</td><td class="n">${plain(x.life)}</td><td class="n">${plain(x.total)}</td><td class="n">${plain(x.save)}</td><td class="n ${x.bal > 0 ? 'pos' : x.bal < 0 ? 'neg' : ''}">${plain(x.bal)}</td>`}${run}</tr>`; }).join('')}
      <tr class="total"><td>Total</td><td class="n">${plain(t.income)}</td><td class="n">${plain(t.need)}</td><td class="n">${plain(t.life)}</td><td class="n">${plain(t.total)}</td><td class="n">${plain(t.save)}</td><td class="n">${plain(t.bal)}</td><td class="n">${(() => { const rb = L.runningBalance(S, y, 11); return rb.started ? plain(rb.total) : ''; })()}</td></tr>
      </tbody></table></div></section>
    <section class="panel"><div class="phead"><div><h2>Monthly spending comparison</h2></div>${key([['Necessary', 'var(--need)'], ['Lifestyle', 'var(--life)'], ['Income', 'var(--good)', 1]])}</div>
      ${any ? `<div class="chartbox">${stackedYear(y)}</div>` : `<div class="empty"><b>No records for ${y}</b>Add income, expenses and savings to build this report.</div>`}</section>
    <section class="panel"><div class="phead"><div><h2>Necessary by category</h2><p>${fmtINR(t.need)}</p></div></div>${breakdown(ex.filter(e => e.type === 'need'), 'need', t.need)}</section>
    <section class="panel"><div class="phead"><div><h2>Lifestyle by category</h2><p>${fmtINR(t.life)}</p></div></div>${breakdown(ex.filter(e => e.type === 'life'), 'life', t.life)}</section>
    <section class="panel"><div class="phead"><div><h2>Savings by category</h2><p>${fmtINR(t.save)}</p></div></div>${breakdown(sv, 'save', t.save)}</section>
    <section class="panel"><div class="phead"><div><h2>Monthly savings trend</h2></div></div>${sv.length ? `<div class="chartbox">${savingsBars(y)}</div>` : '<div class="empty">No savings recorded this year.</div>'}</section>
    <section class="panel"><div class="phead"><div><h2>Spending-limit history</h2><p>Alerts recorded in ${y}</p></div></div>
      ${log.length ? `<div class="tablebox"><table class="rep"><thead><tr><th>Month</th><th>Limit</th><th>Spent</th><th>Status</th></tr></thead><tbody>${log.map(x => `<tr><td>${FULL[+x.month.slice(5) - 1]}</td><td>${esc(x.label)} · ${plain(x.limit)}</td><td class="n">${plain(x.spent)}</td><td class="${x.level === 'over' ? 'neg' : ''}">${x.level === 'over' ? 'Over by ' + plain(x.spent - x.limit) : 'Reached'}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${S.limits.enabled ? 'No limits were reached this year.' : 'Spending Limit Alerts are off. Turn them on in Settings.'}</div>`}</section>`;
  }

  /* ---------- SETTINGS ---------- */
  function vSettings() {
    const y = ui.year, m = ui.month, k = ui.catTab;
    const list = S.cats.filter(c => c.kind === k);
    const scopeOpts = `<option value="total">Total monthly expenses</option><option value="need">Necessary expenses</option><option value="life">Lifestyle expenses</option>
      <optgroup label="Necessary categories">${activeCats('need').map(c => `<option value="cat:${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>
      <optgroup label="Lifestyle categories">${activeCats('life').map(c => `<option value="cat:${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;
    const notifSupported = 'Notification' in window;
    let hasBackup = false; try { hasBackup = !!localStorage.getItem(BACKUP_KEY); } catch (e) {}
    return header('Settings') + `
    <section class="panel" id="limits">
      <label class="switch"><span><strong>Spending Limit Alerts</strong><br><span class="muted" style="font-size:.86rem">Warn me when spending reaches a limit. Never blocks entries.</span></span><input type="checkbox" data-act="toggleLimits" ${S.limits.enabled ? 'checked' : ''} aria-label="Spending Limit Alerts"></label>
      ${S.limits.enabled ? `
        <div class="phead"><div><h2>Limits for ${FULL[m]} ${y}</h2><p>Change the month at the top of any screen.</p></div></div>
        ${S.limits.items.length ? S.limits.items.slice().sort((a, b) => (a.month === '*' ? 0 : 1) - (b.month === '*' ? 0 : 1)).map(it => {
          const st = L.limitStatus(S, y, m).find(x => x.item.id === it.id);
          return `<div class="catrow"><div class="r1"><strong>${esc(L.limitLabel(S, it))}</strong><span class="num">${fmtINR(it.amount)}</span></div>
            <div class="muted" style="font-size:.84rem">${it.month === '*' ? 'Every month' : 'Only ' + FULL[+it.month.slice(5) - 1] + ' ' + it.month.slice(0, 4)}${st ? ` · ${fmtINR(st.spent)} spent, ${st.left >= 0 ? fmtINR(st.left) + ' left' : fmtINR(-st.left) + ' over'}` : it.on === false ? ' · Off' : ' · Not active this month'}</div>
            <div class="acts"><button class="btn small" data-act="toggleLimit" data-id="${it.id}">${it.on === false ? 'Turn on' : 'Turn off'}</button><button class="btn small" data-act="editLimit" data-id="${it.id}">Change</button><button class="btn danger small" data-act="delLimit" data-id="${it.id}">Delete</button></div></div>`;
        }).join('') : '<div class="muted">No limits yet. Add one below.</div>'}
        <div class="panel" style="background:var(--raised)"><h2>Add a limit</h2>
          <label class="field"><span>Limit for</span><select id="lim-scope">${scopeOpts}</select></label>
          <div class="frow"><label class="field"><span>Amount (₹)</span><input id="lim-amt" inputmode="decimal" placeholder="15000"></label>
          <label class="field"><span>Applies to</span><select id="lim-month"><option value="*">Every month</option><option value="${mk(y, m)}">Only ${MONTHS[m]} ${y}</option></select></label></div>
          <div class="err" id="lim-err"></div><button class="btn primary" data-act="addLimit">Add limit</button></div>
` : ''}
    </section>
    <section class="panel" id="recurring">
      <div class="phead"><div><h2>Repeating payments and bills</h2><p>Set once. Home reminds you when each is due, and you add it with one tap.</p></div><button class="btn small" data-act="newRecurring">+ Add</button></div>
      ${(S.recurring || []).length ? S.recurring.slice().sort((a, b) => a.day - b.day).map(r => { const nd = L.nextDue(S, r, today());
        return `<div class="catrow"><div class="r1"><strong>${esc(r.name)}</strong><span class="num">${r.amount == null ? '<span class="muted" style="font-family:var(--body)">Amount varies</span>' : fmtINR(r.amount)}</span></div>
        <div class="muted" style="font-size:.84rem"><span class="tag ${r.type}">${KINDS[r.type]}</span> ${esc(L.catName(S, r.catId))} · ${L.FREQ[r.freq].toLowerCase()} on day ${r.day}${r.paused ? ' · <strong>Paused</strong>' : nd ? ' · next ' + fmtDate(nd) : ''}</div>
        <div class="acts"><button class="btn small" data-act="editRecur" data-id="${r.id}">Edit</button><button class="btn small" data-act="pauseRecur" data-id="${r.id}">${r.paused ? 'Resume' : 'Pause'}</button><button class="btn danger small" data-act="delRecur" data-id="${r.id}">Delete</button></div></div>`; }).join('')
        : '<div class="muted">None yet. Tap + Add, or choose Repeat when you add an expense or savings entry.</div>'}
    </section>
    <section class="panel">
      <div class="phead"><div><h2>Starting balance</h2><p>Money you had in cash and bank at the start of a month. Each month's leftover balance is added on top of it.</p></div></div>
      <div class="frow"><label class="field"><span>Amount (₹)</span><input id="op-amt" inputmode="decimal" value="${S.opening ? S.opening.amount : ''}" placeholder="0"></label>
        <label class="field"><span>From the start of</span><input type="month" id="op-month" value="${S.opening ? S.opening.month : (L.firstMonthKey(S) || mk(y, m))}"></label></div>
      <div class="err" id="op-err"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="saveOpening">Save starting balance</button>${S.opening ? '<button class="btn ghost" data-act="clearOpening">Clear</button>' : ''}</div>
    </section>
    <section class="panel">
      <label class="switch"><span><strong>Phone notifications</strong><br><span class="muted" style="font-size:.86rem">${notifSupported ? 'Shows bills due today and limit alerts as phone notifications when you open the app. The app cannot send them while it is fully closed.' : 'Not supported on this browser. In-app reminders still work.'}</span></span><input type="checkbox" data-act="toggleNotify" ${S.notify ? 'checked' : ''} ${notifSupported ? '' : 'disabled'} aria-label="Phone notifications"></label>
    </section>
    <section class="panel" id="cats">
      <div class="phead"><div><h2>Categories</h2><p>Rename, add subcategories, archive or remove. Records are never lost.</p></div></div>
      <div class="seg" role="group" aria-label="Category list">${Object.entries(KINDS).map(([kk, l]) => `<button class="${k === kk ? 'on' : ''}" data-act="catTab" data-v="${kk}">${l}</button>`).join('')}</div>
      <div class="inline"><input id="newcat" placeholder="New ${KINDS[k].toLowerCase()} category" maxlength="40"><button class="btn primary" data-act="addCat">Add</button></div>
      <div class="err" id="cat-err"></div>
      <div>${list.filter(c => !c.archived).map(catRow).join('')}</div>
      ${list.some(c => c.archived) ? `<span class="label">Archived · hidden from new entries, kept in history</span><div>${list.filter(c => c.archived).map(catRow).join('')}</div>` : ''}
    </section>
    <section class="panel">
      <div class="phead"><div><h2>Backup and move data</h2><p>Data is saved on this phone only. It does not sync to other phones.</p></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="exportJSON">Download backup</button><button class="btn" data-act="copyJSON">Copy backup</button><button class="btn" data-act="csv">Export ${y} CSV</button></div>
      <label class="field"><span>Import from the web version or a backup file</span><input type="file" id="importFile" accept="application/json,.json,.txt"></label>
      <label class="field"><span>…or paste the copied data</span><textarea id="importText" class="paste" placeholder='Paste data starting with {"people":…'></textarea></label>
      <div class="err" id="imp-err"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="importPaste">Import pasted data</button>${hasBackup ? '<button class="btn ghost" data-act="undoImport">Undo last import</button>' : ''}</div>
      ${deferredInstall ? '<button class="btn" data-act="install">Install app on this phone</button>' : ''}
    </section>
    <section class="panel"><div class="phead"><div><h2>Sample data</h2><p>${S.sampleLoaded ? 'Example entries from January to today are loaded. Removing them keeps everything you entered yourself.' : 'Fill the app with a realistic family year to try every screen. It can be removed in one tap.'}</p></div>
      ${S.sampleLoaded ? '<button class="btn danger" data-act="removeSample">Remove sample data</button>' : '<button class="btn" data-act="loadSample">Load sample data</button>'}</div></section>
    <section class="panel"><div class="phead"><div><h2>Activity log</h2><p>Every change, newest first</p></div></div>
      <ul class="hist">${(ui.showAllLog ? S.log : S.log.slice(0, 10)).map(l => `<li><time>${fmtTime(l.t)}</time><span>${esc(l.msg)}</span></li>`).join('')}</ul>
      ${S.log.length > 10 ? `<button class="btn ghost" data-act="showLog">${ui.showAllLog ? 'Show less' : 'Show all ' + S.log.length}</button>` : ''}</section>`;
  }
  function catRow(c) {
    const uses = L.catUses(S, c.id), open = ui.openCat === c.id;
    return `<div class="catrow"><div class="r1"><strong>${esc(c.name)}</strong><span class="muted" style="font-size:.8rem">${uses} record${uses === 1 ? '' : 's'}${c.subs.length ? ' · ' + c.subs.filter(s => !s.archived).length + ' sub' : ''}</span></div>
      <div class="acts">${c.archived ? `<button class="btn small" data-act="restoreCat" data-id="${c.id}">Restore</button>` : `<button class="btn small" data-act="renameCat" data-id="${c.id}">Rename</button><button class="btn small" data-act="openCat" data-id="${c.id}" aria-expanded="${open}">Subcategories</button>`}<button class="btn danger small" data-act="removeCat" data-id="${c.id}">Remove</button></div>
      ${open ? `<div class="subs">${c.subs.map(s => `<div class="sub"><span>${esc(s.name)}${s.archived ? ' <span class="muted">(archived)</span>' : ''} <span class="muted" style="font-size:.78rem">${L.subUses(S, s.id)}</span></span><span class="acts">${s.archived ? `<button class="btn small" data-act="restoreSub" data-c="${c.id}" data-id="${s.id}">Restore</button>` : `<button class="btn small" data-act="renameSub" data-c="${c.id}" data-id="${s.id}">Rename</button>`}<button class="btn danger small" data-act="removeSub" data-c="${c.id}" data-id="${s.id}">Remove</button></span></div>`).join('') || '<span class="muted" style="font-size:.86rem">No subcategories yet.</span>'}
        <div class="inline"><input id="newsub-${c.id}" placeholder="New subcategory" maxlength="40"><button class="btn" data-act="addSub" data-c="${c.id}">Add</button></div></div>` : ''}</div>`;
  }

  /* ---------- sheet + toast ---------- */
  function sheet(html) {
    const wasOpen = !!layer.innerHTML;
    layer.innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div>${html}</div></div>`;
    if (!wasOpen) { try { history.pushState({ sheet: 1 }, ''); } catch (e) {} }
    const f = layer.querySelector('[autofocus]') || layer.querySelector('.btn.primary');
    if (f) setTimeout(() => f.focus(), 30);
  }
  function closeSheet() { layer.innerHTML = ''; try { if (history.state && history.state.sheet) history.replaceState(null, ''); } catch (e) {} }
  function toast(msg) { clearTimeout(tt); document.querySelectorAll('.toast').forEach(x => x.remove()); const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg; document.body.appendChild(d); tt = setTimeout(() => d.remove(), 2800); }
  const q = s => layer.querySelector(s);

  function guardDirty(fn) {
    if (!ui.dirty) return fn();
    ui.pending = fn;
    sheet(`<h3>Unsaved income</h3><p>You changed ${FULL[ui.month]} ${ui.year} income but did not save it.</p><div class="mfoot"><button class="btn" data-act="close">Keep editing</button><button class="btn" data-act="dropGo">Discard</button><button class="btn primary" data-act="saveGo">Save</button></div>`);
  }

  /* ---------- transaction form (expenses + savings) ---------- */
  function catOptions(kind, sel) {
    if (kind === 'uns') return '<option value="" selected disabled>Tap Necessary or Lifestyle first</option>';
    return (sel ? '' : '<option value="" selected disabled>Choose a category</option>') + S.cats.filter(c => c.kind === kind && (!c.archived || c.id === sel)).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}${c.archived ? ' (archived)' : ''}</option>`).join('') + '<option value="__new">＋ New category…</option>';
  }
  function subOptions(catId, sel) {
    const c = L.cat(S, catId); if (!c) return '<option value="">Choose a category first</option>';
    return '<option value="">None</option>' + c.subs.filter(s => !s.archived || s.id === sel).map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('') + '<option value="__new">＋ New subcategory…</option>';
  }
  function txForm(kind, rec, opts) {
    opts = opts || {};
    const isNew = !rec || !!opts.recur || !!opts.upi || !!opts.pasted, isSave = kind === 'save';
    const nowD = new Date(), inMonth = nowD.getFullYear() === ui.year && nowD.getMonth() === ui.month;
    const lastPayer = person(prefs.lastPayer) && !person(prefs.lastPayer).archived ? prefs.lastPayer : (active()[0] || {}).id;
    const type = isSave ? 'save' : rec ? rec.type : (ui.xf === 'life' ? 'life' : 'need');
    const catKind = isSave ? 'save' : type; // 'uns' = auto-added payment still waiting for Necessary/Lifestyle and a category
    const defaultCat = (prefs['lastCat_' + catKind] && L.cat(S, prefs['lastCat_' + catKind]) && !L.cat(S, prefs['lastCat_' + catKind]).archived) ? prefs['lastCat_' + catKind] : (activeCats(catKind)[0] || {}).id;
    rec = rec || { name: '', amount: '', date: inMonth ? today() : mk(ui.year, ui.month) + '-01', catId: defaultCat, subId: null, note: '', paidBy: lastPayer, by: lastPayer };
    ui.form = { kind, id: opts.recur || opts.upi || opts.pasted ? null : rec.id || null, type, wasUns: type === 'uns', armedDup: false, recur: opts.recur || null, upi: opts.upi || null, pasted: opts.pasted || null };
    const repeatSel = isNew && !opts.recur && !opts.upi && !opts.pasted;
    const upiItem = opts.upi ? S.upi.queue.find(x => x.id === opts.upi) : null;
    const modeVal = upiItem || opts.pasted ? 'UPI' : rec.mode != null ? rec.mode : (isNew ? (ui.pay === 'upi' ? 'UPI' : 'Cash') : '');
    const who = isSave ? rec.by : rec.paidBy, orphan = rec.id && !person(who);
    sheet(`<h3>${type === 'uns' ? 'Choose a category' : upiItem ? 'Save UPI payment' : opts.pasted ? 'Add pasted payment' : opts.recur ? 'Add ' + esc(rec.name) : isNew ? (isSave ? 'Add savings' : 'Add expense') : (isSave ? 'Edit savings' : 'Edit expense')}</h3>
      ${type === 'uns' ? `<p>Added automatically from a UPI notification${rec.srcApp && L.UPI_SOURCES[rec.srcApp] ? ' (' + esc(L.UPI_SOURCES[rec.srcApp].name) + ')' : ''}. Tap <strong style="color:var(--ink)">Necessary</strong> or <strong style="color:var(--ink)">Lifestyle</strong>, choose the category, then Save. If this was not your payment, tap Delete.</p>` : ''}
      <label class="field"><span>Amount (₹)</span><input id="f-amt" class="big" inputmode="decimal" enterkeyhint="done" value="${rec.amount}" placeholder="0" autocomplete="off" autofocus></label>
      ${isSave ? '' : `<div class="seg" role="group" aria-label="Expense type"><button class="need ${type === 'need' ? 'on' : ''}" data-act="ftype" data-t="need">Necessary</button><button class="life ${type === 'life' ? 'on' : ''}" data-act="ftype" data-t="life">Lifestyle</button></div>`}
      <div class="frow"><label class="field"><span>Category</span><select id="f-cat">${catOptions(catKind, rec.catId)}</select></label>
        <label class="field"><span>Subcategory (optional)</span><select id="f-sub">${subOptions(rec.catId, rec.subId)}</select></label></div>
      <div class="inline" id="f-newcat" hidden><input id="f-newcat-in" placeholder="New category name" maxlength="40"><button class="btn" data-act="fAddCat">Add</button></div>
      <div class="inline" id="f-newsub" hidden><input id="f-newsub-in" placeholder="New subcategory name" maxlength="40"><button class="btn" data-act="fAddSub">Add</button></div>
      <label class="field"><span>${isSave ? 'Savings name' : 'Expense name'} (optional)</span><input id="f-name" value="${esc(rec.name)}" placeholder="${isSave ? 'e.g. SBI RD October' : 'e.g. Weekly vegetables'}" maxlength="60" autocomplete="off"></label>
      <div class="frow"><label class="field"><span>Date</span><input type="date" id="f-date" value="${rec.date}"></label>
        <label class="field"><span>${isSave ? 'Saved by' : 'Paid by'}</span><select id="f-who">${orphan ? `<option value="" selected>${esc(L.personName(S, who, isSave ? rec.byName : rec.paidName))}</option>` : ''}${S.people.filter(p => !p.archived || p.id === who).map(p => `<option value="${p.id}" ${p.id === who ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
      ${isSave ? '' : `<label class="field"><span>Paid with</span><select id="f-mode"><option value="">Not set</option>${L.PAY_MODES.map(x => `<option ${x === modeVal ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`}
      <label class="field"><span>Notes (optional)</span><input id="f-note" value="${esc(rec.note || '')}" maxlength="140" autocomplete="off"></label>
      ${opts.pasted ? `<p>Read from your pasted message${opts.pasted.ref ? ' · UPI ref ' + esc(opts.pasted.ref) : ''}.${rec.amount === '' ? '<br><strong style="color:var(--ink)">The amount was not clear in the message. Please type it.</strong>' : ''} Check the details, <strong style="color:var(--ink)">choose a category</strong>, then Save.</p>` : ''}
      ${upiItem ? `<p>From ${esc(L.UPI_SOURCES[upiItem.src].name)} at ${fmtStamp(upiItem.postedAt)}: “${esc(upiItem.title)} ${esc(upiItem.text)}”${upiItem.amount == null ? '<br><strong style="color:var(--ink)">The amount was not clear in the notification. Please type it.</strong>' : ''}</p>` : ''}
      ${opts.recur ? `<p>From your repeating payment. Change the amount or date if needed.</p>` : ''}
      ${repeatSel ? `<div class="frow"><label class="field"><span>Repeat</span><select id="f-rep"><option value="0">Doesn't repeat</option>${Object.entries(L.FREQ).map(([k, l]) => `<option value="${k}" ${+opts.repeat === +k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field" id="f-varies-wrap" ${opts.repeat ? '' : 'hidden'}><span>Amount</span><select id="f-varies"><option value="0">Same every time</option><option value="1">Changes each time (bill)</option></select></label></div>` : ''}
      <div class="err" id="f-err" role="alert"></div>
      <div class="mfoot">${isNew ? '' : `<button class="btn danger" data-act="fDelete">Delete</button><span class="spacer"></span>`}<button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="fSave">${isNew ? 'Save' : 'Save changes'}</button></div>`);
  }
  function formCatKind() { return ui.form.kind === 'save' ? 'save' : ui.form.type; }
  function nameErr(name, list, label) {
    const n = L.norm(name);
    if (!n) return 'Enter a name.';
    if (n.length > 40) return 'Keep the name under 40 characters.';
    if (list.some(x => L.same(x.name, n))) return `"${n}" already exists${list.find(x => L.same(x.name, n)).archived ? ' (archived — restore it instead)' : ''}.`;
    return '';
  }
  function createCat(kind, name) { const c = { id: L.uid('c'), kind, name: L.norm(name), archived: false, subs: [] }; S.cats.push(c); addLog(`Added ${KINDS[kind].toLowerCase()} category ${c.name}`); return c; }
  function createSub(c, name) { const s = { id: L.uid('s'), name: L.norm(name), archived: false }; c.subs.push(s); addLog(`Added subcategory ${s.name} under ${c.name}`); return s; }

  function saveTx() {
    if (ui.saving) return;
    const f = ui.form, isSave = f.kind === 'save', err = q('#f-err');
    const amount = L.parseMoney(q('#f-amt').value), date = q('#f-date').value, catId = q('#f-cat').value, subId = q('#f-sub').value, who = q('#f-who').value;
    const e = amount == null ? 'Enter an amount above ₹0, like 1500 or 249.50.' : !L.validDate(date) ? 'Pick a valid date.' : (!isSave && f.type === 'uns') ? 'Tap Necessary or Lifestyle, then choose a category.' : (!catId || catId === '__new' || !L.cat(S, catId)) ? 'Choose a category for this payment.' : subId === '__new' ? 'Add the new subcategory or pick one from the list.' : (!who && !f.id) ? 'Choose who ' + (isSave ? 'saved' : 'paid') + '.' : '';
    if (e) { err.textContent = e; return; }
    const name = L.norm(q('#f-name').value) || L.subName(S, catId, subId) || L.catName(S, catId);
    const rec = { name, amount, date, catId, subId: subId || null, note: L.norm(q('#f-note').value) };
    if (!isSave) { const md = q('#f-mode'); rec.mode = md && md.value ? md.value : null; if (!rec.mode) delete rec.mode; }
    const upiItem = f.upi ? S.upi.queue.find(x => x.id === f.upi) : null;
    if (f.pasted && f.pasted.ref && S.expenses.some(e => e.upiRef === f.pasted.ref)) { err.textContent = 'This payment (UPI ref ' + f.pasted.ref + ') is already in your expenses.'; return; }
    if (upiItem && upiItem.ref && S.expenses.some(e => e.upiRef === upiItem.ref)) { err.textContent = 'This UPI payment (ref ' + upiItem.ref + ') is already saved. Reject it instead.'; return; }
    const list = isSave ? S.savings : S.expenses;
    const twin = L.findTwin(list, rec, f.id);
    if (!f.id && twin) {
      if (L.isDoubleTap(twin)) { closeSheet(); return; }
      if (!f.armedDup) { f.armedDup = true; err.textContent = `This matches an entry already saved for ${fmtDate(twin.date)}. Tap Save again if it is a separate ${isSave ? 'savings entry' : 'expense'}.`; return; }
    }
    ui.saving = true;
    const touched = [date];
    if (f.id) {
      const old = list.find(x => x.id === f.id); if (!old) { ui.saving = false; closeSheet(); return; }
      touched.push(old.date);
      const before = old.name + ' ' + fmtINR(old.amount);
      const prevCat = old.catId;
      Object.assign(old, rec); delete old.sample; if (!isSave) old.type = f.type;
      if (!isSave && old.mode === 'UPI' && old.payee && L.cat(S, old.catId)) {
        const r = rememberedFor(old.payee);
        if (!r) { remember(old.payee, old); ui.rememberNote = old.payee; }
        else if (r.cat.id !== old.catId && prevCat !== old.catId) ui.askRemember = { id: old.id, payee: old.payee, from: r.cat.name, to: L.catName(S, old.catId) };
        delete old.catAuto;
      }
      if (who) { if (isSave) { old.by = who; delete old.byName; } else { old.paidBy = who; delete old.paidName; } }
      addLog(f.wasUns ? `Category chosen · ${rec.name} ${fmtINR(amount)} → ${L.catName(S, catId)}` : `${isSave ? 'Savings' : 'Expense'} edited · ${before} → ${rec.name} ${fmtINR(amount)} (${fmtDate(date)})`);
    } else {
      const full = Object.assign({ id: L.uid(isSave ? 'v' : 'x'), created: Date.now() }, rec, isSave ? { by: who } : { type: f.type, paidBy: who });
      list.push(full);
      addLog(`${isSave ? 'Savings' : 'Expense'} added · ${rec.name} ${fmtINR(amount)} · ${L.catName(S, catId)} (${fmtDate(date)})`);
      if (f.recur) { const r = S.recurring.find(x => x.id === f.recur.id); if (r) r.done[f.recur.key] = full.id; }
      if (upiItem) finishUpi(upiItem, full);
      if (f.pasted) {
        full.mode = full.mode || 'UPI'; full.source = 'pasted-message'; if (f.pasted.ref) full.upiRef = f.pasted.ref;
        if (f.pasted.payee) S.upi.payeeCat[payeeKey(f.pasted.payee)] = { catId: full.catId, type: full.type };
      }
      const repEl = q('#f-rep'), freq = repEl ? +repEl.value : 0;
      if (freq) {
        const varies = q('#f-varies') && q('#f-varies').value === '1';
        S.recurring.push({ id: L.uid('r'), kind: isSave ? 'save' : 'exp', name: rec.name, amount: varies ? null : amount, type: isSave ? 'save' : f.type, catId, subId: rec.subId,
          who: who || null, note: '', freq, day: +date.slice(8), start: date.slice(0, 7), paused: false, done: { [date.slice(0, 7)]: full.id } });
        addLog(`Repeating payment set · ${rec.name} · ${L.FREQ[freq].toLowerCase()} on day ${+date.slice(8)}`);
      }
    }
    prefs.lastPayer = who || prefs.lastPayer; if (!upiItem && !f.pasted) prefs['lastCat_' + formCatKind()] = catId; if (!isSave && !upiItem && rec.mode) prefs.lastMode = rec.mode; savePrefs();
    persist(); closeSheet();
    const y = +date.slice(0, 4), m = +date.slice(5, 7) - 1;
    if (y !== ui.year || m !== ui.month) { ui.year = y; ui.month = m; freshDraft(); }
    render(); ui.saving = false;
    if (f.pasted) { ui.pasted = null; const tb = document.getElementById('upi-test'); if (tb) tb.value = ''; const to = document.getElementById('upi-test-out'); if (to) to.innerHTML = ''; }
    if (f.pasted && !f.id) { toast(`${fmtINR(amount)} added to Expenses · ${FULL[m]} ${y}`); if (!isSave) runAlerts(touched); return; }
    if (ui.askRemember) { const a = ui.askRemember; ui.askRemember = null; askRememberSheet(a); if (!isSave) runAlerts(touched); return; }
    if (ui.rememberNote) { const pn = ui.rememberNote; ui.rememberNote = null; toast(`Saved. Next payments to ${pn} will go to ${L.catName(S, catId)} automatically.`); if (!isSave) runAlerts(touched); return; }
    if (f.wasUns) { const left = S.expenses.filter(e => e.type === 'uns').length; toast(left ? `Saved. ${left} more payment${left === 1 ? '' : 's'} need a category` : 'Saved. All payments have a category'); if (!isSave) runAlerts(touched); return; }
    toast(f.id ? 'Changes saved' : `${fmtINR(amount)} saved${y !== d0.getFullYear() || m !== d0.getMonth() ? ' to ' + FULL[m] + ' ' + y : ''}`);
    if (!isSave) runAlerts(touched);
  }
  function deleteTx() {
    const f = ui.form, isSave = f.kind === 'save', list = isSave ? S.savings : S.expenses, rec = list.find(x => x.id === f.id);
    if (!rec) return closeSheet();
    sheet(`<h3>Delete this ${isSave ? 'savings entry' : 'expense'}?</h3><p>${esc(rec.name)} · ${fmtINR(rec.amount)} on ${fmtDate(rec.date)}. Totals, charts and reports will update.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn danger solid" data-act="fDeleteOk">Delete</button></div>`);
  }
  function deleteTxOk() {
    const f = ui.form, isSave = f.kind === 'save', list = isSave ? S.savings : S.expenses, i = list.findIndex(x => x.id === f.id);
    if (i < 0) return closeSheet();
    const rec = list.splice(i, 1)[0];
    addLog(`${isSave ? 'Savings' : 'Expense'} deleted · ${rec.name} ${fmtINR(rec.amount)} (${fmtDate(rec.date)})`);
    persist(); closeSheet(); render(); toast('Deleted');
    if (!isSave) runAlerts([rec.date]);
  }

  /* ---------- alerts ---------- */
  function runAlerts(dates) {
    if (!S.limits.enabled) return;
    const months = [...new Set(dates.map(d => d.slice(0, 7)))];
    let all = [];
    months.forEach(k => { all = all.concat(L.checkAlerts(S, +k.slice(0, 4), +k.slice(5, 7) - 1)); });
    persist();
    if (!all.length) { if (ui.view === 'home' || ui.view === 'settings') render(); return; }
    render();
    sheet(`<h3>Spending limit alert</h3>${all.map(st => `<div class="alertitem ${st.level}"><strong>${esc(st.label)}</strong>
      <span>Spent ${fmtINR(st.spent)} of ${fmtINR(st.limit)}</span>
      <span class="${st.level === 'over' ? 't-over' : 't-reached'}">${st.level === 'over' ? fmtINR(st.spent - st.limit) + ' over the limit' : 'Limit reached. ₹0 remaining.'}</span></div>`).join('')}
      <p>This is a reminder only. Your expense was saved.</p>
      <div class="mfoot"><button class="btn" data-act="goLimits">View limits</button><button class="btn primary" data-act="close">OK</button></div>`);
    if (S.notify && 'Notification' in window && Notification.permission === 'granted') {
      const st = all[0], title = 'Spending limit ' + (st.level === 'over' ? 'exceeded' : 'reached');
      const body = `${st.label}: ${fmtINR(st.spent)} of ${fmtINR(st.limit)}` + (all.length > 1 ? ` (+${all.length - 1} more)` : '');
      const fallback = () => { try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch (e) {} };
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'limit-' + st.item.id }) : fallback()).catch(fallback);
      else fallback();
    }
  }

  /* ---------- people ---------- */
  function personNameErr(name, exceptId) {
    const n = L.norm(name); if (!n) return 'Enter a name.'; if (n.length > 30) return 'Keep the name under 30 characters.';
    const c = S.people.find(p => p.id !== exceptId && L.same(p.name, n));
    return c ? `"${c.name}" already exists${c.archived ? ' (archived — restore it instead)' : ''}.` : '';
  }
  function nameSheet(title, btn, initial, check, onOk) {
    sheet(`<h3>${title}</h3><label class="field"><span>Name</span><input id="nm" value="${esc(initial)}" maxlength="40" autocomplete="off" autofocus></label><div class="err" id="nm-err" role="alert"></div><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="nameOk">${btn}</button></div>`);
    ui.nameOk = () => { const v = q('#nm').value, e = check(v); if (e) { q('#nm-err').textContent = e; return; } onOk(L.norm(v)); };
  }

  /* ---------- income ---------- */
  function saveIncome() {
    const k = mk(ui.year, ui.month), old = S.records[k] || {}, nu = {};
    Object.entries(ui.draft).forEach(([id, e]) => { if (e.none) nu[id] = { none: true, note: e.note || '' }; else if (typeof e.amount === 'number') nu[id] = { amount: e.amount, note: e.note || '' }; });
    const sameRec = (a, b) => !!a && !!b && !!a.none === !!b.none && a.amount === b.amount && (a.note || '') === (b.note || '');
    Object.keys(nu).forEach(id => { if (old[id] && old[id].sample && sameRec(old[id], nu[id])) nu[id].sample = true; });
    const label = MONTHS[ui.month] + ' ' + ui.year, d = e => (!e ? '' : e.none ? 'none' : String(e.amount));
    new Set([...Object.keys(old), ...Object.keys(nu)]).forEach(id => {
      const a = old[id], b = nu[id], nm = L.personName(S, id);
      if (d(a) !== d(b)) { if (!b) addLog(`${label} · deleted ${nm}'s income record`); else if (b.none) addLog(`${label} · ${nm} marked no income`); else addLog(`${label} · ${nm} income ${a && !a.none ? fmtINR(a.amount) + ' → ' : 'set to '}${fmtINR(b.amount)}`); }
      else if ((a && a.note || '') !== (b && b.note || '')) addLog(`${label} · updated note for ${nm}`);
    });
    if (Object.keys(nu).length) S.records[k] = nu; else delete S.records[k];
    persist(); freshDraft();
  }
  function rerenderEntries() { const b = app.querySelector('.erow') && app.querySelector('.erow').parentElement; if (b) b.innerHTML = entryRows(); updateFoot(); }
  function updateFoot() {
    const t = app.querySelector('#drafttot'); if (t) t.textContent = fmtINR(Object.values(ui.draft).reduce((a, e) => a + L.amt(e), 0));
    const s = app.querySelector('#savebtn'); if (s) s.disabled = !ui.dirty;
    const dd = app.querySelector('[data-act="discard"]'); if (dd) dd.hidden = !ui.dirty;
  }

  /* ---------- backup / import ---------- */
  function download(name, text, type) {
    if (Native) { Native.saveFile({ name, data: text, mime: type }).then(r => toast('Saved to ' + r.path)).catch(e => toast((e && e.message) || 'Could not save the file.')); return true; }
    try {
      const blob = new Blob([text], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      return true;
    } catch (e) { toast('Could not create the file on this phone.'); return false; }
  }
  const hasData = () => S.expenses.length || S.savings.length || Object.keys(S.records).length;
  function doImport(text) {
    const err = q ? (document.getElementById('imp-err')) : null;
    let data; try { data = JSON.parse(String(text).trim()); } catch (e) { if (err) err.textContent = 'That is not valid backup data. Copy it again from the web version or choose the backup file.'; return; }
    if (!data || !Array.isArray(data.people)) { if (err) err.textContent = 'This data has no family members in it, so it is not a Family Income Ledger backup.'; return; }
    const apply = () => {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(S)); } catch (e) {}
      S = L.migrate(data); persist(); freshDraft(); closeSheet(); render();
      toast(`Imported ${S.expenses.length} expenses, ${S.savings.length} savings and ${Object.keys(S.records).length} months of income`);
    };
    if (!hasData()) return apply();
    ui.pendingImport = apply;
    sheet(`<h3>Replace data in the app?</h3><p>The app already has records. Importing replaces them with the imported data. A copy of the current data is kept so you can undo.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="importOk">Replace and import</button></div>`);
  }

  /* ---------- UPI detection (Android app only) ---------- */
  const fmtStamp = ms => { const d = new Date(ms); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); };
  const dateOf = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const payeeKey = p => L.norm(p).toLowerCase();
  ui.nat = null;
  function needsCatPanel() {
    const list = S.expenses.filter(e => e.type === 'uns').sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
    if (!list.length) return '';
    return `<section class="panel needscat" aria-label="Payments that need a category"><div class="phead"><div><h2>Needs a category</h2><p>${list.length} UPI payment${list.length === 1 ? '' : 's'} added automatically · ${fmtINR(L.sum(list))} · already counted in your totals</p></div></div>
      ${list.slice(0, 5).map(e => txRow(e, 'exp')).join('')}
      ${list.length > 5 ? `<button class="linkbtn" data-act="xfUns">See all ${list.length}</button>` : ''}</section>`;
  }

  function findUpiDup(it) {
    if (it.amount == null) return null;
    const other = S.upi.queue.find(x => x.id !== it.id && x.amount === it.amount && Math.abs(x.postedAt - it.postedAt) <= 10 * 60 * 1000);
    if (other) return `Same amount from ${L.UPI_SOURCES[other.src].name} at ${fmtStamp(other.postedAt)}. It may be the same payment.`;
    const ex = S.expenses.find(e => e.amount === it.amount && e.date === it.date);
    if (ex) return `You already have ${fmtINR(ex.amount)} “${ex.name}” on ${fmtDate(ex.date)}. It may be the same payment.`;
    return null;
  }
  /* Remembered category for a payee, if it still exists. */
  function rememberedFor(payee) {
    const m = payee && S.upi.payeeCat[payeeKey(payee)], c = m && L.cat(S, m.catId);
    return c && !c.archived && (c.kind === 'need' || c.kind === 'life') ? { cat: c, subId: m.subId && c.subs.some(x => x.id === m.subId && !x.archived) ? m.subId : null } : null;
  }
  function applyRemembered(e) {
    const r = rememberedFor(e.payee); if (!r) return false;
    e.type = r.cat.kind; e.catId = r.cat.id; e.subId = r.subId; e.catAuto = true;
    return true;
  }
  function remember(payee, e) { if (payee && L.cat(S, e.catId)) S.upi.payeeCat[payeeKey(payee)] = { catId: e.catId, subId: e.subId || null, type: e.type, name: payee, t: Date.now() }; }
  function learnedCat(it) {
    const m = it.payee && S.upi.payeeCat[payeeKey(it.payee)], c = m && L.cat(S, m.catId);
    return c && !c.archived && c.kind !== 'save' ? c : null;
  }
  function upiOwner() { const p = person(S.upi.owner); return p && !p.archived ? p.id : (active()[0] || {}).id; }
  function pruneSeen() { const k = Object.keys(S.upi.seen); if (k.length > 3000) k.sort((a, b) => (S.upi.seen[a].t || 0) - (S.upi.seen[b].t || 0)).slice(0, k.length - 2500).forEach(x => delete S.upi.seen[x]); }
  async function pullUpi() {
    if (!Native || !S.upi.enabled) return;
    let res; try { res = await Native.getPending(); } catch (e) { return; }
    const items = (res && res.items) || []; if (!items.length) return;
    const added = ingest(items);
    try { await Native.acknowledge({ ids: items.map(x => x.id) }); } catch (e) {}
    if (autoAdded) {
      render();
      toast(`${autoAdded} UPI payment${autoAdded === 1 ? '' : 's'} added. Choose ${autoAdded === 1 ? 'a category' : 'categories'} in Expenses → UPI.`);
      const dates = S.expenses.filter(e => e.auto && Date.now() - e.created < 60000).map(e => e.date); if (dates.length) runAlerts(dates);
    }
    else if (ui.view === 'settings' || ui.view === 'review') render();
  }
  /* Sorts notifications read on this phone into review / skipped / ignored. */
  function ingest(items) {
    let added = 0; autoAdded = 0;
    items.forEach(raw => {
      const src = L.sourceOfPkg(raw.pkg) || ((S.upi.extraPkgs || []).includes(raw.pkg) ? 'other' : null); if (!src || !S.upi.sources[src]) return;
      const p = L.parseUpi(raw.title, raw.text), key = L.upiKey(raw, p);
      if (p.kind === 'ignore') return;
      const sameText = x => x.src === src && (x.title || '') === (raw.title || '') && (x.text || '') === (raw.text || '');
      const holder = S.upi.queue.find(x => x.key === key || (x.extra || []).some(y => y.key === key));
      if (holder && (sameText(holder) || (holder.extra || []).some(sameText))) return; // exact repeat
      if (!holder && (S.upi.seen[key] || (p.ref && S.expenses.some(e => e.upiRef === p.ref)))) {
        if (S.upi.seen[key] && S.upi.seen[key].d === 'saved') { S.upi.skipped.unshift({ t: raw.postedAt, src, kind: 'duplicate', amount: p.amount, text: ((raw.title || '') + ' — ' + (raw.text || '')).slice(0, 180) }); if (S.upi.skipped.length > 50) S.upi.skipped.length = 50; }
        return; // already handled
      }
      if (['failed', 'credit', 'refund', 'request'].includes(p.kind)) {
        S.upi.skipped.unshift({ t: raw.postedAt, src, kind: p.kind, amount: p.amount, text: ((raw.title || '') + ' — ' + (raw.text || '')).slice(0, 180) });
        if (S.upi.skipped.length > 50) S.upi.skipped.length = 50;
        S.upi.seen[key] = { d: 'skipped-' + p.kind, t: Date.now() }; return;
      }
      const it = { id: L.uid('u'), key, src, title: raw.title || '', text: raw.text || '', postedAt: raw.postedAt, date: dateOf(raw.postedAt), kind: p.kind, amount: p.amount, payee: p.payee, ref: p.ref, issues: p.issues };
      // one payment often brings several notifications (UPI app + bank SMS) within a minute: show them as one card
      const twin = holder || S.upi.queue.find(x => samePayment(x, it));
      if (twin) { mergeInto(twin, it); return; }
      const saved = S.expenses.find(e => e.notifAt && e.amount === it.amount && Math.abs(e.notifAt - it.postedAt) <= SAME_PAYMENT_MS && !(e.upiRef && it.ref && e.upiRef !== it.ref) && !differentPayee(e.payee, it.payee));
      if (saved) {
        // another notification for a payment already added: fill in details it was missing, then skip it
        if (saved.auto && saved.type === 'uns') {
          if (!saved.payee && it.payee) { saved.payee = it.payee; if (saved.name === 'UPI payment') saved.name = it.payee; if (applyRemembered(saved)) addLog(`Category remembered for ${it.payee} → ${L.catName(S, saved.catId)}`); }
          if (!saved.upiRef && it.ref && !S.expenses.some(e => e.upiRef === it.ref)) { saved.upiRef = it.ref; saved.note = 'UPI ref ' + it.ref; }
        }
        S.upi.skipped.unshift({ t: raw.postedAt, src, kind: 'duplicate', amount: p.amount, text: ((raw.title || '') + ' — ' + (raw.text || '')).slice(0, 180) });
        if (S.upi.skipped.length > 50) S.upi.skipped.length = 50;
        S.upi.seen[key] = { d: 'duplicate', t: Date.now() }; return;
      }
      // Fully automatic: any outgoing payment with a clear amount is added. No review step.
      if (it.amount != null && (it.kind === 'debit' || it.kind === 'unknown')) { autoAdd(it); autoAdded++; return; }
      // No single clear amount: nothing can be added safely, so it is only noted in the activity log.
      S.upi.seen[key] = { d: 'no-amount', t: Date.now() };
      addLog(`UPI notification without a clear amount was not added (${L.UPI_SOURCES[src].name})`);
    });
    pruneSeen(); persist();
    return added;
  }

  const SAME_PAYMENT_MS = 3 * 60 * 1000;
  // Two named payees that differ mean two payments. A UPI ID (name@bank) is not compared,
  // because a bank SMS often shows the UPI ID where the UPI app shows the person's name.
  function differentPayee(a, b) {
    if (!a || !b || a.includes('@') || b.includes('@')) return false;
    return payeeKey(a) !== payeeKey(b);
  }
  let autoAdded = 0;
  /* Automatic entry: a clear outgoing payment becomes an expense straight away.
     First payment to someone: no category (type 'uns' = Not sorted); the person chooses one.
     Later payments to the same person: the category chosen before is filled in automatically. */
  function autoAdd(it) {
    const e = { id: L.uid('x'), created: Date.now(), name: it.payee || 'UPI payment', amount: it.amount, date: it.date, type: 'uns', catId: null, subId: null,
      paidBy: upiOwner(), note: it.ref ? 'UPI ref ' + it.ref : '', mode: 'UPI', source: 'upi-auto', srcApp: it.src, notifAt: it.postedAt, auto: true };
    if (it.payee) e.payee = it.payee;
    if (it.ref) e.upiRef = it.ref;
    const known = applyRemembered(e);
    S.expenses.push(e);
    S.upi.seen[it.key] = { d: 'saved', t: Date.now(), x: e.id };
    addLog(`UPI payment added automatically · ${e.name} ${fmtINR(e.amount)} (${fmtDate(e.date)}) · ${known ? L.catName(S, e.catId) + ' (remembered)' : 'needs a category'}`);
    return e;
  }
  function samePayment(a, b) {
    if (a.ref && b.ref) return a.ref === b.ref;               // different UPI refs = different payments
    if (a.amount == null || b.amount == null) return false;  // can't match without an amount
    if (differentPayee(a.payee, b.payee)) return false;
    return a.amount === b.amount && Math.abs(a.postedAt - b.postedAt) <= SAME_PAYMENT_MS;
  }
  function mergeInto(main, it) {
    main.extra = main.extra || [];
    main.extra.push({ key: it.key, src: it.src, title: it.title, text: it.text, postedAt: it.postedAt, kind: it.kind, amount: it.amount, payee: it.payee, ref: it.ref, issues: it.issues });
    // fill gaps only from what another notification actually says
    if (!main.payee && it.payee) main.payee = it.payee;
    if (!main.ref && it.ref) main.ref = it.ref;
    if (main.kind === 'unknown' && it.kind === 'debit') main.kind = 'debit';
    if (main.amount == null && it.amount != null) { main.amount = it.amount; main.issues = main.issues.filter(x => !x.startsWith('amount')); }
    main.dup = findUpiDup(main);
  }
  function allKeys(it) { return [it.key].concat((it.extra || []).map(x => x.key)); }

  async function refreshNative() { if (!Native) return; try { ui.nat = await Native.status(); } catch (e) { ui.nat = { available: false, error: true }; } if (ui.view === 'settings') render(); }
  async function configureNative() {
    if (!Native) return;
    try { ui.nat = await Native.configure({ enabled: !!S.upi.enabled, auto: !!S.upi.auto, packages: L.upiPackages(S.upi.sources).concat(S.upi.extraPkgs || []) }); } catch (e) { toast('Could not update detection settings on this phone.'); }
    if (ui.view === 'settings') render();
  }
  function finishUpi(it, expense) {
    expense.mode = 'UPI'; expense.source = 'upi-notification'; expense.srcApp = it.src; if (it.ref) expense.upiRef = it.ref;
    S.upi.queue = S.upi.queue.filter(x => x.id !== it.id);
    allKeys(it).forEach(k => { S.upi.seen[k] = { d: 'saved', t: Date.now(), x: expense.id }; });
    expense.notifAt = it.postedAt;
    if (it.payee) S.upi.payeeCat[payeeKey(it.payee)] = { catId: expense.catId, type: expense.type };
  }
  /* ---------- repeating payments ---------- */
  function openRecur(id, key) {
    const r = S.recurring.find(x => x.id === id); if (!r) return;
    const c = L.cat(S, r.catId), catId = c && !c.archived ? r.catId : null;
    const rec = { name: r.name, amount: r.amount == null ? '' : r.amount, date: today(), catId: catId || (activeCats(r.kind === 'save' ? 'save' : r.type)[0] || {}).id, subId: catId ? r.subId : null, note: '', paidBy: r.who, by: r.who, type: r.type };
    txForm(r.kind === 'save' ? 'save' : 'exp', rec, { recur: { id: r.id, key } });
  }
  function notifyDueToday() {
    if (!S.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    const t = today(); if (prefs.dueNotified === t) return;
    const due = L.dueList(S, t, 0); if (!due.length) return;
    prefs.dueNotified = t; savePrefs();
    const title = due.length === 1 ? due[0].r.name + ' is due' : due.length + ' payments are due';
    const body = due.slice(0, 3).map(d => d.r.name + (d.r.amount != null ? ' ' + fmtINR(d.r.amount) : '')).join(', ');
    const fallback = () => { try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch (e) {} };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'due-' + t }) : fallback()).catch(fallback); else fallback();
  }

  /* ---------- limits ---------- */
  function limitScope(v) { return v.startsWith('cat:') ? { scope: 'cat', catId: v.slice(4) } : { scope: v, catId: null }; }

  /* ---------- actions ---------- */
  const A = {
    go(el) { const v = el.dataset.v; if (layer.innerHTML) closeSheet(); if (location.hash.slice(1) === v) { route(); return; } location.hash = v; },
    goLimits() { closeSheet(); ui.prevView = ui.view === 'settings' ? ui.prevView : ui.view; location.hash = 'settings'; setTimeout(() => { const e = document.getElementById('limits'); if (e) e.scrollIntoView(); }, 50); },
    stepM(el) { guardDirty(() => { let m = ui.month + +el.dataset.d, y = ui.year; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } ui.month = m; ui.year = y; freshDraft(); render(); }); },
    stepY(el) { guardDirty(() => { ui.year += +el.dataset.d; freshDraft(); render(); }); },
    xf(el) { ui.xf = el.dataset.f; render(); },
    payTab(el) { ui.pay = el.dataset.v; try { localStorage.setItem(KEY + ':pay', ui.pay); } catch (e) {} render(); },
    xfUns() { ui.pay = 'upi'; location.hash = 'expenses'; },
    aMode(el) { ui.aMode = el.dataset.v; render(); },
    close() { closeSheet(); },
    scrim(el, ev) { if (ev.target === el) closeSheet(); },
    newExp() { if (!active().length) return toast('Add a family member first'); txForm('exp', null); },
    newSave() { if (!active().length) return toast('Add a family member first'); txForm('save', null); },
    editExp(el) { const r = S.expenses.find(x => x.id === el.dataset.id); if (r) txForm('exp', r); },
    editSave(el) { const r = S.savings.find(x => x.id === el.dataset.id); if (r) txForm('save', r); },
    ftype(el) {
      const t = el.dataset.t; if (t === ui.form.type) return; ui.form.type = t;
      layer.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      const sel = ui.form.upi || ui.form.pasted || ui.form.wasUns ? '' : prefs['lastCat_' + t] && L.cat(S, prefs['lastCat_' + t]) && !L.cat(S, prefs['lastCat_' + t]).archived ? prefs['lastCat_' + t] : (activeCats(t)[0] || {}).id;
      q('#f-cat').innerHTML = catOptions(t, sel); q('#f-sub').innerHTML = subOptions(sel, null); q('#f-newcat').hidden = true; q('#f-newsub').hidden = true;
    },
    fAddCat() {
      const kind = formCatKind(), v = q('#f-newcat-in').value, e = nameErr(v, S.cats.filter(c => c.kind === kind));
      if (e) { q('#f-err').textContent = e; return; }
      const c = createCat(kind, v); persist(); q('#f-cat').innerHTML = catOptions(kind, c.id); q('#f-sub').innerHTML = subOptions(c.id, null); q('#f-newcat').hidden = true; q('#f-err').textContent = ''; toast('Category added');
    },
    fAddSub() {
      const c = L.cat(S, q('#f-cat').value); if (!c) return;
      const v = q('#f-newsub-in').value, e = nameErr(v, c.subs); if (e) { q('#f-err').textContent = e; return; }
      const s = createSub(c, v); persist(); q('#f-sub').innerHTML = subOptions(c.id, s.id); q('#f-newsub').hidden = true; q('#f-err').textContent = ''; toast('Subcategory added');
    },
    fSave() { saveTx(); },
    fDelete() { deleteTx(); },
    fDeleteOk() { deleteTxOk(); },
    noIncome(el) { const id = el.dataset.id, e = ui.draft[id] || {}; if (e.none) { delete e.none; if (e.note) ui.draft[id] = e; else delete ui.draft[id]; } else ui.draft[id] = { none: true, note: e.note || '' }; ui.dirty = true; rerenderEntries(); },
    clearIncome(el) { delete ui.draft[el.dataset.id]; ui.dirty = true; rerenderEntries(); toast('Record removed. Tap Save to confirm.'); },
    copyPrev() { const pm = ui.month === 0 ? 11 : ui.month - 1, py = ui.month === 0 ? ui.year - 1 : ui.year, r = S.records[mk(py, pm)] || {}; let c = 0; Object.entries(r).forEach(([id, e]) => { const p = person(id); if (p && !p.archived) { ui.draft[id] = Object.assign({}, e, { note: '' }); c++; } }); ui.dirty = true; rerenderEntries(); toast(`Copied ${c} from ${MONTHS[pm]}. Check the amounts, then Save.`); },
    discard() { freshDraft(); render(); },
    saveIncome() { saveIncome(); render(); toast(`${FULL[ui.month]} ${ui.year} income saved`); },
    dropGo() { closeSheet(); ui.dirty = false; freshDraft(); const f = ui.pending; ui.pending = null; f && f(); },
    saveGo() { saveIncome(); closeSheet(); const f = ui.pending; ui.pending = null; f && f(); },
    nameOk() { ui.nameOk && ui.nameOk(); },
    addPerson() {
      let n = S.people.length + 1; while (S.people.some(p => L.same(p.name, 'Person ' + n))) n++;
      nameSheet('Add person', 'Add', 'Person ' + n, v => personNameErr(v), name => {
        const used = S.people.map(p => p.color); S.people.push({ id: L.uid('p'), name, color: COLORS.find(c => !used.includes(c)) || COLORS[S.people.length % COLORS.length], archived: false });
        addLog(`Added ${name}`); persist(); closeSheet(); render(); toast(name + ' added');
      });
    },
    rename(el) { const p = person(el.dataset.id); nameSheet('Rename', 'Save name', p.name, v => personNameErr(v, p.id), name => { if (name !== p.name) { addLog(`Renamed ${p.name} to ${name}`); p.name = name; persist(); } closeSheet(); render(); toast('Name updated everywhere'); }); },
    removePerson(el) {
      const p = person(el.dataset.id), n = Object.values(S.records).filter(r => r[p.id]).length, x = S.expenses.filter(e => e.paidBy === p.id).length + S.savings.filter(e => e.by === p.id).length; ui.target = p.id;
      if (!n && !x) return sheet(`<h3>Remove ${esc(p.name)}?</h3><p>${esc(p.name)} has no records, so nothing else changes.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn danger solid" data-act="purgePersonOk">Remove</button></div>`);
      sheet(`<h3>Remove ${esc(p.name)}?</h3><p>${esc(p.name)} has ${n} income record${n === 1 ? '' : 's'} and ${x} expense or savings entr${x === 1 ? 'y' : 'ies'}.</p>
        <div class="choices"><button class="choice" data-act="archivePerson"><strong>Archive (recommended)</strong><span>Hide from new entries. All history stays in totals and reports.</span></button>
        <button class="choice" data-act="purgePerson" data-id="${p.id}"><strong>Delete permanently</strong><span>Deletes their ${n} income records. Expenses and savings they paid are kept.</span></button></div>
        <div class="mfoot"><button class="btn" data-act="close">Cancel</button></div>`);
    },
    archivePerson() { const p = person(ui.target); p.archived = true; addLog(`Archived ${p.name} (history kept)`); persist(); closeSheet(); freshDraft(); render(); toast(p.name + ' archived'); },
    purgePerson(el) { ui.target = el.dataset.id || ui.target; const p = person(ui.target), n = Object.values(S.records).filter(r => r[p.id]).length;
      sheet(`<h3>Delete ${esc(p.name)} for good?</h3><p>This deletes ${n} income record${n === 1 ? '' : 's'}. Income totals and balances will go down. Expenses and savings stay and show "${esc(p.name)}". This cannot be undone.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn danger solid" data-act="purgePersonOk">Delete permanently</button></div>`); },
    purgePersonOk() {
      const p = person(ui.target); if (!p) return closeSheet();
      Object.keys(S.records).forEach(k => { delete S.records[k][p.id]; if (!Object.keys(S.records[k]).length) delete S.records[k]; });
      S.expenses.forEach(e => { if (e.paidBy === p.id) { e.paidName = p.name; e.paidBy = null; } });
      S.savings.forEach(e => { if (e.by === p.id) { e.byName = p.name; e.by = null; } });
      S.people = S.people.filter(x => x.id !== p.id); addLog(`Deleted ${p.name}`); persist(); closeSheet(); freshDraft(); render(); toast(p.name + ' removed');
    },
    restorePerson(el) { const p = person(el.dataset.id); if (personNameErr(p.name, p.id)) return toast('Another person now uses this name. Rename them first.'); p.archived = false; addLog(`Restored ${p.name}`); persist(); freshDraft(); render(); toast(p.name + ' restored'); },

    /* categories */
    catTab(el) { ui.catTab = el.dataset.v; ui.openCat = null; render(); },
    addCat() { const k = ui.catTab, v = document.getElementById('newcat').value, e = nameErr(v, S.cats.filter(c => c.kind === k)); if (e) { document.getElementById('cat-err').textContent = e; return; } createCat(k, v); persist(); render(); toast('Category added'); },
    renameCat(el) { const c = L.cat(S, el.dataset.id); nameSheet('Rename category', 'Save', c.name, v => nameErr(v, S.cats.filter(x => x.kind === c.kind && x.id !== c.id)), name => { if (name !== c.name) { addLog(`Renamed category ${c.name} to ${name}`); c.name = name; persist(); } closeSheet(); render(); toast('Category renamed everywhere'); }); },
    openCat(el) { ui.openCat = ui.openCat === el.dataset.id ? null : el.dataset.id; render(); const r = app.querySelector(`[data-act="openCat"][data-id="${el.dataset.id}"]`); if (r) r.scrollIntoView({ block: 'nearest' }); },
    restoreCat(el) { const c = L.cat(S, el.dataset.id); c.archived = false; addLog(`Restored category ${c.name}`); persist(); render(); },
    removeCat(el) {
      const c = L.cat(S, el.dataset.id), n = L.catUses(S, c.id); ui.target = c.id;
      if (!n) return sheet(`<h3>Remove ${esc(c.name)}?</h3><p>No records use this category.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn danger solid" data-act="delCatOk">Remove</button></div>`);
      const others = S.cats.filter(x => x.kind === c.kind && x.id !== c.id && !x.archived);
      sheet(`<h3>Remove ${esc(c.name)}?</h3><p>${n} record${n === 1 ? '' : 's'} use this category. Choose what happens to them.</p>
        <div class="choices"><button class="choice" data-act="archiveCat"><strong>Archive (recommended)</strong><span>Hide from new entries. Past records keep this category in reports.</span></button></div>
        ${others.length ? `<label class="field"><span>Or move the ${n} record${n === 1 ? '' : 's'} to</span><select id="moveTo">${others.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label><button class="btn danger" data-act="moveCatOk">Move records and remove ${esc(c.name)}</button>` : ''}
        <div class="mfoot"><button class="btn" data-act="close">Cancel</button></div>`);
    },
    archiveCat() { const c = L.cat(S, ui.target); c.archived = true; addLog(`Archived category ${c.name} (records kept)`); persist(); closeSheet(); render(); toast(c.name + ' archived'); },
    moveCatOk() {
      const c = L.cat(S, ui.target), to = L.cat(S, q('#moveTo').value); if (!to) return;
      let n = 0; S.expenses.concat(S.savings).forEach(e => { if (e.catId === c.id) { e.catId = to.id; e.subId = null; n++; } });
      S.limits.items = S.limits.items.filter(it => it.catId !== c.id);
      S.cats = S.cats.filter(x => x.id !== c.id); addLog(`Moved ${n} records from ${c.name} to ${to.name} and removed ${c.name}`); persist(); closeSheet(); render(); toast(`${n} records moved to ${to.name}`);
    },
    delCatOk() { const c = L.cat(S, ui.target); S.limits.items = S.limits.items.filter(it => it.catId !== c.id); S.cats = S.cats.filter(x => x.id !== c.id); addLog(`Removed category ${c.name}`); persist(); closeSheet(); render(); toast('Category removed'); },
    addSub(el) { const c = L.cat(S, el.dataset.c), inp = document.getElementById('newsub-' + c.id), e = nameErr(inp.value, c.subs); if (e) return toast(e); createSub(c, inp.value); persist(); render(); toast('Subcategory added'); },
    renameSub(el) { const c = L.cat(S, el.dataset.c), s = c.subs.find(x => x.id === el.dataset.id); nameSheet('Rename subcategory', 'Save', s.name, v => nameErr(v, c.subs.filter(x => x.id !== s.id)), name => { if (name !== s.name) { addLog(`Renamed subcategory ${s.name} to ${name}`); s.name = name; persist(); } closeSheet(); render(); }); },
    restoreSub(el) { const c = L.cat(S, el.dataset.c), s = c.subs.find(x => x.id === el.dataset.id); s.archived = false; persist(); render(); },
    removeSub(el) {
      const c = L.cat(S, el.dataset.c), s = c.subs.find(x => x.id === el.dataset.id), n = L.subUses(S, s.id); ui.target = c.id; ui.targetSub = s.id;
      if (!n) return sheet(`<h3>Remove ${esc(s.name)}?</h3><p>No records use this subcategory.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn danger solid" data-act="delSubOk">Remove</button></div>`);
      sheet(`<h3>Remove ${esc(s.name)}?</h3><p>${n} record${n === 1 ? '' : 's'} use it.</p><div class="choices"><button class="choice" data-act="archiveSub"><strong>Archive (recommended)</strong><span>Hide from new entries. Records keep it.</span></button>
        <button class="choice" data-act="delSubOk"><strong>Remove from records</strong><span>The ${n} record${n === 1 ? '' : 's'} stay under ${esc(c.name)} without a subcategory.</span></button></div><div class="mfoot"><button class="btn" data-act="close">Cancel</button></div>`);
    },
    archiveSub() { const c = L.cat(S, ui.target), s = c.subs.find(x => x.id === ui.targetSub); s.archived = true; addLog(`Archived subcategory ${s.name}`); persist(); closeSheet(); render(); },
    delSubOk() { const c = L.cat(S, ui.target), s = c.subs.find(x => x.id === ui.targetSub); S.expenses.concat(S.savings).forEach(e => { if (e.subId === s.id) e.subId = null; }); c.subs = c.subs.filter(x => x.id !== s.id); addLog(`Removed subcategory ${s.name} from ${c.name}`); persist(); closeSheet(); render(); },

    /* limits */
    toggleLimits(el) { S.limits.enabled = el.checked; addLog(`Spending Limit Alerts turned ${el.checked ? 'on' : 'off'}`); persist(); render(); },
    addLimit() {
      const amount = L.parseMoney(document.getElementById('lim-amt').value), sc = limitScope(document.getElementById('lim-scope').value), month = document.getElementById('lim-month').value, err = document.getElementById('lim-err');
      if (amount == null) { err.textContent = 'Enter a limit above ₹0.'; return; }
      if (S.limits.items.some(it => it.scope === sc.scope && (it.catId || null) === sc.catId && it.month === month)) { err.textContent = 'This limit already exists for that period. Use Change on it instead.'; return; }
      const it = { id: L.uid('l'), scope: sc.scope, catId: sc.catId, amount, month, on: true }; S.limits.items.push(it);
      addLog(`Added limit · ${L.limitLabel(S, it)} ${fmtINR(amount)} (${month === '*' ? 'every month' : month})`); persist(); render(); toast('Limit added');
    },
    toggleLimit(el) { const it = S.limits.items.find(x => x.id === el.dataset.id); it.on = it.on === false; persist(); render(); },
    editLimit(el) {
      const it = S.limits.items.find(x => x.id === el.dataset.id); ui.target = it.id;
      sheet(`<h3>Change limit</h3><p>${esc(L.limitLabel(S, it))} · ${it.month === '*' ? 'every month' : 'only ' + it.month}</p><label class="field"><span>Amount (₹)</span><input id="lim-edit" class="big" inputmode="decimal" value="${it.amount}" autofocus></label><div class="err" id="lim-edit-err"></div><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="editLimitOk">Save</button></div>`);
    },
    editLimitOk() { const it = S.limits.items.find(x => x.id === ui.target), a = L.parseMoney(q('#lim-edit').value); if (a == null) { q('#lim-edit-err').textContent = 'Enter a limit above ₹0.'; return; } addLog(`Changed limit · ${L.limitLabel(S, it)} ${fmtINR(it.amount)} → ${fmtINR(a)}`); it.amount = a; persist(); closeSheet(); render(); },
    delLimit(el) { const it = S.limits.items.find(x => x.id === el.dataset.id); S.limits.items = S.limits.items.filter(x => x !== it); addLog(`Deleted limit · ${L.limitLabel(S, it)}`); persist(); render(); toast('Limit deleted'); },
    toggleNotify(el) {
      if (!el.checked) { S.notify = false; persist(); return; }
      if (!('Notification' in window)) { el.checked = false; return; }
      Notification.requestPermission().then(p => { S.notify = p === 'granted'; persist(); render(); if (p !== 'granted') toast('Notifications are blocked for this app in phone settings. In-app alerts still work.'); }).catch(() => { el.checked = false; });
    },

    /* data */
    exportJSON() { if (download(`family-ledger-backup-${today()}.json`, JSON.stringify(S, null, 1), 'application/json')) { addLog('Backup downloaded'); persist(); } },
    copyJSON() { const t = JSON.stringify(S); const ok = () => toast('Backup copied. Paste it somewhere safe.'); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok).catch(() => toast('Copy was blocked. Use Download backup instead.')); else toast('Copy is not available. Use Download backup instead.'); },
    csv() { download(`family-ledger-${ui.year}.csv`, '﻿' + L.yearCSV(S, ui.year), 'text/csv'); },
    print() { if (Native) Native.print({ title: 'Family Ledger ' + ui.year }).catch(e => toast((e && e.message) || 'Printing is not available.')); else window.print(); },
    importPaste() { const t = document.getElementById('importText').value; if (!t.trim()) { document.getElementById('imp-err').textContent = 'Paste the copied data first.'; return; } doImport(t); },
    importOk() { const f = ui.pendingImport; ui.pendingImport = null; f && f(); },
    undoImport() {
      sheet(`<h3>Undo last import?</h3><p>This puts back the data the app had just before the last import.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="undoImportOk">Undo import</button></div>`);
    },
    undoImportOk() { try { const raw = localStorage.getItem(BACKUP_KEY); if (raw) { S = L.migrate(JSON.parse(raw)); localStorage.removeItem(BACKUP_KEY); addLog('Undid the last import'); persist(); freshDraft(); } } catch (e) {} closeSheet(); render(); toast('Previous data restored'); },
    install() { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; render(); }); },
    hideInstall() { prefs.hideInstall = true; savePrefs(); render(); },
    showLog() { ui.showAllLog = !ui.showAllLog; render(); },
    upiTurnOn() {
      if (!Native) return;
      if (!S.upi.enabled) { S.upi.enabled = true; S.upi.auto = true; Object.keys(L.UPI_SOURCES).forEach(k => { S.upi.sources[k] = true; }); addLog('Automatic UPI turned on'); persist(); }
      configureNative().then(() => {
        if (ui.nat && !ui.nat.permission) { toast('Switch on Family Ledger, then come back'); A.openAccess(); }
        else if (ui.nat && !ui.nat.alerts) A.allowAlerts();
        render();
      });
    },
    upiPause() {
      sheet(`<h3>Turn off automatic UPI?</h3><p>New UPI payments will not be added. Payments already added stay in your expenses.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn danger solid" data-act="upiPauseOk">Turn off</button></div>`);
    },
    watchPkg(el) { const p = el.dataset.p; S.upi.extraPkgs = (S.upi.extraPkgs || []).filter(x => x !== p).concat(p); addLog(`Now watching payment notifications from ${p}`); persist(); configureNative().then(render); toast('Watching this app. Its next payment will be added.'); },
    rememberOnlyThis() { const a = ui.pendingRemember; ui.pendingRemember = null; closeSheet(); render(); if (a) toast(`Only this payment changed. ${a.payee} stays ${a.from}.`); },
    rememberAll() {
      const a = ui.pendingRemember; ui.pendingRemember = null; const e = a && S.expenses.find(x => x.id === a.id);
      if (e) { remember(e.payee, e); addLog(`Remembered category for ${e.payee} changed ${a.from} → ${a.to}`); persist(); }
      closeSheet(); render(); if (a) toast(`Future payments to ${a.payee} will go to ${a.to}.`);
    },
    forgetPayee(el) { const m = S.upi.payeeCat[el.dataset.k]; delete S.upi.payeeCat[el.dataset.k]; addLog(`Forgot remembered category for ${(m && m.name) || el.dataset.k}`); persist(); render(); toast('Forgotten. Next payment will ask for a category.'); },
    upiPauseOk() { S.upi.enabled = false; addLog('Automatic UPI turned off'); persist(); configureNative(); closeSheet(); render(); },
    toggleUpi(el) {
      S.upi.enabled = el.checked;
      if (!el.checked) S.upi.queue = []; // nothing unreviewed is kept once detection is off
      addLog(`UPI detection turned ${el.checked ? 'on' : 'off'}`); persist(); configureNative().then(() => {
        if (!el.checked) return;
        if (ui.nat && !ui.nat.permission) toast('Now allow notification access for Family Ledger.');
        else if (ui.nat && !ui.nat.alerts) A.allowAlerts();
      });
      render();
    },
    allowAlerts() { if (!Native) return; Native.requestAlertPermission().then(r => { ui.nat = Object.assign({}, ui.nat, { alerts: !!(r && r.alerts) }); render(); if (!(r && r.alerts)) toast('Alerts are blocked. Tap Manage and turn on notifications for Family Ledger.'); }).catch(() => toast('Could not ask for alert permission.')); },
    openAlertSettings() { if (Native) Native.openAlertSettings().catch(() => {}); },
    openAccess() { if (Native) Native.openNotificationAccess().catch(() => toast('Open Settings → Notifications → Notification access.')); },
    openAppInfo() { if (Native) Native.openAppInfo().catch(() => {}); },
    upiCheckNow() { pullUpi().then(() => toast('Checked for new payments')); },
    goRecurring() { closeSheet(); if (ui.view !== 'settings') ui.prevView = ui.view; location.hash = 'settings'; setTimeout(() => { const e = document.getElementById('recurring'); if (e) e.scrollIntoView(); }, 50); },
    newRecurring() { if (!active().length) return toast('Add a family member first'); txForm('exp', null, { repeat: 1 }); },
    dueOpen(el) { openRecur(el.dataset.id, el.dataset.k); },
    dueAdd(el) {
      const r = S.recurring.find(x => x.id === el.dataset.id), key = el.dataset.k; if (!r) return;
      if (r.amount == null || !L.cat(S, r.catId) || L.cat(S, r.catId).archived) return openRecur(r.id, key);
      const isSave = r.kind === 'save', list = isSave ? S.savings : S.expenses, date = today();
      const who = person(r.who) && !person(r.who).archived ? r.who : (active()[0] || {}).id;
      const full = Object.assign({ id: L.uid(isSave ? 'v' : 'x'), created: Date.now(), name: r.name, amount: r.amount, date, catId: r.catId, subId: r.subId || null, note: r.note || '' }, isSave ? { by: who } : { type: r.type, paidBy: who });
      list.push(full); r.done[key] = full.id;
      addLog(`${isSave ? 'Savings' : 'Expense'} added from repeating · ${r.name} ${fmtINR(r.amount)} (${fmtDate(date)})`);
      persist(); render(); toast(`${r.name} · ${fmtINR(r.amount)} added`);
      if (!isSave) runAlerts([date]);
    },
    dueSkip(el) { const r = S.recurring.find(x => x.id === el.dataset.id); if (!r) return; r.done[el.dataset.k] = 'skip'; addLog(`Skipped ${r.name} for ${FULL[+el.dataset.k.slice(5) - 1]}`); persist(); render(); toast(`${r.name} skipped for ${FULL[+el.dataset.k.slice(5) - 1]}`); },
    editRecur(el) {
      const r = S.recurring.find(x => x.id === el.dataset.id); ui.target = r.id;
      sheet(`<h3>Edit repeating payment</h3>
        <label class="field"><span>Name</span><input id="r-name" value="${esc(r.name)}" maxlength="60"></label>
        <div class="frow"><label class="field"><span>Amount (₹) · blank = varies</span><input id="r-amt" inputmode="decimal" value="${r.amount == null ? '' : r.amount}" placeholder="Varies"></label>
          <label class="field"><span>Day of month</span><input id="r-day" inputmode="numeric" value="${r.day}"></label></div>
        <div class="frow"><label class="field"><span>How often</span><select id="r-freq">${Object.entries(L.FREQ).map(([k, l]) => `<option value="${k}" ${+k === r.freq ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>${r.kind === 'save' ? 'Saved by' : 'Paid by'}</span><select id="r-who">${active().map(p => `<option value="${p.id}" ${p.id === r.who ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
        <p>Changes apply to future reminders. Entries already added stay as they are.</p>
        <div class="err" id="r-err" role="alert"></div>
        <div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="editRecurOk">Save</button></div>`);
    },
    editRecurOk() {
      const r = S.recurring.find(x => x.id === ui.target), name = L.norm(q('#r-name').value), rawAmt = q('#r-amt').value.trim(), day = +q('#r-day').value;
      const amount = rawAmt === '' ? null : L.parseMoney(rawAmt);
      const e = !name ? 'Enter a name.' : rawAmt !== '' && amount == null ? 'Enter an amount above ₹0, or leave it blank if it changes each time.' : !(day >= 1 && day <= 31 && Number.isInteger(day)) ? 'Day must be a number from 1 to 31.' : '';
      if (e) { q('#r-err').textContent = e; return; }
      const freq = +q('#r-freq').value;
      if (freq !== r.freq) { // restart the cycle from this month so the schedule stays predictable
        const nowKey = today().slice(0, 7); r.start = nowKey; }
      Object.assign(r, { name, amount, day, freq, who: q('#r-who').value });
      addLog(`Edited repeating payment · ${name}`); persist(); closeSheet(); render(); toast('Repeating payment updated');
    },
    pauseRecur(el) { const r = S.recurring.find(x => x.id === el.dataset.id); r.paused = !r.paused; addLog(`${r.paused ? 'Paused' : 'Resumed'} ${r.name}`); persist(); render(); },
    delRecur(el) { const r = S.recurring.find(x => x.id === el.dataset.id); ui.target = r.id;
      sheet(`<h3>Delete ${esc(r.name)}?</h3><p>Reminders stop. Entries already added stay in your records and reports.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn danger solid" data-act="delRecurOk">Delete</button></div>`); },
    delRecurOk() { const r = S.recurring.find(x => x.id === ui.target); S.recurring = S.recurring.filter(x => x !== r); addLog(`Deleted repeating payment · ${r.name}`); persist(); closeSheet(); render(); toast('Repeating payment deleted'); },
    saveOpening() {
      const raw = document.getElementById('op-amt').value.trim(), month = document.getElementById('op-month').value, err = document.getElementById('op-err');
      const amount = raw === '' || raw === '0' ? 0 : L.parseMoney(raw);
      if (amount == null) { err.textContent = 'Enter an amount like 25000, or 0.'; return; }
      if (!/^\d{4}-\d{2}$/.test(month)) { err.textContent = 'Choose the month this balance starts from.'; return; }
      S.opening = { amount, month }; addLog(`Starting balance set · ${fmtINR(amount)} from ${FULL[+month.slice(5) - 1]} ${month.slice(0, 4)}`); persist(); render(); toast('Starting balance saved');
    },
    clearOpening() { delete S.opening; addLog('Starting balance cleared'); persist(); render(); toast('Starting balance cleared'); },
    loadSample() {
      const n = L.loadSample(S, today()); if (!n) return toast('Sample data is already loaded');
      addLog(`Loaded sample data (${n} entries)`); persist(); freshDraft(); render(); toast('Sample data loaded from January to today');
    },
    removeSample() { sheet(`<h3>Remove sample data?</h3><p>This deletes only the example entries, sample income and sample limits. Anything you entered yourself stays.</p><div class="mfoot"><button class="btn" data-act="close">Cancel</button><button class="btn danger solid" data-act="removeSampleOk">Remove sample data</button></div>`); },
    removeSampleOk() { L.removeSample(S); addLog('Removed sample data'); persist(); freshDraft(); closeSheet(); render(); toast('Sample data removed'); }
  };

  /* ---------- events ---------- */
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return;
    if (el.tagName === 'INPUT') return; // switches handled on change
    const f = A[el.dataset.act]; if (f) f(el, ev);
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.matches('input[type=checkbox][data-act]')) { const f = A[el.dataset.act]; if (f) f(el, ev); return; }
    if (el.id === 'f-cat') { if (el.value === '__new') { q('#f-newcat').hidden = false; q('#f-newcat-in').focus(); } else { q('#f-newcat').hidden = true; q('#f-sub').innerHTML = subOptions(el.value, null); } q('#f-newsub').hidden = true; }
    if (el.id === 'upi-owner') { S.upi.owner = el.value; persist(); return; }
    if (el.id === 'f-rep') { const w = q('#f-varies-wrap'); if (w) w.hidden = el.value === '0'; }
    if (el.id === 'f-sub') { const show = el.value === '__new'; q('#f-newsub').hidden = !show; if (show) q('#f-newsub-in').focus(); }
    if (el.id === 'importFile' && el.files && el.files[0]) { const r = new FileReader(); r.onload = () => doImport(r.result); r.onerror = () => { document.getElementById('imp-err').textContent = 'Could not read that file.'; }; r.readAsText(el.files[0]); el.value = ''; }
  });
  app.addEventListener('input', ev => {
    const el = ev.target, row = el.closest('.erow'); if (!row || !el.dataset.in) return;
    const id = row.dataset.id, e = ui.draft[id] || {};
    if (el.dataset.in === 'amount') { const raw = el.value.replace(/[^\d]/g, ''); if (raw !== el.value) el.value = raw; if (raw === '') delete e.amount; else e.amount = Math.min(+raw, 1e10); }
    else e.note = el.value;
    if (e.amount === undefined && !e.none && !e.note) delete ui.draft[id]; else ui.draft[id] = e;
    ui.dirty = true; updateFoot(); const x = row.querySelector('.xbtn'); if (x) x.disabled = !ui.draft[id];
  });
  document.addEventListener('keydown', ev => {
    if (!layer.innerHTML) return;
    if (ev.key === 'Escape') closeSheet();
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') {
      if (ev.target.id === 'f-newcat-in') { ev.preventDefault(); A.fAddCat(); }
      else if (ev.target.id === 'f-newsub-in') { ev.preventDefault(); A.fAddSub(); }
      else if (q('[data-act="fSave"]')) { ev.preventDefault(); saveTx(); }
      else if (ev.target.id === 'nm') { ev.preventDefault(); A.nameOk(); }
    }
  });
  window.addEventListener('storage', ev => { if (ev.key === KEY && ev.newValue) { try { S = L.migrate(JSON.parse(ev.newValue)); freshDraft(); render(); } catch (e) {} } });

  /* ---------- install + offline ---------- */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (ui.view === 'home' || ui.view === 'settings') render(); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; toast('Installed. Open Family Ledger from your home screen.'); render(); });
  if (!IS_NATIVE && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  route();
  if (!app.querySelector('.top')) render();
  // Earlier versions had a UPI demo. Remove any example entries it left behind; real entries are untouched.
  if (S.upi.demo || S.expenses.some(e => e.demo) || S.upi.queue.some(x => x.demo) || S.upi.skipped.some(x => x.demo)) {
    const nx = S.expenses.filter(e => e.demo).length;
    S.expenses = S.expenses.filter(e => !e.demo); S.upi.queue = S.upi.queue.filter(x => !x.demo); S.upi.skipped = S.upi.skipped.filter(x => !x.demo);
    Object.keys(S.upi.seen).forEach(k => { if (S.upi.seen[k].demo) delete S.upi.seen[k]; });
    Object.keys(S.upi.payeeCat).forEach(k => { if (S.upi.payeeCat[k].demo) delete S.upi.payeeCat[k]; });
    ['demo', 'demoLive', 'demoCount'].forEach(k => delete S.upi[k]);
    addLog(`Removed the old UPI demo${nx ? ' and ' + nx + ' demo expense' + (nx === 1 ? '' : 's') : ''}`); persist(); render();
  }  // Earlier versions kept UPI payments waiting for review. Now they are added automatically.
  // Runs after the demo clean-up, skips anything incomplete, and can never stop the app from opening.
  try {
    if (S.upi.queue.length) {
      S.upi.queue.forEach(it => { if (!it.demo && it.amount != null && /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') && it.kind !== 'ignore') autoAdd(it); });
      S.upi.queue = []; persist();
    }
    if (!prefs.allSourcesV1) { Object.keys(L.UPI_SOURCES).forEach(k => { S.upi.sources[k] = true; }); S.upi.auto = true; prefs.allSourcesV1 = true; savePrefs(); persist(); }
  } catch (e) { S.upi.queue = []; }

  setTimeout(notifyDueToday, 1500);
  function openReviewFromAlert() {
    pullUpi().then(() => {
      closeSheet();
      const latest = S.expenses.filter(e => e.type === 'uns').sort((a, b) => (b.notifAt || b.created) - (a.notifAt || a.created))[0];
      ui.pay = 'upi'; location.hash = 'expenses'; if (latest) setTimeout(() => txForm('exp', latest), 80);
    });
  }
  if (Native) {
    refreshNative();
    configureNative().then(pullUpi).then(() => Native.takeLaunchAction()).then(r => { if (r && r.open === 'review') openReviewFromAlert(); }).catch(() => {});
    try { Native.addListener('upiDetected', () => { pullUpi(); }); } catch (e) {}
    try { Native.addListener('openFromAlert', d => { if (d && d.open === 'review') openReviewFromAlert(); }); } catch (e) {}
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { refreshNative(); pullUpi(); } });
  }
  window.__ledgerApp = { get S() { return S; }, A, ui, render };
})();

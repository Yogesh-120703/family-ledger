// Tests for the UPI notification text rules in core.js.
// IMPORTANT: every message below is wording written by hand to exercise the rules.
// None of them were copied from real Google Pay, PhonePe, Paytm, BHIM, CRED or bank notifications.
// Real formats must be checked on a phone (see ANDROID.md, "Device testing").
const L = require('../core.js');
let pass = 0, fail = 0;
function check(label, title, text, want) {
  const r = L.parseUpi(title, text), bad = Object.keys(want).filter(k => JSON.stringify(r[k]) !== JSON.stringify(want[k]));
  if (bad.length) { fail++; console.log('  ✗', label, '→ got', JSON.stringify(r)); } else { pass++; console.log('  ✓', label); }
}
console.log('Outgoing payments (become review items)');
check('paid with payee', 'Payment sent', 'Paid ₹250 to Ravi Stores', { kind: 'debit', amount: 250, payee: 'Ravi Stores' });
check('paid with ref', '', '₹1,499.00 paid to Swiggy successfully. UPI Ref No 412345678901', { kind: 'debit', amount: 1499, ref: '412345678901', payee: 'Swiggy' });
check('bank SMS style debit, balance ignored', 'AX-BANK', 'Rs.500.00 debited from A/c XX1234 on 13-10-26 to VPA kumar@oksbi. UPI Ref 401234567890. Avl Bal Rs 12,345.67', { kind: 'debit', amount: 500, ref: '401234567890', payee: 'kumar@oksbi' });
check('sent money', '', 'You sent ₹75 to Tea Stall', { kind: 'debit', amount: 75, payee: 'Tea Stall' });
console.log('Not complete — user must fill in');
check('success without amount', 'Payment successful', 'Your payment to Anand was successful', { kind: 'debit', amount: null, issues: ['amount-missing'] });
check('two amounts', '', 'Paid ₹500 to Metro and ₹20 convenience fee', { kind: 'debit', amount: null, issues: ['amount-ambiguous'] });
console.log('Excluded from expenses');
check('failed', 'Payment failed', '₹300 to Anand could not be completed', { kind: 'failed' });
check('declined', '', 'Your payment of ₹1,200 was declined', { kind: 'failed' });
check('received', '', 'You received ₹2,000 from Priya', { kind: 'credit' });
check('sent you', '', 'Priya has sent you ₹500', { kind: 'credit' });
check('credited', '', 'Rs 5000 credited to A/c XX1234', { kind: 'credit' });
check('refund', '', 'Refund of ₹199 credited to your account', { kind: 'refund' });
check('collect request', '', 'Ravi is requesting ₹750', { kind: 'request' });
check('bill reminder', '', 'Your electricity bill of ₹1,240 is due on 20 Oct', { kind: 'request' });
check('OTP never kept', '', '123456 is your OTP for payment of ₹500', { kind: 'ignore' });
check('promotion', '', 'Get up to ₹100 off on your next recharge', { kind: 'ignore' });
check('no money mentioned', 'Google Pay', 'Your weekly summary is ready', { kind: 'ignore' });
console.log('Unclear — shown with a warning');
check('debit and credit words together', '', '₹400 debited and ₹400 credited', { kind: 'unknown' });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

package in.dnabusiness.familyledger;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Quick reading of a payment notification so the phone can show an instant alert.
 * These rules mirror parseUpi() in core.js. The app's own reading (core.js) still decides
 * what appears on the review screen; this class only decides whether to alert and what to say.
 */
final class UpiText {
    static final String DEBIT = "debit", UNKNOWN = "unknown", SKIP = "skip", IGNORE = "ignore";

    static final class Result {
        String kind = UNKNOWN;
        Double amount;      // null when the notification has no single clear amount
        String payee;       // null when not found
        String ref;         // 12-digit UPI reference, or null
    }

    private static final int CI = Pattern.CASE_INSENSITIVE;
    private static final Pattern OTP = Pattern.compile("\\b(otp|one[- ]time password|verification code)\\b", CI);
    private static final Pattern PROMO = Pattern.compile("\\b(offer|win|won|get up to|upto|up to ₹|off on|discount|rewards?|scratch card|coupon|deal|voucher|earn|loan|pre[- ]?approved|eligible|apply|click|limit|insta|instant|disburs\\w*|interest|rates?|t&c|tak|lakh|lac|kyc|bonus|free|sale|cashback)\\b", CI);
    private static final Pattern PROMO_SENDER = Pattern.compile("^[a-z]{2}-[a-z0-9]{3,9}-p$", CI);
    private static final Pattern FAILED = Pattern.compile("\\b(failed|failure|declined|unsuccessful|not successful|could not be (completed|processed)|reversed|cancell?ed|timed out)\\b", CI);
    private static final Pattern REFUND = Pattern.compile("\\b(refund(ed)?|cashback|reversal)\\b", CI);
    private static final Pattern REQUEST = Pattern.compile("\\b(requested|requesting|is requesting|collect request|payment request|request(ed)? (money|payment)|bill is due|is due|due on|reminder|pay now|pay your)\\b", CI);
    private static final Pattern CREDIT = Pattern.compile("\\b(received|credited|has sent you|sent you|added to (your )?(wallet|account|balance|bank))\\b", CI);
    private static final Pattern DEBIT_RX = Pattern.compile("(\\byou paid\\b|\\bpaid to\\b|\\bpaid (₹|rs\\b|rs\\.|inr\\b)|\\bpaid successfully\\b|\\bpayment ((of|to) [^.]{0,40}?)?(was |is |has been )?successful\\b|(₹|rs\\.?|inr)\\s*[0-9][0-9,.]*\\s*(has been |was |is )?(paid|sent|debited|spent)\\b|\\bsent (₹|rs\\b|rs\\.|inr\\b)|\\byou sent\\b|\\bmoney sent\\b|\\bdebited\\b|\\btransferred to\\b|\\bspent\\b)", CI);
    private static final Pattern AMOUNT = Pattern.compile("(?:₹|\\brs\\.?|\\binr)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)", CI);
    private static final Pattern BAL_BEFORE = Pattern.compile("(bal|balance|avl|available|limit|outstanding)\\W*$|(bal|balance)[^a-z]{0,6}(is|:)?\\W*$");
    private static final Pattern REF1 = Pattern.compile("\\b(?:upi\\s*)?(?:ref(?:erence)?\\.?\\s*(?:no\\.?|number|id)?|utr|rrn|txn\\.?\\s*id|transaction\\s*id)\\s*[:#-]?\\s*([0-9]{12})\\b", CI);
    private static final Pattern REF2 = Pattern.compile("\\b([0-9]{12})\\b");
    private static final Pattern UPI_WORD = Pattern.compile("\\bupi\\b", CI);
    private static final Pattern PAYEE = Pattern.compile("\\b(?:paid|sent|transferred|payment|debited|trf)\\b(?:[^.]|\\.(?=[0-9])){0,80}?\\bto\\s+(?:vpa\\s+)?([A-Za-z0-9@._&' -]{2,40}?)(?=\\s+(?:on|via|using|from|for|upi|ref|refno|successfully|is|was|has|with|thru|through|not)\\b|[.,!;(]|$)", CI);
    private static final Pattern UPI_NAME = Pattern.compile("\\bupi[-/]([A-Za-z][A-Za-z .&']{1,40}?)[-/]", CI);
    private static final Pattern TO_ACCT = Pattern.compile("\\bcredited\\s+to\\s+(?:a/c|ac|account)\\.?\\s*(?:no\\.?)?\\s*[x*]*([0-9]{3,6})\\b", CI);
    private static final Pattern HONORIFIC = Pattern.compile("^(mr|mrs|ms|miss|shri|smt|dr)\\.?\\s+", CI);
    private static final Pattern DEBITED_BY = Pattern.compile("\\bdebited\\s+(?:by|for|with)\\s+([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\b", CI);
    private static final Pattern VPA = Pattern.compile("\\bto\\s+(?:vpa\\s+)?([A-Za-z0-9._-]+@[A-Za-z0-9.-]*[A-Za-z0-9])", CI);
    private static final Pattern PAYEE_BAD = Pattern.compile("^(a/c|ac|account|your)\\b", CI);

    private UpiText() {}

    static Result read(String title, String text) {
        String t = ((title == null ? "" : title) + " . " + (text == null ? "" : text)).replaceAll("\\s+", " ").trim();
        Result r = new Result();
        if (OTP.matcher(t).find() || PROMO_SENDER.matcher(title == null ? "" : title.trim()).find()) { r.kind = IGNORE; return r; }

        List<Double> amounts = new ArrayList<>();
        Matcher m = AMOUNT.matcher(t);
        while (m.find()) {
            String before = t.substring(Math.max(0, m.start() - 18), m.start()).toLowerCase(Locale.ROOT);
            if (BAL_BEFORE.matcher(before).find()) continue;
            try {
                double v = Math.round(Double.parseDouble(m.group(1).replace(",", "")) * 100) / 100.0;
                if (v > 0 && !amounts.contains(v)) amounts.add(v);
            } catch (NumberFormatException ignored) { }
        }
        if (amounts.isEmpty()) {
            Matcher bm = DEBITED_BY.matcher(t);
            if (bm.find()) { try { double v = Math.round(Double.parseDouble(bm.group(1).replace(",", "")) * 100) / 100.0; if (v > 0) amounts.add(v); } catch (NumberFormatException ignored) { } }
        }
        if (amounts.size() == 1) r.amount = amounts.get(0);

        Matcher ref = REF1.matcher(t);
        if (ref.find()) r.ref = ref.group(1);
        else if (UPI_WORD.matcher(t).find()) { Matcher r2 = REF2.matcher(t); if (r2.find()) r.ref = r2.group(1); }

        Matcher vm = VPA.matcher(t);
        if (vm.find()) r.payee = vm.group(1);
        else {
            Matcher um = UPI_NAME.matcher(t), pm = PAYEE.matcher(t);
            String p = um.find() ? um.group(1) : pm.find() ? pm.group(1) : null;
            if (p != null) { p = p.trim(); if (!PAYEE_BAD.matcher(p).find()) r.payee = HONORIFIC.matcher(p).replaceFirst(""); }
        }
        if (r.payee == null) { Matcher am = TO_ACCT.matcher(t); if (am.find()) r.payee = "A/c ending " + am.group(1); }

        boolean isDebit = DEBIT_RX.matcher(t).find();
        if (PROMO.matcher(t).find() && !isDebit) { r.kind = IGNORE; return r; }
        if (FAILED.matcher(t).find() || REFUND.matcher(t).find() || REQUEST.matcher(t).find()) { r.kind = SKIP; return r; }
        boolean isCredit = CREDIT.matcher(t).find();
        if (isDebit && isCredit) r.kind = UNKNOWN;
        else if (isDebit) r.kind = DEBIT;
        else if (isCredit) r.kind = SKIP;
        else r.kind = UNKNOWN;
        if (UNKNOWN.equals(r.kind) && amounts.isEmpty()) r.kind = IGNORE;
        if (UNKNOWN.equals(r.kind) && r.ref == null && !UPI_WORD.matcher(t).find()) r.kind = IGNORE;
        return r;
    }
}

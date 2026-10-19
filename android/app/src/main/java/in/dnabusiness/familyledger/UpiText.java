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
    private static final Pattern PROMO = Pattern.compile("\\b(offer|win|won|get up to|upto|up to ₹|off on|discount|rewards?|scratch card|coupon|deal|voucher|earn)\\b", CI);
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
    private static final Pattern PAYEE = Pattern.compile("\\b(?:paid|sent|transferred|payment|debited)\\b[^.]{0,60}?\\bto\\s+(?:vpa\\s+)?([A-Za-z0-9@._&' -]{2,40}?)(?=\\s+(?:on|via|using|from|for|upi|ref|successfully|is|was|has|with|thru|through)\\b|[.,!;]|$)", CI);
    private static final Pattern PAYEE_BAD = Pattern.compile("^(a/c|ac|account|your)\\b", CI);

    private UpiText() {}

    static Result read(String title, String text) {
        String t = ((title == null ? "" : title) + " . " + (text == null ? "" : text)).replaceAll("\\s+", " ").trim();
        Result r = new Result();
        if (OTP.matcher(t).find()) { r.kind = IGNORE; return r; }

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
        if (amounts.size() == 1) r.amount = amounts.get(0);

        Matcher ref = REF1.matcher(t);
        if (ref.find()) r.ref = ref.group(1);
        else if (UPI_WORD.matcher(t).find()) { Matcher r2 = REF2.matcher(t); if (r2.find()) r.ref = r2.group(1); }

        Matcher pm = PAYEE.matcher(t);
        if (pm.find()) { String p = pm.group(1).trim(); if (!PAYEE_BAD.matcher(p).find()) r.payee = p; }

        boolean isDebit = DEBIT_RX.matcher(t).find();
        if (PROMO.matcher(t).find() && !isDebit) { r.kind = IGNORE; return r; }
        if (FAILED.matcher(t).find() || REFUND.matcher(t).find() || REQUEST.matcher(t).find()) { r.kind = SKIP; return r; }
        boolean isCredit = CREDIT.matcher(t).find();
        if (isDebit && isCredit) r.kind = UNKNOWN;
        else if (isDebit) r.kind = DEBIT;
        else if (isCredit) r.kind = SKIP;
        else r.kind = UNKNOWN;
        if (UNKNOWN.equals(r.kind) && amounts.isEmpty()) r.kind = IGNORE;
        return r;
    }
}

package in.dnabusiness.familyledger;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.text.NumberFormat;
import java.util.Locale;

/**
 * Shows Family Ledger's own alert a few seconds after a UPI payment is detected:
 * "₹450 paid to Annapoorna Hotel · Tap to add to expenses".
 * One payment often brings several notifications (UPI app + bank SMS) within a minute;
 * they update the same alert instead of creating new ones.
 * Nothing is saved here. Tapping the alert opens the review screen in the app.
 */
final class UpiAlerter {
    static final String CHANNEL_ID = "upi_detected";
    static final String EXTRA_OPEN = "fl_open";
    private static final long COLLECT_MS = 8_000;       // wait for the other notifications of the same payment
    private static final long SAME_PAYMENT_MS = 3 * 60_000;

    /** True while the app screen is open; the app then shows the card itself, so no phone alert is needed. */
    static volatile boolean appVisible = false;

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static Group current;
    private static int nextId = 4100;

    private static final class Group {
        Double amount; String payee; String ref; int count; long firstAt; int notifId; boolean posted; String pkg; boolean sure;
    }

    private UpiAlerter() {}

    static synchronized void onPayment(Context ctx, String pkg, UpiText.Result r, long postedAt) {
        Context app = ctx.getApplicationContext();
        Group g = current;
        boolean same = g != null && Math.abs(postedAt - g.firstAt) <= SAME_PAYMENT_MS
            && (g.ref != null && r.ref != null ? g.ref.equals(r.ref)
                : (g.amount == null || r.amount == null || g.amount.equals(r.amount)));
        if (!same) {
            g = new Group();
            g.firstAt = postedAt; g.notifId = nextId++; g.pkg = pkg;
            if (nextId > 4999) nextId = 4100;
            current = g;
        }
        g.count++;
        if (UpiText.DEBIT.equals(r.kind)) g.sure = true;
        if (g.amount == null && r.amount != null) g.amount = r.amount;
        if (g.payee == null && r.payee != null) g.payee = r.payee;
        if (g.ref == null && r.ref != null) g.ref = r.ref;

        final Group fg = g;
        if (!fg.posted) {
            // first notification of this payment: collect the others, then alert once
            if (fg.count == 1) MAIN.postDelayed(() -> post(app, fg), COLLECT_MS);
        } else {
            post(app, fg); // a late notification for the same payment: update the alert quietly
        }
    }

    private static synchronized void post(Context ctx, Group g) {
        g.posted = true;
        if (appVisible) return;
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (!nm.areNotificationsEnabled()) return;
        ensureChannel(ctx);

        String amount = g.amount == null ? null : formatInr(g.amount);
        String title = !g.sure ? (amount == null ? "Possible UPI payment" : "Possible UPI payment of " + amount)
            : amount == null ? "UPI payment detected"
            : g.payee == null ? amount + " paid" : amount + " paid to " + g.payee;
        // Automatic entry: a clear payment is added by the app as "Not sorted" (the app does this the moment
        // it reads the queue). Anything unclear still waits for review.
        boolean added = UpiStore.isAuto(ctx) && g.sure && amount != null;
        String body = added ? "Family Ledger is adding it to your expenses. Tap to choose a category."
            : (amount == null ? "Amount not clear. " : "") + "Tap to review and add to Family Ledger.";
        if (g.count > 1) body += " (" + g.count + " notifications for this payment)";

        Intent open = new Intent(ctx, MainActivity.class)
            .putExtra(EXTRA_OPEN, "review")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, g.notifId, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_upi)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .addAction(0, added ? "Choose category" : "Review", pi);
        try {
            nm.notify(g.notifId, b.build());
        } catch (SecurityException ignored) {
            // alert permission was turned off; the payment still waits on the review screen
        }
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "UPI payments detected", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Alerts when a UPI payment is detected, so you can add it to your expenses.");
        nm.createNotificationChannel(ch);
    }

    /** Clears alerts once the user has opened the review screen. */
    static void clearAll(Context ctx) {
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        for (int id = 4100; id <= 4999; id++) nm.cancel(id);
        synchronized (UpiAlerter.class) { current = null; }
    }

    private static String formatInr(double v) {
        NumberFormat f = NumberFormat.getNumberInstance(new Locale("en", "IN"));
        f.setMinimumFractionDigits(v % 1 == 0 ? 0 : 2);
        f.setMaximumFractionDigits(2);
        return "₹" + f.format(v);
    }
}

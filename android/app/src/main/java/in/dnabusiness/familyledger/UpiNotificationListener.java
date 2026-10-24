package in.dnabusiness.familyledger;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Reads notifications from the payment apps the user picked in Settings.
 * Android only runs this after the user turns on notification access for Family Ledger.
 * Notifications from any other app are ignored immediately and never stored.
 */
public class UpiNotificationListener extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || !UpiStore.isEnabled(this)) return;
            String pkg = sbn.getPackageName();
            if (pkg == null || pkg.equals(getPackageName())) return;
            boolean watched = UpiStore.getPackages(this).contains(pkg);

            Notification n = sbn.getNotification();
            if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle extras = n.extras;
            if (extras == null) return;

            String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
            String text = str(extras.getCharSequence(Notification.EXTRA_TEXT));
            String big = str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            String body = big.length() > text.length() ? big : text;
            if (!UpiStore.looksLikePayment(title + " " + body)) return;
            // Detection check: note which app posted a ₹ notification (name and count only).
            UpiStore.noteMoneyNotification(this, pkg, appLabel(pkg), watched);
            if (!watched) return;

            if (UpiStore.enqueue(this, pkg, title, body, sbn.getPostTime())) {
                LedgerNativePlugin.onNewDetection();
                // Real-time alert: only for what looks like money going out. Received, failed,
                // refund, request and offer messages are still passed to the app, but never alerted.
                UpiText.Result r = UpiText.read(title, body);
                boolean trusted = UpiText.UPI_APPS.contains(pkg) || UpiText.isBankSender(title);
                if (trusted && (UpiText.DEBIT.equals(r.kind) || (UpiText.UNKNOWN.equals(r.kind) && r.amount != null))) {
                    UpiAlerter.onPayment(this, pkg, r, sbn.getPostTime());
                }
            }
        } catch (Exception ignored) {
            // A listener must never crash; a missed notification is better than a broken service.
        }
    }

    @Override
    public void onListenerConnected() {
        UpiStore.markConnected(this); // proves Android has started the reader
    }

    private String appLabel(String pkg) {
        try {
            android.content.pm.PackageManager pm = getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString();
        } catch (Exception e) {
            return pkg;
        }
    }

    private static String str(CharSequence c) { return c == null ? "" : c.toString().trim(); }
}

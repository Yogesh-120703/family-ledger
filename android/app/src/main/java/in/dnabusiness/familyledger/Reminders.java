package in.dnabusiness.familyledger;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Phone notifications for Vault Tracker: bills due today (once a day, even when the app is closed)
 * and alerts the app asks for directly (spending limits, the "notifications are on" test).
 * The app sends the list of upcoming bills; a daily alarm posts the ones due that day.
 */
final class Reminders {
    static final String CHANNEL_ID = "reminders";
    private static final String PREFS = "vt_reminders";
    private static final int GOLD = 0xFFA65316;

    private Reminders() {}

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Bills and limits", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Bills due today and spending limit alerts.");
        nm.createNotificationChannel(ch);
    }

    static void post(Context ctx, String title, String body, String tag) {
        Context app = ctx.getApplicationContext();
        NotificationManagerCompat nm = NotificationManagerCompat.from(app);
        if (!nm.areNotificationsEnabled()) return;
        ensureChannel(app);
        Intent open = new Intent(app, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int id = 5000 + Math.abs((tag == null ? title : tag).hashCode() % 900);
        PendingIntent pi = PendingIntent.getActivity(app, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(app, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_upi)
            .setColor(GOLD)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pi);
        try { nm.notify(id, b.build()); } catch (SecurityException ignored) { }
    }

    /** Saves the upcoming bills from the app and (re)starts the daily check. */
    static void save(Context ctx, JSONArray items, int hour) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putString("items", items == null ? "[]" : items.toString()).putInt("hour", hour).apply();
        arm(ctx);
        // if the hour has already passed today, remind about today's bills now (once)
        Calendar now = Calendar.getInstance();
        if (now.get(Calendar.HOUR_OF_DAY) >= hour) fire(ctx);
    }

    static void arm(Context ctx) {
        Context app = ctx.getApplicationContext();
        SharedPreferences sp = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) app.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(app, 7001, new Intent(app, ReminderReceiver.class).setAction(ReminderReceiver.ACTION_FIRE),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        if ("[]".equals(sp.getString("items", "[]"))) return;
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, sp.getInt("hour", 9));
        next.set(Calendar.MINUTE, 0); next.set(Calendar.SECOND, 0); next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pi);
    }

    /** Posts today's bills, once per day. */
    static void fire(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        if (today.equals(sp.getString("lastFired", ""))) return;
        try {
            JSONArray items = new JSONArray(sp.getString("items", "[]"));
            int posted = 0;
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.getJSONObject(i);
                if (!today.equals(it.optString("date"))) continue;
                post(ctx, it.optString("title", "Bill due today"), it.optString("body", ""), "due-" + today + "-" + i);
                posted++;
            }
            sp.edit().putString("lastFired", today).apply();
        } catch (Exception ignored) { }
    }
}

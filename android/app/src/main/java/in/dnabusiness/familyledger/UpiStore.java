package in.dnabusiness.familyledger;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Small on-device store for UPI detection.
 * Holds the on/off switch, the list of watched apps, and a short queue of payment-looking
 * notifications waiting for the app to read them. Nothing leaves the phone.
 */
final class UpiStore {
    private static final String PREFS = "upi_detect";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_AUTO = "auto";
    private static final String KEY_PACKAGES = "packages";
    private static final String KEY_QUEUE = "queue";
    private static final String KEY_RECENT = "recent";
    private static final String KEY_SEEN = "seen_apps";
    private static final String KEY_CONNECTED = "listener_connected_at";
    private static final int MAX_QUEUE = 200;
    private static final long REPEAT_WINDOW_MS = 10 * 60 * 1000L; // same text again within 10 min = an update of the same notification

    // Must contain a rupee amount. Messages that look like OTPs are never stored.
    private static final Pattern MONEY = Pattern.compile("(₹|\\brs\\.?|\\binr)\\s*[0-9]", Pattern.CASE_INSENSITIVE);
    private static final Pattern OTP = Pattern.compile("\\b(otp|one[- ]time password|verification code)\\b", Pattern.CASE_INSENSITIVE);

    private UpiStore() {}

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static boolean isEnabled(Context c) { return prefs(c).getBoolean(KEY_ENABLED, false); }

    /** True when the app adds clear payments to expenses by itself (the user can turn this off). */
    static boolean isAuto(Context c) { return prefs(c).getBoolean(KEY_AUTO, true); }

    static Set<String> getPackages(Context c) { return new HashSet<>(prefs(c).getStringSet(KEY_PACKAGES, new HashSet<>())); }

    static synchronized void configure(Context c, boolean enabled, boolean auto, Set<String> packages) {
        SharedPreferences.Editor e = prefs(c).edit().putBoolean(KEY_ENABLED, enabled).putBoolean(KEY_AUTO, auto).putStringSet(KEY_PACKAGES, packages);
        if (!enabled) e.remove(KEY_QUEUE).remove(KEY_RECENT); // turning detection off also clears anything not yet read
        e.apply();
    }

    /** Detection check: remembers which apps posted notifications containing a ₹ amount (app name and count only, never the text). */
    static synchronized void noteMoneyNotification(Context c, String pkg, String label, boolean watched) {
        try {
            JSONObject all = new JSONObject(prefs(c).getString(KEY_SEEN, "{}"));
            JSONObject o = all.optJSONObject(pkg);
            if (o == null) o = new JSONObject();
            o.put("label", label).put("n", o.optInt("n") + 1).put("last", System.currentTimeMillis()).put("watched", watched);
            all.put(pkg, o);
            prefs(c).edit().putString(KEY_SEEN, all.toString()).apply();
        } catch (Exception ignored) { }
    }

    static JSONObject seenApps(Context c) {
        try { return new JSONObject(prefs(c).getString(KEY_SEEN, "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static void markConnected(Context c) { prefs(c).edit().putLong(KEY_CONNECTED, System.currentTimeMillis()).apply(); }

    static long connectedAt(Context c) { return prefs(c).getLong(KEY_CONNECTED, 0); }

    static boolean looksLikePayment(String text) {
        return text != null && MONEY.matcher(text).find() && !OTP.matcher(text).find();
    }

    /** Adds a notification to the queue. Returns false if it was a repeat of one just stored. */
    static synchronized boolean enqueue(Context c, String pkg, String title, String text, long postedAt) {
        try {
            String hash = sha256(pkg + "|" + title + "|" + text);
            long now = System.currentTimeMillis();
            JSONArray recent = new JSONArray(prefs(c).getString(KEY_RECENT, "[]"));
            JSONArray keptRecent = new JSONArray();
            for (int i = 0; i < recent.length(); i++) {
                JSONObject r = recent.getJSONObject(i);
                if (now - r.optLong("t") > REPEAT_WINDOW_MS) continue;
                if (hash.equals(r.optString("h"))) return false;
                keptRecent.put(r);
            }
            keptRecent.put(new JSONObject().put("h", hash).put("t", now));

            JSONArray queue = new JSONArray(prefs(c).getString(KEY_QUEUE, "[]"));
            JSONObject item = new JSONObject()
                .put("id", hash.substring(0, 16) + "-" + postedAt)
                .put("pkg", pkg)
                .put("title", title)
                .put("text", text)
                .put("postedAt", postedAt);
            queue.put(item);
            while (queue.length() > MAX_QUEUE) queue.remove(0);
            prefs(c).edit().putString(KEY_QUEUE, queue.toString()).putString(KEY_RECENT, keptRecent.toString()).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    static synchronized JSONArray pending(Context c) {
        try { return new JSONArray(prefs(c).getString(KEY_QUEUE, "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    /** Removes items the app has saved into its own records. */
    static synchronized void acknowledge(Context c, Set<String> ids) {
        try {
            JSONArray queue = pending(c), kept = new JSONArray();
            for (int i = 0; i < queue.length(); i++) {
                JSONObject it = queue.getJSONObject(i);
                if (!ids.contains(it.optString("id"))) kept.put(it);
            }
            prefs(c).edit().putString(KEY_QUEUE, kept.toString()).apply();
        } catch (Exception ignored) { }
    }

    private static String sha256(String s) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        StringBuilder b = new StringBuilder();
        for (byte x : d) b.append(String.format("%02x", x));
        return b.toString();
    }
}

package in.dnabusiness.familyledger;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.WebView;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Bridge between the Family Ledger web code and Android:
 * UPI notification detection, saving files to Downloads, and printing reports.
 */
@CapacitorPlugin(
    name = "LedgerNative",
    permissions = { @Permission(alias = "alerts", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class LedgerNativePlugin extends Plugin {

    private static volatile LedgerNativePlugin instance;

    private static volatile String launchAction;

    @Override
    public void load() {
        instance = this;
        UpiAlerter.ensureChannel(getContext());
        Intent i = getActivity() == null ? null : getActivity().getIntent();
        if (i != null && i.getStringExtra(UpiAlerter.EXTRA_OPEN) != null) {
            launchAction = i.getStringExtra(UpiAlerter.EXTRA_OPEN);
            i.removeExtra(UpiAlerter.EXTRA_OPEN);
        }
    }

    /** The app was already running and the user tapped a payment alert. */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null) return;
        String open = intent.getStringExtra(UpiAlerter.EXTRA_OPEN);
        if (open != null) {
            intent.removeExtra(UpiAlerter.EXTRA_OPEN);
            JSObject d = new JSObject();
            d.put("open", open);
            notifyListeners("openFromAlert", d);
        }
    }

    /** The app was started by tapping a payment alert: tells the app once which screen to open. */
    @PluginMethod
    public void takeLaunchAction(PluginCall call) {
        JSObject r = new JSObject();
        r.put("open", launchAction);
        launchAction = null;
        call.resolve(r);
    }

    private boolean alertsAllowed() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
            && (Build.VERSION.SDK_INT < 33 || getPermissionState("alerts") == PermissionState.GRANTED);
    }

    /** Android 13+ asks the user before an app may show notifications. Older Android allows it by default. */
    @PluginMethod
    public void requestAlertPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("alerts") == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("alerts", alertsAllowed());
            call.resolve(r);
            return;
        }
        requestPermissionForAlias("alerts", call, "alertPermissionDone");
    }

    @PermissionCallback
    private void alertPermissionDone(PluginCall call) {
        JSObject r = new JSObject();
        r.put("alerts", alertsAllowed());
        call.resolve(r);
    }

    @PluginMethod
    public void openAlertSettings(PluginCall call) {
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Removes payment alerts from the notification shade once the user is reviewing in the app. */
    @PluginMethod
    public void clearAlerts(PluginCall call) {
        UpiAlerter.clearAll(getContext());
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() { if (instance == this) instance = null; }

    /** Called by the listener service when a new item is queued, so an open app can show it at once. */
    static void onNewDetection() {
        LedgerNativePlugin p = instance;
        if (p != null) p.notifyListeners("upiDetected", new JSObject());
    }

    private boolean hasAccess() {
        Context c = getContext();
        return NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName());
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", true);
        r.put("permission", hasAccess());
        r.put("enabled", UpiStore.isEnabled(getContext()));
        r.put("pending", UpiStore.pending(getContext()).length());
        r.put("connectedAt", UpiStore.connectedAt(getContext()));
        r.put("seenApps", UpiStore.seenApps(getContext()));
        r.put("alerts", alertsAllowed());
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void openNotificationAccess(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** App info screen: on Android 13+ sideloaded apps must "Allow restricted settings" here first. */
    @PluginMethod
    public void openAppInfo(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void configure(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        boolean auto = Boolean.TRUE.equals(call.getBoolean("auto", true));
        Set<String> pkgs = new HashSet<>();
        JSArray arr = call.getArray("packages", new JSArray());
        try {
            List<String> list = arr.toList();
            pkgs.addAll(list);
        } catch (Exception e) {
            call.reject("Package list could not be read");
            return;
        }
        UpiStore.configure(getContext(), enabled, auto, pkgs);
        status(call);
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSONArray items = UpiStore.pending(getContext());
        JSObject r = new JSObject();
        r.put("items", items);
        call.resolve(r);
    }

    @PluginMethod
    public void acknowledge(PluginCall call) {
        Set<String> ids = new HashSet<>();
        try {
            List<String> list = call.getArray("ids", new JSArray()).toList();
            ids.addAll(list);
        } catch (Exception e) {
            call.reject("Id list could not be read");
            return;
        }
        UpiStore.acknowledge(getContext(), ids);
        call.resolve();
    }

    /** Saves a text file (CSV or backup) to the phone's Downloads folder. */
    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name", "family-ledger.txt");
        String data = call.getString("data", "");
        String mime = call.getString("mime", "text/plain");
        byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
        try {
            String where;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver cr = getContext().getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new IllegalStateException("Downloads folder unavailable");
                try (OutputStream os = cr.openOutputStream(uri)) {
                    if (os == null) throw new IllegalStateException("Could not open file");
                    os.write(bytes);
                }
                where = "Downloads/" + name;
            } else {
                File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) throw new IllegalStateException("Storage unavailable");
                File f = new File(dir, name);
                try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
                where = f.getAbsolutePath();
            }
            JSObject r = new JSObject();
            r.put("path", where);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not save the file: " + e.getMessage());
        }
    }

    /** Opens Android's print screen for the current page (Save as PDF is available there). */
    @PluginMethod
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager pm = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                WebView wv = getBridge().getWebView();
                String job = call.getString("title", "Family Ledger report");
                pm.print(job, wv.createPrintDocumentAdapter(job), new PrintAttributes.Builder().build());
                call.resolve();
            } catch (Exception e) {
                call.reject("Printing is not available: " + e.getMessage());
            }
        });
    }
}

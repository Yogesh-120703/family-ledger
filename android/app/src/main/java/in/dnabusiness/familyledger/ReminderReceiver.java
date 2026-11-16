package in.dnabusiness.familyledger;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Daily alarm (bills due today) and phone restart (set the alarm again). */
public class ReminderReceiver extends BroadcastReceiver {
    static final String ACTION_FIRE = "in.dnabusiness.familyledger.REMIND";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || "android.intent.action.MY_PACKAGE_REPLACED".equals(a)) Reminders.arm(ctx);
        else Reminders.fire(ctx);
    }
}

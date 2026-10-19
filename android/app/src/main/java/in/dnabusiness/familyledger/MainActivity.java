package in.dnabusiness.familyledger;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LedgerNativePlugin.class); // must come before super.onCreate
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        UpiAlerter.appVisible = true; // the app shows new payments itself while open
    }

    @Override
    public void onPause() {
        UpiAlerter.appVisible = false;
        super.onPause();
    }
}

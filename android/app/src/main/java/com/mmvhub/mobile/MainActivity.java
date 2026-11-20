package com.mmvhub.mobile;

import android.content.Intent;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.mmvhub.mobile.widgets.MmvWidgetsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate()
        registerPlugin(MmvWidgetsPlugin.class);
        registerPlugin(GoogleSignInPlugin.class);
        Intent converted = toDeepLink(getIntent());
        if (converted != null) setIntent(converted);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        Intent converted = toDeepLink(intent);
        super.onNewIntent(converted != null ? converted : intent);
    }

    /**
     * Turn "Share → MMV-HUB" text and NFC tag taps into mmvhub:// VIEW intents,
     * which the Capacitor App plugin delivers to the web app as appUrlOpen.
     */
    private Intent toDeepLink(Intent in) {
        if (in == null || in.getAction() == null) return null;
        String action = in.getAction();
        if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(in.getType())) {
            String text = in.getStringExtra(Intent.EXTRA_TEXT);
            String subject = in.getStringExtra(Intent.EXTRA_SUBJECT);
            if (text == null && subject == null) return null;
            String combined = subject != null && text != null && !text.contains(subject)
                ? subject + " — " + text
                : text != null ? text : subject;
            if (combined.length() > 500) combined = combined.substring(0, 500);
            return view(Uri.parse("mmvhub://share?text=" + Uri.encode(combined)));
        }
        if (NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action) && in.getData() != null
            && "mmvhub".equals(in.getData().getScheme())) {
            return view(in.getData());
        }
        return null;
    }

    private Intent view(Uri uri) {
        Intent v = new Intent(Intent.ACTION_VIEW, uri, this, MainActivity.class);
        v.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return v;
    }
}

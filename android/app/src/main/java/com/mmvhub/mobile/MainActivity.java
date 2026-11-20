package com.mmvhub.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.mmvhub.mobile.widgets.MmvWidgetsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate()
        registerPlugin(MmvWidgetsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

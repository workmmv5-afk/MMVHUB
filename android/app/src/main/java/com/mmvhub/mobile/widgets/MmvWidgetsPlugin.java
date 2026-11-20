package com.mmvhub.mobile.widgets;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS → native bridge: window.Capacitor.Plugins.MmvWidgets (widgets + window flags) */
@CapacitorPlugin(name = "MmvWidgets")
public class MmvWidgetsPlugin extends Plugin {

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        WidgetKit.saveSnapshot(getContext(), json);
        WidgetKit.updateAll(getContext());
        call.resolve();
    }

    /** Hide app content in Recents and block screenshots (privacy screen). */
    @PluginMethod
    public void setSecureScreen(PluginCall call) {
        final boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            if (enabled) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        WidgetKit.clearSnapshot(getContext());
        WidgetKit.updateAll(getContext());
        call.resolve();
    }
}

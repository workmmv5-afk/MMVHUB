package com.mmvhub.mobile.widgets;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS → native bridge: window.Capacitor.Plugins.MmvWidgets */
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

    @PluginMethod
    public void clear(PluginCall call) {
        WidgetKit.clearSnapshot(getContext());
        WidgetKit.updateAll(getContext());
        call.resolve();
    }
}

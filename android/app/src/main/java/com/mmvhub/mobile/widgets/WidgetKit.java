package com.mmvhub.mobile.widgets;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import com.mmvhub.mobile.MainActivity;
import com.mmvhub.mobile.R;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Shared storage, theming and click helpers for MMV-HUB home-screen widgets.
 * The web app writes a JSON snapshot (already decrypted, only what widgets
 * show) via the MmvWidgets Capacitor plugin; widgets only read it.
 */
public final class WidgetKit {
    private static final String PREFS = "mmv_widgets";
    private static final String KEY_SNAPSHOT = "snapshot";

    private WidgetKit() {}

    public static void saveSnapshot(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_SNAPSHOT, json).apply();
    }

    public static void clearSnapshot(Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
    }

    public static JSONObject snapshot(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = p.getString(KEY_SNAPSHOT, null);
        if (raw == null) return new JSONObject();
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    public static JSONObject config(JSONObject snap) {
        JSONObject c = snap.optJSONObject("config");
        return c != null ? c : new JSONObject();
    }

    /** Re-render every installed MMV-HUB widget. */
    public static void updateAll(Context ctx) {
        scheduleMidnightRefresh(ctx);
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        TodayWidget.render(ctx, mgr, ids(ctx, mgr, TodayWidget.class));
        QuickWidget.render(ctx, mgr, ids(ctx, mgr, QuickWidget.class));
        SpendWidget.render(ctx, mgr, ids(ctx, mgr, SpendWidget.class));
        GoalsWidget.render(ctx, mgr, ids(ctx, mgr, GoalsWidget.class));
    }

    /** Local date of the device as YYYY-MM-DD. */
    public static String today() {
        Calendar c = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d",
            c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** Snapshot was written on an earlier day → "today" content is stale. */
    public static boolean isStale(JSONObject snap) {
        String day = snap.optString("day", "");
        return !day.isEmpty() && !day.equals(today());
    }

    /**
     * Battery: widgets no longer poll (updatePeriodMillis = 0). One inexact,
     * non-waking alarm just after midnight re-renders them so a stale "Today"
     * shows "open to refresh" instead of yesterday's list.
     */
    private static void scheduleMidnightRefresh(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_MONTH, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 1);
        c.set(Calendar.SECOND, 0);
        Intent i = new Intent(ctx, TodayWidget.class);
        i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS,
            AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, TodayWidget.class)));
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 9001, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.set(AlarmManager.RTC, c.getTimeInMillis(), pi);
    }

    private static int[] ids(Context ctx, AppWidgetManager mgr, Class<?> cls) {
        return mgr.getAppWidgetIds(new ComponentName(ctx, cls));
    }

    // ---------------------------------------------------------------- theme

    public static final class Theme {
        public final int bg;
        public final int text;
        public final int subtext;
        public final int accent;
        public final int track;
        public final int alpha;

        Theme(int bg, int text, int subtext, int accent, int track, int alpha) {
            this.bg = bg;
            this.text = text;
            this.subtext = subtext;
            this.accent = accent;
            this.track = track;
            this.alpha = alpha;
        }
    }

    public static Theme theme(Context ctx, JSONObject cfg) {
        String mode = cfg.optString("theme", "system");
        boolean dark;
        if ("dark".equals(mode)) dark = true;
        else if ("light".equals(mode)) dark = false;
        else {
            int night = ctx.getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK;
            dark = night == Configuration.UI_MODE_NIGHT_YES;
        }
        int accent = parseColor(cfg.optString("accent", ""), dark ? 0xFF8AB4F8 : 0xFF1A73E8);
        int opacity = Math.max(0, Math.min(100, cfg.optInt("opacity", 100)));
        int alpha = Math.round(opacity * 2.55f);
        return dark
            ? new Theme(0xFF1E1F20, 0xFFE8EAED, 0xFF9AA0A6, accent, 0xFF3C4043, alpha)
            : new Theme(0xFFFFFFFF, 0xFF202124, 0xFF5F6368, accent, 0xFFE8EAED, alpha);
    }

    private static int parseColor(String s, int fallback) {
        try {
            return s == null || s.isEmpty() ? fallback : Color.parseColor(s);
        } catch (Exception e) {
            return fallback;
        }
    }

    /** Apply rounded background colour + transparency to a widget root. */
    public static void applyBackground(RemoteViews v, Theme t) {
        v.setInt(R.id.widget_bg, "setColorFilter", t.bg);
        v.setInt(R.id.widget_bg, "setImageAlpha", t.alpha);
    }

    public static void tintProgress(RemoteViews v, int viewId, Theme t) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            v.setColorStateList(viewId, "setProgressTintList", ColorStateList.valueOf(t.accent));
            v.setColorStateList(viewId, "setProgressBackgroundTintList", ColorStateList.valueOf(t.track));
        }
    }

    // --------------------------------------------------------------- clicks

    /** Opens the app at an mmvhub:// deep link (handled by the web app). */
    public static PendingIntent link(Context ctx, String uri, int requestCode) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri), ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            ctx,
            requestCode,
            i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    /** Stable-ish request code per widget + slot so PendingIntents don't collide. */
    public static int rc(int widgetId, int slot) {
        return widgetId * 32 + slot;
    }
}

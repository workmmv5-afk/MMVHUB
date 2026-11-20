package com.mmvhub.mobile.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import com.mmvhub.mobile.R;

import org.json.JSONArray;
import org.json.JSONObject;

/** Top active goals with progress bars. */
public class GoalsWidget extends AppWidgetProvider {
    private static final int[] ROWS = {R.id.g_row1, R.id.g_row2, R.id.g_row3};
    private static final int[] TITLES = {R.id.g_title1, R.id.g_title2, R.id.g_title3};
    private static final int[] PCTS = {R.id.g_pct1, R.id.g_pct2, R.id.g_pct3};
    private static final int[] BARS = {R.id.g_bar1, R.id.g_bar2, R.id.g_bar3};

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        JSONObject snap = WidgetKit.snapshot(ctx);
        JSONObject cfg = WidgetKit.config(snap);
        WidgetKit.Theme t = WidgetKit.theme(ctx, cfg);
        JSONArray goals = snap.optJSONArray("goals");
        boolean locked = snap.optBoolean("locked", false) || goals == null;

        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_goals);
            WidgetKit.applyBackground(v, t);
            v.setTextColor(R.id.g_header, t.text);
            v.setTextColor(R.id.g_empty, t.subtext);
            v.setOnClickPendingIntent(R.id.g_header, WidgetKit.link(ctx, "mmvhub://open/goals", WidgetKit.rc(id, 0)));

            int n = locked ? 0 : Math.min(ROWS.length, goals.length());
            v.setViewVisibility(R.id.g_empty, n == 0 ? View.VISIBLE : View.GONE);
            v.setTextViewText(R.id.g_empty, locked ? "Open MMV-HUB to load goals" : "No active goals");
            v.setOnClickPendingIntent(R.id.g_empty, WidgetKit.link(ctx, "mmvhub://open/goals", WidgetKit.rc(id, 1)));

            for (int i = 0; i < ROWS.length; i++) {
                JSONObject g = i < n ? goals.optJSONObject(i) : null;
                if (g == null) {
                    v.setViewVisibility(ROWS[i], View.GONE);
                    continue;
                }
                int pct = g.optInt("pct", 0);
                v.setViewVisibility(ROWS[i], View.VISIBLE);
                v.setTextViewText(TITLES[i], g.optString("title", ""));
                v.setTextColor(TITLES[i], t.text);
                v.setTextViewText(PCTS[i], pct + "%");
                v.setTextColor(PCTS[i], t.accent);
                v.setProgressBar(BARS[i], 100, pct, false);
                WidgetKit.tintProgress(v, BARS[i], t);
                v.setOnClickPendingIntent(ROWS[i], WidgetKit.link(ctx, "mmvhub://open/goal/" + g.optString("id", ""), WidgetKit.rc(id, 2 + i)));
            }
            mgr.updateAppWidget(id, v);
        }
    }
}

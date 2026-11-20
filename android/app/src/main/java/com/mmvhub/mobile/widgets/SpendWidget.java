package com.mmvhub.mobile.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import com.mmvhub.mobile.R;

import org.json.JSONObject;

/** Month spend vs budget with progress bar + next renewal. */
public class SpendWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        JSONObject snap = WidgetKit.snapshot(ctx);
        JSONObject cfg = WidgetKit.config(snap);
        WidgetKit.Theme t = WidgetKit.theme(ctx, cfg);
        JSONObject spend = snap.optJSONObject("spend");
        boolean hide = cfg.optBoolean("hideAmounts", false);
        boolean locked = snap.optBoolean("locked", false) || spend == null;

        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_spend);
            WidgetKit.applyBackground(v, t);
            WidgetKit.tintProgress(v, R.id.s_progress, t);
            v.setTextColor(R.id.s_label, t.subtext);
            v.setTextColor(R.id.s_amount, t.text);
            v.setTextColor(R.id.s_budget, t.subtext);
            v.setTextColor(R.id.s_next, t.subtext);
            v.setOnClickPendingIntent(R.id.s_root, WidgetKit.link(ctx, "mmvhub://open/purchases", WidgetKit.rc(id, 0)));
            v.setOnClickPendingIntent(R.id.s_add, WidgetKit.link(ctx, "mmvhub://new/purchase", WidgetKit.rc(id, 1)));
            v.setInt(R.id.s_add, "setColorFilter", t.accent);

            if (locked) {
                v.setTextViewText(R.id.s_label, "Spending");
                v.setTextViewText(R.id.s_amount, "—");
                v.setTextViewText(R.id.s_budget, "Open MMV-HUB to load");
                v.setViewVisibility(R.id.s_progress, View.GONE);
                v.setViewVisibility(R.id.s_next, View.GONE);
            } else {
                int pct = spend.optInt("pct", 0);
                v.setTextViewText(R.id.s_label, spend.optString("label", "This month"));
                v.setTextViewText(R.id.s_amount, hide ? "•••••" : spend.optString("spent", ""));
                v.setTextViewText(R.id.s_budget, hide ? pct + "% of budget" : pct + "% of " + spend.optString("budget", ""));
                v.setTextColor(R.id.s_amount, pct > 100 ? 0xFFD93025 : t.text);
                v.setViewVisibility(R.id.s_progress, spend.optBoolean("hasBudget", true) ? View.VISIBLE : View.GONE);
                v.setProgressBar(R.id.s_progress, 100, Math.min(100, pct), false);
                String next = spend.optString("next", "");
                v.setViewVisibility(R.id.s_next, next.isEmpty() ? View.GONE : View.VISIBLE);
                v.setTextViewText(R.id.s_next, hide ? "Next renewal soon" : next);
            }
            mgr.updateAppWidget(id, v);
        }
    }
}

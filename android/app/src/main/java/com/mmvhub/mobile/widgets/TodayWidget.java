package com.mmvhub.mobile.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import com.mmvhub.mobile.R;

import org.json.JSONArray;
import org.json.JSONObject;

/** "Today" widget: progress + up to 5 tasks / habits / events. */
public class TodayWidget extends AppWidgetProvider {
    private static final int[] ROWS = {R.id.row1, R.id.row2, R.id.row3, R.id.row4, R.id.row5};
    private static final int[] MARKS = {R.id.mark1, R.id.mark2, R.id.mark3, R.id.mark4, R.id.mark5};
    private static final int[] TITLES = {R.id.title1, R.id.title2, R.id.title3, R.id.title4, R.id.title5};
    private static final int[] SUBS = {R.id.sub1, R.id.sub2, R.id.sub3, R.id.sub4, R.id.sub5};

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        JSONObject snap = WidgetKit.snapshot(ctx);
        JSONObject cfg = WidgetKit.config(snap);
        WidgetKit.Theme t = WidgetKit.theme(ctx, cfg);
        JSONObject today = snap.optJSONObject("today");
        boolean stale = WidgetKit.isStale(snap);
        boolean locked = snap.optBoolean("locked", false) || today == null || stale;
        int maxRows = Math.max(1, Math.min(5, cfg.optInt("rows", 4)));

        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_today);
            WidgetKit.applyBackground(v, t);
            v.setTextColor(R.id.header, t.text);
            v.setTextColor(R.id.count, t.accent);
            v.setTextColor(R.id.empty, t.subtext);
            v.setTextViewText(R.id.header, cfg.optString("todayTitle", "Today"));
            v.setOnClickPendingIntent(R.id.header, WidgetKit.link(ctx, "mmvhub://open/home", WidgetKit.rc(id, 0)));
            v.setOnClickPendingIntent(R.id.add, WidgetKit.link(ctx, "mmvhub://new/task", WidgetKit.rc(id, 1)));
            v.setInt(R.id.add, "setColorFilter", t.accent);
            WidgetKit.tintProgress(v, R.id.progress, t);

            if (locked) {
                v.setTextViewText(R.id.count, "");
                v.setViewVisibility(R.id.progress, View.GONE);
                for (int r : ROWS) v.setViewVisibility(r, View.GONE);
                v.setViewVisibility(R.id.empty, View.VISIBLE);
                v.setTextViewText(R.id.empty, stale
                    ? "New day — open MMV-HUB to refresh"
                    : snap.optString("lockedText", "Open MMV-HUB to load your day"));
                v.setOnClickPendingIntent(R.id.empty, WidgetKit.link(ctx, "mmvhub://open/home", WidgetKit.rc(id, 2)));
                mgr.updateAppWidget(id, v);
                continue;
            }

            int done = today.optInt("done", 0);
            int total = today.optInt("total", 0);
            v.setTextViewText(R.id.count, total > 0 ? done + "/" + total : "");
            v.setViewVisibility(R.id.progress, total > 0 ? View.VISIBLE : View.GONE);
            v.setProgressBar(R.id.progress, Math.max(1, total), done, false);

            JSONArray items = today.optJSONArray("items");
            int n = items == null ? 0 : Math.min(maxRows, items.length());
            v.setViewVisibility(R.id.empty, n == 0 ? View.VISIBLE : View.GONE);
            v.setTextViewText(R.id.empty, "All clear for today ✓");

            for (int i = 0; i < ROWS.length; i++) {
                if (i >= n) {
                    v.setViewVisibility(ROWS[i], View.GONE);
                    continue;
                }
                JSONObject it = items.optJSONObject(i);
                if (it == null) {
                    v.setViewVisibility(ROWS[i], View.GONE);
                    continue;
                }
                boolean isDone = it.optBoolean("done", false);
                String kind = it.optString("kind", "task");
                v.setViewVisibility(ROWS[i], View.VISIBLE);
                v.setTextViewText(MARKS[i], isDone ? "✓" : "task".equals(kind) ? "○" : "habit".equals(kind) ? "◇" : "•");
                v.setTextColor(MARKS[i], isDone ? t.subtext : t.accent);
                v.setTextViewText(TITLES[i], it.optString("title", ""));
                v.setTextColor(TITLES[i], isDone ? t.subtext : t.text);
                String sub = it.optString("sub", "");
                v.setTextViewText(SUBS[i], sub);
                v.setViewVisibility(SUBS[i], sub.isEmpty() ? View.GONE : View.VISIBLE);
                v.setTextColor(SUBS[i], t.subtext);
                // Tap the mark to check off (done in-app after unlock), title to open
                String rid = it.optString("id", "");
                String action = "habit".equals(kind) ? "toggle/habit/" : "task".equals(kind) ? "toggle/task/" : "open/event/";
                v.setOnClickPendingIntent(MARKS[i], WidgetKit.link(ctx, "mmvhub://" + action + rid, WidgetKit.rc(id, 3 + i * 2)));
                v.setOnClickPendingIntent(TITLES[i], WidgetKit.link(ctx, "mmvhub://open/" + kind + "/" + rid, WidgetKit.rc(id, 4 + i * 2)));
            }
            mgr.updateAppWidget(id, v);
        }
    }
}

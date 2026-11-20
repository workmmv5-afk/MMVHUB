package com.mmvhub.mobile.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import com.mmvhub.mobile.R;

import org.json.JSONObject;

/** One-row quick-add bar: Task · Purchase · Habit · Event (each can be hidden). */
public class QuickWidget extends AppWidgetProvider {
    private static final int[] BTNS = {R.id.q_task, R.id.q_purchase, R.id.q_habit, R.id.q_event};
    private static final String[] KEYS = {"task", "purchase", "habit", "event"};

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        JSONObject cfg = WidgetKit.config(WidgetKit.snapshot(ctx));
        WidgetKit.Theme t = WidgetKit.theme(ctx, cfg);
        JSONObject show = cfg.optJSONObject("quick");
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_quick);
            WidgetKit.applyBackground(v, t);
            for (int i = 0; i < BTNS.length; i++) {
                boolean visible = show == null || show.optBoolean(KEYS[i], true);
                v.setViewVisibility(BTNS[i], visible ? View.VISIBLE : View.GONE);
                v.setTextColor(BTNS[i], t.accent);
                v.setOnClickPendingIntent(BTNS[i], WidgetKit.link(ctx, "mmvhub://new/" + KEYS[i], WidgetKit.rc(id, i)));
            }
            mgr.updateAppWidget(id, v);
        }
    }
}

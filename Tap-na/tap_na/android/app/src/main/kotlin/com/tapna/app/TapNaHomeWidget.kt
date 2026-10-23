package com.tapna.app

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.BitmapFactory
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider
import java.io.File

class TapNaHomeWidget : HomeWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        appWidgetIds.forEach { id ->
            render(context, appWidgetManager, id, widgetData)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        val prefs = es.antonborri.home_widget.HomeWidgetPlugin.getData(context)
        render(context, appWidgetManager, appWidgetId, prefs)
    }

    private fun render(
        context: Context,
        appWidgetManager: AppWidgetManager,
        widgetId: Int,
        widgetData: SharedPreferences,
    ) {
        val options = appWidgetManager.getAppWidgetOptions(widgetId)
        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
        val layout =
            when {
                minWidth < 110 -> R.layout.tap_na_widget_small
                minWidth < 250 -> R.layout.tap_na_widget_medium
                else -> R.layout.tap_na_widget_large
            }

        val views = RemoteViews(context.packageName, layout)
        val pendingIntent = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java)
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        bindImage(views, R.id.widget_qr, widgetData.getString("widget_qr", null))
        if (layout != R.layout.tap_na_widget_small) {
            bindImage(views, R.id.widget_avatar, widgetData.getString("widget_avatar", null))
        }
        if (layout == R.layout.tap_na_widget_large) {
            views.setTextViewText(R.id.widget_name, widgetData.getString("widget_name", "Tap Na"))
            views.setTextViewText(R.id.widget_title, widgetData.getString("widget_title", "") ?: "")
            views.setTextViewText(R.id.widget_company, widgetData.getString("widget_company", "") ?: "")
        }

        appWidgetManager.updateAppWidget(widgetId, views)
    }

    private fun bindImage(views: RemoteViews, viewId: Int, path: String?) {
        if (path.isNullOrBlank()) {
            views.setViewVisibility(viewId, View.GONE)
            return
        }
        val file = File(path)
        if (!file.exists()) {
            views.setViewVisibility(viewId, View.GONE)
            return
        }
        val bitmap = BitmapFactory.decodeFile(file.absolutePath)
        if (bitmap == null) {
            views.setViewVisibility(viewId, View.GONE)
            return
        }
        views.setViewVisibility(viewId, View.VISIBLE)
        views.setImageViewBitmap(viewId, bitmap)
    }
}

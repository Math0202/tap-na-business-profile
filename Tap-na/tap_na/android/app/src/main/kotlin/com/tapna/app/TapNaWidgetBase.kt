package com.tapna.app

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.BitmapFactory
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetPlugin
import es.antonborri.home_widget.HomeWidgetProvider
import java.io.File

open class TapNaWidgetBase : HomeWidgetProvider() {
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
        render(context, appWidgetManager, appWidgetId, HomeWidgetPlugin.getData(context))
    }

    private fun render(
        context: Context,
        appWidgetManager: AppWidgetManager,
        widgetId: Int,
        widgetData: SharedPreferences,
    ) {
        val options = appWidgetManager.getAppWidgetOptions(widgetId)
        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
        val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
        val qrOnly = minHeight < 70 || (minWidth < 110 && minHeight < 110)
        val landscape = !qrOnly && minWidth > minHeight
        val showPhoto = !qrOnly && (landscape || minHeight >= 110)

        val layout =
            when {
                qrOnly -> R.layout.tap_na_widget_small
                landscape -> R.layout.tap_na_widget_landscape
                showPhoto -> R.layout.tap_na_widget_tall
                else -> R.layout.tap_na_widget_details
            }

        val views = RemoteViews(context.packageName, layout)
        val pendingIntent = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java)
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        bindImage(views, R.id.widget_qr, widgetData.getString("widget_qr", null))

        if (layout == R.layout.tap_na_widget_small) {
            appWidgetManager.updateAppWidget(widgetId, views)
            return
        }

        val name = widgetData.getString("widget_name", "Tap Na") ?: "Tap Na"
        val title = widgetData.getString("widget_title", "") ?: ""
        val company = widgetData.getString("widget_company", "") ?: ""
        views.setTextViewText(R.id.widget_name, name)
        setTextOrGone(views, R.id.widget_title, title)
        setTextOrGone(views, R.id.widget_company, company)

        if (showPhoto) {
            bindImage(views, R.id.widget_avatar, widgetData.getString("widget_avatar", null))
        } else {
            views.setViewVisibility(R.id.widget_avatar, View.GONE)
        }

        appWidgetManager.updateAppWidget(widgetId, views)
    }

    private fun setTextOrGone(views: RemoteViews, viewId: Int, value: String) {
        if (value.isBlank()) {
            views.setViewVisibility(viewId, View.GONE)
        } else {
            views.setViewVisibility(viewId, View.VISIBLE)
            views.setTextViewText(viewId, value)
        }
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
        val bitmap = BitmapFactory.decodeFile(file.absolutePath) ?: run {
            views.setViewVisibility(viewId, View.GONE)
            return
        }
        views.setViewVisibility(viewId, View.VISIBLE)
        views.setImageViewBitmap(viewId, bitmap)
    }
}

class TapNaQrWidget : TapNaWidgetBase()

class TapNaCardWidget : TapNaWidgetBase()

class TapNaProfileWidget : TapNaWidgetBase()

class TapNaProfileLargeWidget : TapNaWidgetBase()

class TapNaHomeWidget : TapNaWidgetBase()
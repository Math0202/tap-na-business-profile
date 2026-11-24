package com.tapna.app

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetPlugin
import es.antonborri.home_widget.HomeWidgetProvider
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

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
        val views = RemoteViews(context.packageName, R.layout.tap_na_widget_small)
        val pendingIntent = HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java)
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
        bindImage(views, R.id.widget_qr, widgetData.getString("widget_qr", null), 420)
        pushUpdate(appWidgetManager, widgetId, views)
    }

    private fun pushUpdate(
        appWidgetManager: AppWidgetManager,
        widgetId: Int,
        views: RemoteViews,
    ): Boolean {
        return try {
            appWidgetManager.updateAppWidget(widgetId, views)
            true
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Widget update rejected for id=$widgetId: ${e.message}")
            false
        } catch (e: RuntimeException) {
            Log.w(TAG, "Widget update failed for id=$widgetId: ${e.message}")
            false
        }
    }

    private fun bindImage(views: RemoteViews, viewId: Int, path: String?, maxEdge: Int) {
        if (path.isNullOrBlank()) {
            views.setViewVisibility(viewId, View.GONE)
            return
        }
        val file = File(path)
        if (!file.exists()) {
            views.setViewVisibility(viewId, View.GONE)
            return
        }
        val bitmap = decodeScaledBitmap(file.absolutePath, maxEdge) ?: run {
            views.setViewVisibility(viewId, View.GONE)
            return
        }
        views.setViewVisibility(viewId, View.VISIBLE)
        views.setImageViewBitmap(viewId, bitmap)
    }

    private fun decodeScaledBitmap(path: String, maxEdge: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        var sample = 1
        while (bounds.outWidth / sample > maxEdge * 2 || bounds.outHeight / sample > maxEdge * 2) {
            sample *= 2
        }

        val decoded =
            BitmapFactory.decodeFile(
                path,
                BitmapFactory.Options().apply {
                    inSampleSize = sample
                    inPreferredConfig = Bitmap.Config.ARGB_8888
                },
            ) ?: return null

        val edge = max(decoded.width, decoded.height)
        if (edge <= maxEdge) return decoded

        val scale = maxEdge.toFloat() / edge.toFloat()
        val width = (decoded.width * scale).roundToInt().coerceAtLeast(1)
        val height = (decoded.height * scale).roundToInt().coerceAtLeast(1)
        val scaled = Bitmap.createScaledBitmap(decoded, width, height, true)
        if (scaled !== decoded) {
            decoded.recycle()
        }
        return scaled
    }

    companion object {
        private const val TAG = "TapNaWidget"
    }
}

class TapNaQrWidget : TapNaWidgetBase()

class TapNaCardWidget : TapNaWidgetBase()

class TapNaProfileWidget : TapNaWidgetBase()

class TapNaProfileLargeWidget : TapNaWidgetBase()

class TapNaHomeWidget : TapNaWidgetBase()

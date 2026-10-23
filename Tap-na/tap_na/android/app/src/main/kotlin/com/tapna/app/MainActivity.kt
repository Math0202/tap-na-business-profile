package com.tapna.app

import android.nfc.NfcAdapter
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.tapna.app/nfc")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "setPayload" -> {
                        NdefHostApduService.payload = call.argument<String>("payload") ?: ""
                        result.success(true)
                    }
                    "nfcEnabled" -> {
                        val nfc = NfcAdapter.getDefaultAdapter(this)
                        result.success(nfc != null && nfc.isEnabled)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
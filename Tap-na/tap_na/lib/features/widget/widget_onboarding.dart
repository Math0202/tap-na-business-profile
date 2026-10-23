import 'dart:io';

import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';

import '../../core/app_constants.dart';

class WidgetOnboarding extends StatelessWidget {
  const WidgetOnboarding({super.key, this.onDone});

  final Future<void> Function()? onDone;

  Future<void> _requestWidgetPin() async {
    if (Platform.isAndroid) {
      try {
        await HomeWidget.requestPinWidget(
          androidName: AppConstants.widgetName,
          qualifiedAndroidName:
              '${AppConstants.androidApplicationId}.${AppConstants.widgetName}',
        );
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;

    return Material(
      color: const Color(0xF2000000),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Add your Tap Na widget',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              const Text(
                'Your widget shows a QR code that people can scan to view your Tap Na profile. Apps cannot add widgets automatically.',
                style: TextStyle(color: Colors.white70, fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              if (isAndroid)
                ElevatedButton(
                  onPressed: _requestWidgetPin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppConstants.mint,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.all(16),
                  ),
                  child: const Text('Pin Tap Na widget'),
                )
              else
                const Text(
                  'On iPhone, long-press the Home Screen, tap Edit, then Add Widget and choose Tap Na. Small size is QR only; larger sizes add your photo and name.',
                  style: TextStyle(color: Colors.white70, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
              const SizedBox(height: 14),
              TextButton(
                onPressed: () async => onDone?.call(),
                child: const Text(
                  'Continue',
                  style: TextStyle(color: AppConstants.mint, fontSize: 16),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

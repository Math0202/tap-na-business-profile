import 'dart:io';

import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';

import '../../core/app_constants.dart';

class WidgetOnboarding extends StatelessWidget {
  const WidgetOnboarding({super.key, this.onDone});

  final Future<void> Function()? onDone;

  Future<void> _requestWidgetPin() async {
    if (!Platform.isAndroid) return;
    try {
      await HomeWidget.requestPinWidget(
        androidName: AppConstants.widgetCardName,
        qualifiedAndroidName:
            '${AppConstants.androidApplicationId}.${AppConstants.widgetCardName}',
      );
    } catch (_) {}
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
            children: [
              const Text(
                'Add your Tap Na widget',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              const Text(
                'Your home screen shows a QR code others can scan. Choose a size in the widget picker.',
                style: TextStyle(color: Colors.white70, fontSize: 15),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              const Expanded(
                child: SingleChildScrollView(
                  child: Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    alignment: WrapAlignment.center,
                    children: [
                      _PreviewCard(
                        title: 'Tap Na QR',
                        child: _QrSkeleton(size: 96, showAvatar: true),
                      ),
                      _PreviewCard(
                        title: 'Tap Na Card',
                        child: _CardSkeleton(),
                      ),
                      _PreviewCard(
                        title: 'Tap Na Profile',
                        child: _TallSkeleton(),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (isAndroid)
                ElevatedButton(
                  onPressed: _requestWidgetPin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppConstants.mint,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.all(16),
                  ),
                  child: const Text('Pin Tap Na Card'),
                )
              else
                const Text(
                  'On iPhone, long-press the Home Screen, tap Edit, then Add Widget and choose Tap Na QR, Card, or Profile.',
                  style: TextStyle(color: Colors.white70, fontSize: 15),
                  textAlign: TextAlign.center,
                ),
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

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        child,
        const SizedBox(height: 8),
        Text(title, style: const TextStyle(color: Colors.white70, fontSize: 12)),
      ],
    );
  }
}

class _Shell extends StatelessWidget {
  const _Shell({required this.child, required this.width, required this.height});

  final Widget child;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final isDark =
        MediaQuery.platformBrightnessOf(context) == Brightness.dark;
    return Container(
      width: width,
      height: height,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isDark ? AppConstants.bg : AppConstants.cream,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? const Color(0xFF3A3A3A) : const Color(0xFFD6D0C4),
        ),
      ),
      child: child,
    );
  }
}

class _AvatarDot extends StatelessWidget {
  const _AvatarDot({this.size = 36});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
      ),
      padding: EdgeInsets.all(size * 0.08),
      child: const DecoratedBox(
        decoration: BoxDecoration(
          color: Color(0xFF3F3F46),
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

class _QrSkeleton extends StatelessWidget {
  const _QrSkeleton({this.size = 72, this.showAvatar = false});

  final double size;
  final bool showAvatar;

  @override
  Widget build(BuildContext context) {
    return _Shell(
      width: size + 16,
      height: size + 16,
      child: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.qr_code_2, color: Colors.black, size: 48),
            ),
          ),
          if (showAvatar)
            const Positioned(right: 4, bottom: 4, child: _AvatarDot(size: 28)),
        ],
      ),
    );
  }
}

class _CardSkeleton extends StatelessWidget {
  const _CardSkeleton();

  @override
  Widget build(BuildContext context) {
    return _Shell(
      width: 220,
      height: 110,
      child: Row(
        children: [
          const _AvatarDot(size: 56),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.qr_code_2, color: Colors.black),
            ),
          ),
        ],
      ),
    );
  }
}

class _TallSkeleton extends StatelessWidget {
  const _TallSkeleton();

  @override
  Widget build(BuildContext context) {
    return _Shell(
      width: 120,
      height: 180,
      child: Column(
        children: [
          const _AvatarDot(size: 44),
          const SizedBox(height: 8),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Icon(Icons.qr_code_2, color: Colors.black, size: 40),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

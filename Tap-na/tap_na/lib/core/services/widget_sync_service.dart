import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../app_constants.dart';
import '../models/profile_data.dart';

class WidgetSyncService {
  Future<void> configure() async {
    try {
      await HomeWidget.setAppGroupId(AppConstants.appGroupId);
    } catch (_) {}
  }

  Future<void> sync(ProfileData profile) async {
    try {
      await configure();
      await HomeWidget.saveWidgetData<String>('widget_name', profile.safeName);
      await HomeWidget.saveWidgetData<String>('widget_title', profile.title);
      await HomeWidget.saveWidgetData<String>(
        'widget_company',
        profile.company,
      );
      await HomeWidget.saveWidgetData<String>(
        'widget_url',
        profile.publicProfileUrl,
      );

      if (profile.publicProfileUrl.trim().isNotEmpty) {
        await HomeWidget.renderFlutterWidget(
          _QrPlate(url: profile.publicProfileUrl.trim()),
          key: 'widget_qr',
          logicalSize: const Size(672, 672),
        );
      }

      final avatar = profile.localImagePath;
      if (avatar != null && File(avatar).existsSync()) {
        await _renderAvatar(avatar);
      }

      await _updateAll();
    } catch (_) {}
  }

  Future<void> clear() async {
    try {
      await HomeWidget.saveWidgetData<String>('widget_name', '');
      await HomeWidget.saveWidgetData<String>('widget_title', '');
      await HomeWidget.saveWidgetData<String>('widget_company', '');
      await HomeWidget.saveWidgetData<String>('widget_url', '');
      await _updateAll();
    } catch (_) {}
  }

  Future<void> _renderAvatar(String path) async {
    final bytes = await File(path).readAsBytes();
    if (bytes.isEmpty) return;
    final codec = await ui.instantiateImageCodec(
      bytes,
      targetWidth: 240,
      targetHeight: 240,
    );
    final frame = await codec.getNextFrame();
    try {
      await HomeWidget.renderFlutterWidget(
        SizedBox(
          width: 240,
          height: 240,
          child: ClipOval(
            child: RawImage(
              image: frame.image,
              fit: BoxFit.cover,
              width: 240,
              height: 240,
            ),
          ),
        ),
        key: 'widget_avatar',
        logicalSize: const Size(240, 240),
      );
    } finally {
      frame.image.dispose();
    }
  }

  Future<void> _updateAll() async {
    for (final name in AppConstants.androidWidgetNames) {
      try {
        await HomeWidget.updateWidget(
          name: name,
          androidName: name,
          iOSName: name,
          qualifiedAndroidName: '${AppConstants.androidApplicationId}.$name',
        );
      } catch (_) {}
    }
  }
}

class _QrPlate extends StatelessWidget {
  const _QrPlate({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFF121212),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: ColoredBox(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: QrImageView(
                data: url,
                size: 576,
                padding: EdgeInsets.zero,
                backgroundColor: Colors.white,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: Colors.black,
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: Colors.black,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

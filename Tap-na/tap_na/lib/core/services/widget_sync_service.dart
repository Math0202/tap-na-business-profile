import 'dart:io';

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

      if (profile.publicProfileUrl.isNotEmpty) {
        await HomeWidget.renderFlutterWidget(
          _QrTile(url: profile.publicProfileUrl),
          key: 'widget_qr',
          logicalSize: const Size(720, 720),
        );
      }

      final avatar = profile.localImagePath;
      if (avatar != null && File(avatar).existsSync()) {
        await HomeWidget.renderFlutterWidget(
          ClipOval(child: Image.file(File(avatar), fit: BoxFit.cover)),
          key: 'widget_avatar',
          logicalSize: const Size(240, 240),
        );
      }

      await HomeWidget.updateWidget(
        name: AppConstants.widgetName,
        androidName: AppConstants.widgetName,
        iOSName: AppConstants.widgetName,
        qualifiedAndroidName:
            '${AppConstants.androidApplicationId}.${AppConstants.widgetName}',
      );
    } catch (_) {}
  }

  Future<void> clear() async {
    try {
      await HomeWidget.saveWidgetData<String>('widget_name', '');
      await HomeWidget.saveWidgetData<String>('widget_title', '');
      await HomeWidget.saveWidgetData<String>('widget_company', '');
      await HomeWidget.saveWidgetData<String>('widget_url', '');
      await HomeWidget.updateWidget(
        name: AppConstants.widgetName,
        androidName: AppConstants.widgetName,
        iOSName: AppConstants.widgetName,
      );
    } catch (_) {}
  }
}

class _QrTile extends StatelessWidget {
  const _QrTile({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: CustomPaint(
          painter: QrPainter(
            data: url,
            version: QrVersions.auto,
            gapless: true,
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
    );
  }
}

import 'package:flutter/material.dart';

class AppConstants {
  static const String appName = 'Tap Na';
  static const String baseUrl = 'https://tapnam.com';
  static const String loginUrl = '$baseUrl/login';
  static const String profileUrl = '$baseUrl/profile';
  static const String venueUrl = '$baseUrl/venue';
  static const String supportUrl = '$baseUrl/support';
  static const String privacyUrl = '$baseUrl/privacy';

  static const String profileApiEndpoint = '$baseUrl/api/app/me';
  static const String profileApiFallbackEndpoint = '$baseUrl/api/me';

  static const String appGroupId = 'group.tapna.app';
  static const String widgetName = 'TapNaCardWidget';
  static const String widgetQrName = 'TapNaQrWidget';
  static const String widgetCardName = 'TapNaCardWidget';
  static const String widgetProfileName = 'TapNaProfileWidget';
  static const List<String> androidWidgetNames = [
    widgetQrName,
    widgetCardName,
    widgetProfileName,
  ];
  static const String androidApplicationId = 'com.tapna.app';

  static const Color cream = Color(0xFFF4F1EA);
  static const Color mint = Color(0xFF5FDFC2);
  static const Color ink = Color(0xFF1A1A1A);
  static const Color bg = Color(0xFF121212);
  static const Color bgElevated = Color(0xFF1A1A1A);
  static const Color card = Color(0xFF2A2A2A);
  static const Color border = Color(0xFF3A3A3A);
  static const Color textSecondary = Color(0xFFA1A1AA);
  static const Color textMuted = Color(0xFF71717A);
  static const Color btnSecondary = Color(0xFF3F3F46);
  static const String logoUrl = '$baseUrl/tap-na_logo.png';

  static String ownerHomeUrl({required bool isVenue}) =>
      isVenue ? venueUrl : profileUrl;
}

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
  static const String widgetName = 'TapNaHomeWidget';
  static const String androidApplicationId = 'com.tapna.app';

  static const Color cream = Color(0xFFF4F1EA);
  static const Color mint = Color(0xFF5FDFC2);
  static const Color ink = Color(0xFF1A1A1A);

  static String ownerHomeUrl({required bool isVenue}) =>
      isVenue ? venueUrl : profileUrl;
}

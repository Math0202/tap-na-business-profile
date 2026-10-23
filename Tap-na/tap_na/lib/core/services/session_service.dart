import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SessionService {
  SessionService({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const String tokenKey = 'tapna_auth_token';
  static const String sessionFlagKey = 'tapna_logged_in';
  static const String widgetOnboardingSeenKey = 'tapna_widget_onboarding_seen';
  static const String lastUrlKey = 'tapna_last_url';

  Future<void> storeSession({required String? accessToken}) async {
    if (accessToken != null && accessToken.trim().isNotEmpty) {
      await _writeSecure(tokenKey, accessToken);
    }
    await _writeSecure(sessionFlagKey, 'true');
  }

  Future<String?> get accessToken async => _readSecure(tokenKey);

  Future<bool> hasActiveSession() async {
    final flag = await _readSecure(sessionFlagKey);
    if (flag == 'true') return true;
    final token = await accessToken;
    return token != null && token.trim().isNotEmpty;
  }

  Future<void> clearSession() async {
    await _deleteSecure(tokenKey);
    await _deleteSecure(sessionFlagKey);
    await _deletePref(lastUrlKey);
  }

  Future<void> markWidgetOnboardingSeen() async {
    await _writeSecure(widgetOnboardingSeenKey, 'true');
  }

  Future<bool> shouldShowWidgetOnboarding() async {
    final value = await _readSecure(widgetOnboardingSeenKey);
    return value != 'true';
  }

  Future<void> saveLastUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(lastUrlKey, url);
  }

  Future<String?> getLastUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(lastUrlKey);
  }

  Future<void> _writeSecure(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } on MissingPluginException {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    }
  }

  Future<String?> _readSecure(String key) async {
    try {
      return await _storage.read(key: key);
    } on MissingPluginException {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(key);
    }
  }

  Future<void> _deleteSecure(String key) async {
    try {
      await _storage.delete(key: key);
    } on MissingPluginException {
      await _deletePref(key);
    }
  }

  Future<void> _deletePref(String key) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(key);
  }
}

import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/app_constants.dart';
import '../../core/models/profile_data.dart';
import '../../core/services/connectivity_service.dart';
import '../../core/services/profile_api_service.dart';
import '../../core/services/profile_cache_service.dart';
import '../../core/services/session_service.dart';
import '../../core/services/widget_sync_service.dart';
import '../home/owner_home.dart';
import 'web_login_shell.dart';

class SessionGate extends StatefulWidget {
  const SessionGate({super.key});

  @override
  State<SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<SessionGate> {
  final SessionService _sessionService = SessionService();
  final ConnectivityService _connectivityService = ConnectivityService();
  final ProfileCacheService _cacheService = ProfileCacheService();
  final ProfileApiService _profileApiService = ProfileApiService();
  final WidgetSyncService _widgetSync = WidgetSyncService();
  final WebViewControllerHandle _webHandle = WebViewControllerHandle();

  StreamSubscription<bool>? _connectivitySub;
  bool _ready = false;
  bool _loggedIn = false;
  bool _online = false;
  bool _handlingToken = false;
  ProfileData? _cachedProfile;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _bootstrap();
    _connectivitySub = _connectivityService.onStatusChanged.listen((online) {
      if (!mounted) return;
      setState(() => _online = online);
      if (online && _loggedIn) {
        _refreshProfile();
      }
    });
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    try {
      await _widgetSync.configure();
    } catch (_) {}
    var hasSession = false;
    var online = true;
    ProfileData? cached;
    try {
      hasSession = await _sessionService.hasActiveSession();
    } catch (_) {}
    try {
      online = await _connectivityService.hasConnection();
    } catch (_) {}
    try {
      cached = await _cacheService.getCachedProfile();
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _loggedIn = hasSession;
      _online = online;
      _cachedProfile = cached;
      _ready = true;
      if (hasSession && !online) {
        _errorMessage = 'Offline – view only';
      }
    });

    if (cached != null) {
      await _widgetSync.sync(cached);
    }
    if (hasSession && online) {
      await _refreshProfile(loadHomeIfLogin: true);
    }
  }

  Future<void> _refreshProfile({bool loadHomeIfLogin = false}) async {
    final token = await _sessionService.accessToken;
    final result = await _profileApiService.fetchProfile(token: token);
    if (result.unauthorized) {
      await _logout(fromExpiredSession: true);
      return;
    }
    if (result.profile != null) {
      final saved = await _cacheService.saveProfile(result.profile!);
      await _widgetSync.sync(saved);
      if (!mounted) return;
      setState(() {
        _cachedProfile = saved;
        _errorMessage = null;
      });
    } else if (_cachedProfile != null && mounted) {
      setState(() {
        _errorMessage = _online
            ? 'Could not refresh profile. Showing saved details.'
            : 'Offline – view only';
      });
    }
  }

  Future<void> _onTokenCaptured(String token) async {
    if (_handlingToken) return;
    _handlingToken = true;
    await _sessionService.storeSession(accessToken: token);
    if (!mounted) return;
    setState(() => _loggedIn = true);

    final result = await _profileApiService.fetchProfile(token: token);
    if (result.unauthorized) {
      _handlingToken = false;
      await _logout(fromExpiredSession: true);
      return;
    }
    if (result.profile != null) {
      final saved = await _cacheService.saveProfile(result.profile!);
      await _widgetSync.sync(saved);
      if (!mounted) return;
      setState(() {
        _cachedProfile = saved;
        _errorMessage = null;
      });
    }
    _handlingToken = false;
  }

  Future<void> _logout({bool fromExpiredSession = false}) async {
    final controller = _webHandle.controller;
    if (controller != null) {
      await clearWebSession(controller);
    }
    await _sessionService.clearSession();
    await _cacheService.clearCache();
    await _widgetSync.clear();
    if (!mounted) return;
    setState(() {
      _loggedIn = false;
      _cachedProfile = null;
      _errorMessage = fromExpiredSession ? 'Your session expired. Please log in.' : null;
    });
    try {
      await controller?.loadRequest(Uri.parse(AppConstants.loginUrl));
    } catch (_) {}
  }

  Future<void> _onUrlChanged(String url) async {
    if (url.startsWith(AppConstants.baseUrl)) {
      await _sessionService.saveLastUrl(url);
    }
  }

  bool get _showConnectOnly => _ready && !_loggedIn && !_online;

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(
        backgroundColor: AppConstants.bg,
        body: Center(
          child: CircularProgressIndicator(color: Colors.white),
        ),
      );
    }

    if (_showConnectOnly) {
      return const _ConnectToLoginScreen();
    }

    if (_loggedIn && _cachedProfile != null) {
      return OwnerHome(
        profile: _cachedProfile!,
        onLogout: _logout,
        errorMessage: _errorMessage,
        offline: !_online,
      );
    }

    if (_loggedIn) {
      return const Scaffold(
        backgroundColor: AppConstants.bg,
        body: Center(
          child: CircularProgressIndicator(color: Colors.white),
        ),
      );
    }

    return WebLoginShell(
      key: const ValueKey('tapna-login-webview'),
      initialUrl: AppConstants.loginUrl,
      showAppBar: false,
      enableTokenCapture: true,
      controllerHandle: _webHandle,
      onTokenCaptured: _onTokenCaptured,
      onLogout: _logout,
      onUrlChanged: _onUrlChanged,
    );
  }
}

class _ConnectToLoginScreen extends StatelessWidget {
  const _ConnectToLoginScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppConstants.bg,
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.wifi_off, color: AppConstants.mint, size: 48),
              SizedBox(height: 16),
              Text(
                'Connect to log in',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Tap Na needs a network connection the first time you sign in.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/app_constants.dart';
import '../../core/models/profile_data.dart';
import '../../core/services/connectivity_service.dart';
import '../../core/services/profile_api_service.dart';
import '../../core/services/profile_cache_service.dart';
import '../../core/services/session_service.dart';
import '../../core/services/widget_sync_service.dart';
import '../offline/offline_profile_card.dart';
import '../widget/widget_onboarding.dart';
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
  bool _showOnboarding = false;
  bool _handlingToken = false;
  ProfileData? _cachedProfile;
  String? _errorMessage;
  String _webUrl = AppConstants.loginUrl;

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
    String? lastUrl;
    try {
      hasSession = await _sessionService.hasActiveSession();
    } catch (_) {}
    try {
      online = await _connectivityService.hasConnection();
    } catch (_) {}
    try {
      cached = await _cacheService.getCachedProfile();
    } catch (_) {}
    try {
      lastUrl = await _sessionService.getLastUrl();
    } catch (_) {}

    var startUrl = AppConstants.loginUrl;
    if (hasSession) {
      startUrl = cached?.ownerHomeUrl ?? AppConstants.profileUrl;
      if (lastUrl != null &&
          lastUrl.startsWith(AppConstants.baseUrl) &&
          !lastUrl.contains('/login')) {
        startUrl = lastUrl;
      }
    }

    if (!mounted) return;
    setState(() {
      _loggedIn = hasSession;
      _online = online;
      _cachedProfile = cached;
      _webUrl = startUrl;
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
      await _injectIntoWeb(saved, token);
      if (!mounted) return;
      setState(() {
        _cachedProfile = saved;
        _errorMessage = null;
      });
      if (loadHomeIfLogin) {
        await _openOwnerHomeIfNeeded(saved);
      }
    } else if (_cachedProfile != null && mounted) {
      setState(() {
        _errorMessage = _online
            ? 'Could not refresh profile. Showing saved details.'
            : 'Offline – view only';
      });
    }
  }

  Future<void> _injectIntoWeb(ProfileData profile, String? token) async {
    final controller = _webHandle.controller;
    if (controller == null) return;
    await injectProfileIntoWebView(controller, profile, token);
  }

  Future<void> _openOwnerHomeIfNeeded(ProfileData profile) async {
    final controller = _webHandle.controller;
    if (controller == null) return;
    try {
      final current = await controller.currentUrl() ?? '';
      if (current.contains('/login') ||
          current.contains('/c/profile') ||
          current.isEmpty) {
        await controller.loadRequest(Uri.parse(profile.ownerHomeUrl));
      }
    } catch (_) {
      await controller.loadRequest(Uri.parse(profile.ownerHomeUrl));
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
      await _injectIntoWeb(saved, token);
      await _openOwnerHomeIfNeeded(saved);
      final showOnboarding = await _sessionService.shouldShowWidgetOnboarding();
      if (!mounted) return;
      setState(() {
        _cachedProfile = saved;
        _showOnboarding = showOnboarding;
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
      _showOnboarding = false;
      _cachedProfile = null;
      _errorMessage = fromExpiredSession ? 'Your session expired. Please log in.' : null;
      _webUrl = AppConstants.loginUrl;
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

  bool get _showNativeFallback =>
      _ready &&
      _loggedIn &&
      !_online &&
      _cachedProfile != null &&
      _webHandle.controller == null;

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(
        backgroundColor: AppConstants.cream,
        body: Center(
          child: CircularProgressIndicator(color: AppConstants.ink),
        ),
      );
    }

    if (_showConnectOnly) {
      return const _ConnectToLoginScreen();
    }

    if (_showNativeFallback) {
      return OfflineProfileCard(
        profile: _cachedProfile!,
        errorMessage: _errorMessage ?? 'Offline – view only',
        onLogout: _logout,
      );
    }

    return Stack(
      children: [
        WebLoginShell(
          key: const ValueKey('tapna-persistent-webview'),
          initialUrl: _webUrl,
          offline: _loggedIn && !_online,
          showAppBar: true,
          enableTokenCapture: !_loggedIn,
          controllerHandle: _webHandle,
          onTokenCaptured: _onTokenCaptured,
          onLogout: _logout,
          onUrlChanged: _onUrlChanged,
        ),
        if (_loggedIn && !_online)
          const Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: IgnorePointer(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(16, 56, 16, 0),
                  child: _OfflineBanner(),
                ),
              ),
            ),
          ),
        if (_errorMessage != null && _loggedIn && _online)
          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: Material(
              color: const Color(0xFF2D1B1B),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFFFD9D9)),
                ),
              ),
            ),
          ),
        if (_showOnboarding)
          Positioned.fill(
            child: WidgetOnboarding(
              onDone: () async {
                await _sessionService.markWidgetOnboardingSeen();
                if (!mounted) return;
                setState(() => _showOnboarding = false);
              },
            ),
          ),
      ],
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xCC111111),
      borderRadius: BorderRadius.circular(999),
      child: const Padding(
        padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Text(
          'Offline – view only',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppConstants.mint,
            fontSize: 12,
            letterSpacing: 1.1,
          ),
        ),
      ),
    );
  }
}

class _ConnectToLoginScreen extends StatelessWidget {
  const _ConnectToLoginScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.black,
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

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../../core/app_constants.dart';
import '../../core/models/profile_data.dart';

class WebLoginShell extends StatefulWidget {
  const WebLoginShell({
    super.key,
    required this.initialUrl,
    this.offline = false,
    this.showAppBar = false,
    this.onTokenCaptured,
    this.onLogout,
    this.onUrlChanged,
    this.controllerHandle,
    this.enableTokenCapture = true,
  });

  final String initialUrl;
  final bool offline;
  final bool showAppBar;
  final Future<void> Function(String token)? onTokenCaptured;
  final Future<void> Function()? onLogout;
  final Future<void> Function(String url)? onUrlChanged;
  final WebViewControllerHandle? controllerHandle;
  final bool enableTokenCapture;

  @override
  State<WebLoginShell> createState() => _WebLoginShellState();
}

class WebViewControllerHandle {
  WebViewController? controller;
}

class _WebLoginShellState extends State<WebLoginShell> {
  late final WebViewController _controller;
  Timer? _tokenPoll;
  bool _isLoaded = false;
  bool _tokenEmitted = false;
  bool _writeGuardInjected = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            if (!mounted) return;
            setState(() => _isLoaded = true);
          },
          onPageFinished: (url) async {
            if (!mounted) return;
            setState(() => _isLoaded = true);
            await widget.onUrlChanged?.call(url);
            await _tryCaptureToken();
            if (widget.offline) {
              await injectOfflineWriteGuard(_controller);
              _writeGuardInjected = true;
            }
          },
          onWebResourceError: (_) {
            if (!mounted) return;
            setState(() => _isLoaded = true);
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;
            if (_isTapNaHost(uri.host)) {
              return NavigationDecision.navigate;
            }
            launchUrl(uri, mode: LaunchMode.externalApplication);
            return NavigationDecision.prevent;
          },
        ),
      );
    _configurePlatform();
    widget.controllerHandle?.controller = _controller;
    _controller.loadRequest(Uri.parse(widget.initialUrl));
    _tokenPoll = Timer.periodic(const Duration(seconds: 1), (_) {
      _tryCaptureToken();
    });
  }

  void _configurePlatform() {
    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
      try {
        platform.setOnShowFileSelector((_) async => <String>[]);
      } catch (_) {}
    }
  }

  bool _isTapNaHost(String host) {
    return host == 'tapnam.com' ||
        host == 'www.tapnam.com' ||
        host.endsWith('.tapnam.com');
  }

  Future<void> _tryCaptureToken() async {
    if (_tokenEmitted ||
        !widget.enableTokenCapture ||
        widget.onTokenCaptured == null) {
      return;
    }
    try {
      final result = await _controller.runJavaScriptReturningResult(
        "localStorage.getItem('tapna.apiToken')",
      );
      final token = _unquoteJs(result);
      if (token == null || token.isEmpty) return;
      _tokenEmitted = true;
      _tokenPoll?.cancel();
      await widget.onTokenCaptured!(token);
    } catch (_) {}
  }

  @override
  void didUpdateWidget(WebLoginShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    widget.controllerHandle?.controller = _controller;
    if (widget.offline && !_writeGuardInjected) {
      injectOfflineWriteGuard(_controller);
      _writeGuardInjected = true;
    }
    if (!widget.offline && oldWidget.offline) {
      _writeGuardInjected = false;
    }
    if (widget.enableTokenCapture && !oldWidget.enableTokenCapture) {
      _tokenEmitted = false;
      _tokenPoll?.cancel();
      _tokenPoll = Timer.periodic(const Duration(seconds: 1), (_) {
        _tryCaptureToken();
      });
    }
    if (!widget.enableTokenCapture) {
      _tokenPoll?.cancel();
    }
  }

  @override
  void dispose() {
    _tokenPoll?.cancel();
    super.dispose();
  }

  Future<void> _logout() async {
    await clearWebSession(_controller);
    if (widget.onLogout != null) {
      await widget.onLogout!();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: widget.showAppBar
          ? AppBar(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              title: const Text('Tap Na'),
              actions: [
                IconButton(
                  onPressed: _logout,
                  icon: const Icon(Icons.logout),
                  tooltip: 'Log out',
                ),
              ],
            )
          : null,
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (!_isLoaded)
            const Positioned.fill(
              child: ColoredBox(
                color: Colors.black,
                child: Center(
                  child: CircularProgressIndicator(color: AppConstants.mint),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

String? unquoteJs(dynamic value) => _unquoteJs(value);

String? _unquoteJs(dynamic value) {
  if (value == null) return null;
  var text = value.toString().trim();
  if (text == 'null' || text == 'undefined' || text.isEmpty) return null;
  if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
    text = text.substring(1, text.length - 1);
  }
  text = text.replaceAll(r'\"', '"');
  return text.isEmpty ? null : text;
}

Future<void> injectProfileIntoWebView(
  WebViewController controller,
  ProfileData profile,
  String? token,
) async {
  final profileJson = jsonEncode(profile.toSpaLocalStorage());
  final sessionJson = jsonEncode({
    'loggedIn': true,
    'at': DateTime.now().millisecondsSinceEpoch,
  });
  final tokenJs = token == null ? 'null' : jsonEncode(token);
  await controller.runJavaScript('''
    (function() {
      try {
        localStorage.setItem('tapna_profile', JSON.stringify($profileJson));
        localStorage.setItem('tapna_session', JSON.stringify($sessionJson));
        if ($tokenJs) {
          localStorage.setItem('tapna.apiToken', $tokenJs);
        }
      } catch (e) {}
    })();
  ''');
}

Future<void> injectOfflineWriteGuard(WebViewController controller) async {
  await controller.runJavaScript('''
    (function() {
      if (window.__tapnaOfflineGuard) return;
      window.__tapnaOfflineGuard = true;
      const block = function() {
        return Promise.reject(new Error('Offline – view only'));
      };
      const origFetch = window.fetch;
      window.fetch = function(input, init) {
        const method = ((init && init.method) || 'GET').toUpperCase();
        if (['POST','PUT','PATCH','DELETE'].indexOf(method) >= 0) {
          try { window.alert('Offline – view only'); } catch (e) {}
          return block();
        }
        return origFetch.apply(this, arguments);
      };
      const origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method) {
        this.__tapnaMethod = String(method || 'GET').toUpperCase();
        return origOpen.apply(this, arguments);
      };
      const origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        if (['POST','PUT','PATCH','DELETE'].indexOf(this.__tapnaMethod || '') >= 0) {
          try { window.alert('Offline – view only'); } catch (e) {}
          this.abort();
          return;
        }
        return origSend.apply(this, arguments);
      };
    })();
  ''');
}

Future<void> clearWebSession(WebViewController controller) async {
  try {
    await controller.runJavaScript('''
      (function() {
        try {
          localStorage.removeItem('tapna.apiToken');
          localStorage.removeItem('tapna_session');
          localStorage.removeItem('tapna_profile');
        } catch (e) {}
      })();
    ''');
  } catch (_) {}
  try {
    await WebViewCookieManager().clearCookies();
  } catch (_) {}
  if (!kIsWeb) {
    try {
      await controller.clearCache();
      await controller.clearLocalStorage();
    } catch (_) {}
  }
}

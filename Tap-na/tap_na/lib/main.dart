import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';

import 'core/app_constants.dart';
import 'features/auth/session_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await HomeWidget.setAppGroupId(AppConstants.appGroupId);
  } catch (_) {}
  runApp(const TapNaApp());
}

class TapNaApp extends StatelessWidget {
  const TapNaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppConstants.bg,
        colorScheme: const ColorScheme.dark(
          surface: AppConstants.bg,
          primary: Colors.white,
          secondary: AppConstants.textSecondary,
        ),
      ),
      home: const SessionGate(),
    );
  }
}

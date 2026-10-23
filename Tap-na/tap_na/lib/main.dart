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
        scaffoldBackgroundColor: Colors.black,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppConstants.ink,
          brightness: Brightness.dark,
        ),
      ),
      home: const SessionGate(),
    );
  }
}

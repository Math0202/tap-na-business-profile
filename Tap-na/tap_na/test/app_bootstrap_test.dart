import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tap_na/main.dart';

void main() {
  testWidgets('app boots with Tap Na shell', (tester) async {
    await tester.pumpWidget(const TapNaApp());

    expect(find.byType(MaterialApp), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

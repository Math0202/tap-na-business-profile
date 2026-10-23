import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tap_na/core/app_constants.dart';
import 'package:tap_na/features/widget/widget_onboarding.dart';

void main() {
  testWidgets('onboarding shows three widget previews', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: WidgetOnboarding()),
    );

    expect(find.text('Tap Na QR'), findsOneWidget);
    expect(find.text('Tap Na Card'), findsOneWidget);
    expect(find.text('Tap Na Profile'), findsOneWidget);
    expect(find.text('Add your Tap Na widget'), findsOneWidget);
  });

  test('companion exposes three android widget names', () {
    expect(AppConstants.androidWidgetNames, [
      'TapNaQrWidget',
      'TapNaCardWidget',
      'TapNaProfileWidget',
      'TapNaProfileLargeWidget',
    ]);
  });
}

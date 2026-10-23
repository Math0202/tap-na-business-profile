import 'package:flutter_test/flutter_test.dart';
import 'package:tap_na/main.dart';

void main() {
  testWidgets('Tap Na app builds', (WidgetTester tester) async {
    await tester.pumpWidget(const TapNaApp());

    expect(tester.takeException(), isNull);
  });
}

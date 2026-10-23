import 'package:flutter_test/flutter_test.dart';
import 'package:tap_na/core/models/profile_data.dart';
import 'package:tap_na/core/models/vcard.dart';
import 'package:tap_na/features/home/owner_home.dart';
import 'package:flutter/material.dart';

void main() {
  test('share vcard includes contact fields for the contacts app', () {
    final profile = ProfileData.fromApi({
      'publicProfileUrl': 'https://tapnam.com/c/ada',
      'profile': {
        'name': 'Ada Lovelace',
        'title': 'Director',
        'company': 'Tap Na',
        'phone': '+264811234567',
        'email': 'ada@tapnam.com',
      },
    });
    final vcard = buildShareVcard(profile);
    expect(vcard, contains('BEGIN:VCARD'));
    expect(vcard, contains('FN:Ada Lovelace'));
    expect(vcard, contains('TEL;TYPE=CELL:+264811234567'));
    expect(vcard, contains('EMAIL:ada@tapnam.com'));
    expect(vcard, contains('URL:https://tapnam.com/c/ada'));
    expect(vcard, contains('END:VCARD'));
  });

  testWidgets('home shows widget previews and share actions', (tester) async {
    final profile = ProfileData.fromApi({
      'publicProfileUrl': 'https://tapnam.com/c/ada',
      'profile': {
        'name': 'Ada',
        'title': 'Director',
        'company': 'Tap Na',
      },
    });
    await tester.pumpWidget(
      MaterialApp(
        home: OwnerHome(profile: profile, onLogout: () async {}),
      ),
    );
    await tester.pump();
    expect(find.text('Tap Na QR'), findsOneWidget);
    expect(find.text('Tap Na Card'), findsOneWidget);
    expect(find.text('Tap Na Profile'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Tap Na Profile 4x4'), 400);
    expect(find.text('Tap Na Profile 4x4'), findsOneWidget);
    expect(find.text('Ada'), findsWidgets);
    expect(find.text('Director'), findsWidgets);
    expect(find.text('Tap Na'), findsWidgets);
    await tester.scrollUntilVisible(find.text('Share Profile'), 400);
    expect(find.text('Share Details'), findsOneWidget);
    expect(find.text('NFC'), findsOneWidget);
    expect(find.text('Edit Profile'), findsOneWidget);

    await tester.tap(find.text('Share Profile'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Scan to open this profile.'), findsOneWidget);
    expect(find.text('Copy profile link'), findsOneWidget);
    expect(find.text('WhatsApp'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);
  });
}

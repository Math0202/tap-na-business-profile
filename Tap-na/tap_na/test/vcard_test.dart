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
    expect(find.text('Add 2x2 Widget'), findsOneWidget);
    expect(find.text('Add 4x2 Widget'), findsOneWidget);
    expect(find.text('Add 2x4 Widget'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Add 4x4 Widget'), 400);
    expect(find.text('Add 4x4 Widget'), findsOneWidget);
    expect(find.text('Ada'), findsWidgets);
    expect(find.text('Director'), findsWidgets);
    expect(find.text('Tap Na'), findsWidgets);
    expect(find.text('Share Contacts'), findsOneWidget);
    expect(find.text('Phone-to-Phone'), findsOneWidget);
    expect(find.text('Edit Profile'), findsOneWidget);
  });
}

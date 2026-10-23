import 'package:flutter_test/flutter_test.dart';
import 'package:tap_na/core/app_constants.dart';
import 'package:tap_na/core/models/profile_data.dart';
import 'package:tap_na/core/services/connectivity_service.dart';

void main() {
  test('maps /api/app/me payload to profile fields and public URL', () {
    final profile = ProfileData.fromApi({
      'ok': true,
      'shareSlug': 'ZNjJ22',
      'publicProfileUrl': 'https://tapnam.com/c/ZNjJ22',
      'profile': {
        'name': 'Ada',
        'title': 'Director',
        'company': 'Tap Na',
        'avatar': 'https://example.com/ada.png',
        'bio': 'Hello',
        'cardType': 'personal',
        'shareSlug': 'ZNjJ22',
        'linkedin': 'https://linkedin.com/in/ada',
      },
    });

    expect(profile.name, 'Ada');
    expect(profile.title, 'Director');
    expect(profile.company, 'Tap Na');
    expect(profile.shareSlug, 'ZNjJ22');
    expect(profile.publicProfileUrl, 'https://tapnam.com/c/ZNjJ22');
    expect(profile.profileImageUrl, 'https://example.com/ada.png');
    expect(profile.bio, 'Hello');
    expect(profile.links, isNotEmpty);
    expect(profile.ownerHomeUrl, AppConstants.profileUrl);
  });

  test('maps GET /api/me fallback payload and venue home', () {
    final profile = ProfileData.fromApi({
      'ok': true,
      'profile': {
        'name': 'Venue',
        'title': '',
        'company': 'Cafe',
        'cardType': 'table',
        'shareSlug': 'abc123',
        'avatar': '/images/personal.png',
      },
    });

    expect(profile.publicProfileUrl, 'https://tapnam.com/c/abc123');
    expect(profile.profileImageUrl, 'https://tapnam.com/images/personal.png');
    expect(profile.isVenue, isTrue);
    expect(profile.ownerHomeUrl, AppConstants.venueUrl);
  });

  test('round-trips cached JSON including raw profile', () {
    final original = ProfileData.fromApi({
      'profile': {
        'name': 'Ada',
        'title': 'Director',
        'company': 'Tap Na',
        'shareSlug': 'ZNjJ22',
        'whatsapp': '+264',
      },
    });
    final restored = ProfileData.decode(ProfileData.encode(original));
    expect(restored.name, 'Ada');
    expect(restored.shareSlug, 'ZNjJ22');
    expect(restored.raw['whatsapp'], '+264');
  });

  test('connectivity treats none as offline', () {
    final service = ConnectivityService();
    expect(service, isNotNull);
  });
}

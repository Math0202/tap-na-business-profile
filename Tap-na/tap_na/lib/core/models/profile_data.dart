import 'dart:convert';

import '../app_constants.dart';

class ProfileData {
  ProfileData({
    required this.name,
    required this.title,
    required this.company,
    required this.publicProfileUrl,
    required this.raw,
    this.shareSlug = '',
    this.cardType = 'personal',
    this.profileImageUrl,
    this.localImagePath,
    this.bio = '',
    this.links = const [],
    DateTime? lastUpdated,
  }) : lastUpdated = lastUpdated ?? DateTime.now();

  final String name;
  final String title;
  final String company;
  final String publicProfileUrl;
  final String shareSlug;
  final String cardType;
  final String? profileImageUrl;
  final String? localImagePath;
  final String bio;
  final List<ProfileLink> links;
  final Map<String, dynamic> raw;
  final DateTime lastUpdated;

  bool get isVenue => cardType == 'table';
  String get safeName => name.trim().isNotEmpty ? name : 'Tap Na User';
  String get safeCompany => company.trim().isNotEmpty ? company : 'Tap Na';
  String get ownerHomeUrl => AppConstants.ownerHomeUrl(isVenue: isVenue);

  ProfileData copyWith({
    String? name,
    String? title,
    String? company,
    String? publicProfileUrl,
    String? shareSlug,
    String? cardType,
    String? profileImageUrl,
    String? localImagePath,
    String? bio,
    List<ProfileLink>? links,
    Map<String, dynamic>? raw,
    DateTime? lastUpdated,
  }) {
    return ProfileData(
      name: name ?? this.name,
      title: title ?? this.title,
      company: company ?? this.company,
      publicProfileUrl: publicProfileUrl ?? this.publicProfileUrl,
      shareSlug: shareSlug ?? this.shareSlug,
      cardType: cardType ?? this.cardType,
      profileImageUrl: profileImageUrl ?? this.profileImageUrl,
      localImagePath: localImagePath ?? this.localImagePath,
      bio: bio ?? this.bio,
      links: links ?? this.links,
      raw: raw ?? this.raw,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'title': title,
      'company': company,
      'publicProfileUrl': publicProfileUrl,
      'shareSlug': shareSlug,
      'cardType': cardType,
      'profileImageUrl': profileImageUrl,
      'localImagePath': localImagePath,
      'bio': bio,
      'links': links.map((item) => item.toJson()).toList(),
      'raw': raw,
      'lastUpdated': lastUpdated.toUtc().toIso8601String(),
    };
  }

  factory ProfileData.fromJson(Map<String, dynamic> json) {
    final raw = Map<String, dynamic>.from(_asMap(json['raw']) ?? json);
    if (json['publicProfileUrl'] != null) {
      raw['publicProfileUrl'] = json['publicProfileUrl'];
    }
    if (json['shareSlug'] != null) {
      raw['shareSlug'] = json['shareSlug'];
    }
    return ProfileData.fromApi(raw).copyWith(
      localImagePath: json['localImagePath'] as String?,
      lastUpdated:
          DateTime.tryParse(json['lastUpdated'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  factory ProfileData.fromApi(Map<String, dynamic> json) {
    final nested = _asMap(json['profile']);
    final profile = nested ?? json;
    final shareSlug = (json['shareSlug'] as String? ??
            profile['shareSlug'] as String? ??
            '')
        .trim();
    final publicUrl =
        (json['publicProfileUrl'] as String? ??
                profile['publicProfileUrl'] as String? ??
                '')
            .trim();
    return ProfileData(
      name: (profile['name'] as String? ?? '').trim(),
      title: (profile['title'] as String? ?? '').trim(),
      company: (profile['company'] as String? ?? '').trim(),
      shareSlug: shareSlug,
      cardType: (profile['cardType'] as String? ?? 'personal').trim(),
      publicProfileUrl: publicUrl.isNotEmpty
          ? publicUrl
          : (shareSlug.isEmpty
                ? ''
                : '${AppConstants.baseUrl}/c/$shareSlug'),
      profileImageUrl: _firstNonEmpty([
        profile['avatar'] as String?,
        profile['profileImageUrl'] as String?,
        profile['logo'] as String?,
      ]),
      bio: (profile['bio'] as String? ?? '').trim(),
      links: _extractLinks(profile),
      raw: Map<String, dynamic>.from(profile),
    );
  }

  static String encode(ProfileData profile) => jsonEncode(profile.toJson());

  static ProfileData decode(String value) => ProfileData.fromJson(
    jsonDecode(value) as Map<String, dynamic>,
  );

  Map<String, dynamic> toSpaLocalStorage() {
    final payload = Map<String, dynamic>.from(raw);
    payload['name'] = name;
    payload['title'] = title;
    payload['company'] = company;
    payload['shareSlug'] = shareSlug;
    if (profileImageUrl != null && profileImageUrl!.isNotEmpty) {
      payload['avatar'] = profileImageUrl;
    }
    return payload;
  }
}

class ProfileLink {
  const ProfileLink({required this.label, required this.url});

  final String label;
  final String url;

  Map<String, dynamic> toJson() => {'label': label, 'url': url};

  factory ProfileLink.fromJson(Map<String, dynamic> json) {
    return ProfileLink(
      label: (json['label'] as String? ?? '').trim(),
      url: (json['url'] as String? ?? '').trim(),
    );
  }
}

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

String? _firstNonEmpty(List<String?> values) {
  for (final value in values) {
    if (value != null && value.trim().isNotEmpty) return value.trim();
  }
  return null;
}

List<ProfileLink> _extractLinks(Map<String, dynamic> profile) {
  const keys = [
    'website',
    'whatsapp',
    'linkedin',
    'youtube',
    'x',
    'facebook',
    'instagram',
    'tiktok',
    'email',
    'phone',
  ];
  final links = <ProfileLink>[];
  for (final key in keys) {
    final value = (profile[key] as String? ?? '').trim();
    if (value.isNotEmpty) {
      links.add(ProfileLink(label: key, url: value));
    }
  }
  final stored = profile['links'];
  if (stored is List) {
    for (final item in stored) {
      final map = _asMap(item);
      if (map == null) continue;
      final link = ProfileLink.fromJson(map);
      if (link.url.isNotEmpty) links.add(link);
    }
  }
  return links;
}

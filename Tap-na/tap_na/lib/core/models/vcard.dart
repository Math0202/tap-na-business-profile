import 'profile_data.dart';

String buildShareVcard(ProfileData profile) {
  final name = profile.safeName;
  final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  final first = parts.isEmpty ? '' : parts.first;
  final last = parts.length < 2 ? '' : parts.sublist(1).join(' ');
  final lines = <String>[
    'BEGIN:VCARD',
    'VERSION:3.0',
    if (name.isNotEmpty) 'FN:${_escape(name)}',
    if (name.isNotEmpty) 'N:${_escape(last)};${_escape(first)};;;',
    if (profile.title.trim().isNotEmpty) 'TITLE:${_escape(profile.title.trim())}',
    if (profile.company.trim().isNotEmpty) 'ORG:${_escape(profile.company.trim())}',
    if (profile.phone.isNotEmpty) 'TEL;TYPE=CELL:${_escape(profile.phone)}',
    if (profile.email.isNotEmpty) 'EMAIL:${_escape(profile.email)}',
    if (profile.publicProfileUrl.isNotEmpty)
      'URL:${_escape(profile.publicProfileUrl)}',
    'END:VCARD',
  ];
  return lines.join('\r\n');
}

String _escape(String value) {
  return value
      .replaceAll('\\', '\\\\')
      .replaceAll(';', '\\;')
      .replaceAll(',', '\\,')
      .replaceAll(RegExp(r'\r?\n'), '\\n');
}

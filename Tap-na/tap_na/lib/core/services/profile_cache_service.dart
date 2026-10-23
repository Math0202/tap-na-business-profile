import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/profile_data.dart';

class ProfileCacheService {
  static const String cacheKey = 'tapna_cached_profile';

  Future<ProfileData> saveProfile(ProfileData profile) async {
    final prefs = await SharedPreferences.getInstance();
    final localPath = await _downloadProfileImage(
      profile.profileImageUrl,
      profile.shareSlug.isNotEmpty ? profile.shareSlug : profile.safeName,
    );
    await _downloadNamed(profile.raw['logo'] as String?, 'logo');
    await _downloadNamed(profile.raw['banner'] as String?, 'banner');

    final toPersist = profile.copyWith(
      localImagePath: localPath ?? profile.localImagePath,
    );
    await prefs.setString(cacheKey, ProfileData.encode(toPersist));
    return toPersist;
  }

  Future<ProfileData?> getCachedProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(cacheKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }
    try {
      return ProfileData.decode(raw);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(cacheKey);
  }

  Future<String?> _downloadNamed(String? imageUrl, String name) async {
    if (imageUrl == null || imageUrl.trim().isEmpty) return null;
    if (!imageUrl.startsWith('http')) return null;
    try {
      final response = await http.get(Uri.parse(imageUrl));
      if (response.statusCode != 200) return null;
      final directory = await getApplicationDocumentsDirectory();
      final file = File('${directory.path}/tapna_$name.bin');
      await file.writeAsBytes(response.bodyBytes);
      return file.path;
    } catch (_) {
      return null;
    }
  }

  Future<String?> _downloadProfileImage(
    String? imageUrl,
    String fallbackId,
  ) async {
    if (imageUrl == null || imageUrl.trim().isEmpty) return null;
    if (!imageUrl.startsWith('http')) return null;
    try {
      final response = await http.get(Uri.parse(imageUrl));
      if (response.statusCode != 200) return null;
      final directory = await getApplicationDocumentsDirectory();
      final targetPath =
          '${directory.path}/tapna_profile_${fallbackId.hashCode}.png';
      final file = File(targetPath);
      await file.writeAsBytes(response.bodyBytes);
      return file.path;
    } catch (_) {
      return null;
    }
  }
}

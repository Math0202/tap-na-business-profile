import 'dart:convert';

import 'package:http/http.dart' as http;

import '../app_constants.dart';
import '../models/profile_data.dart';

class ProfileFetchResult {
  const ProfileFetchResult({this.profile, this.unauthorized = false});

  final ProfileData? profile;
  final bool unauthorized;
}

class ProfileApiService {
  Future<ProfileFetchResult> fetchProfile({String? token}) async {
    if (token == null || token.trim().isEmpty) {
      return const ProfileFetchResult();
    }

    final headers = {
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
    };

    try {
      final primary = await http.get(
        Uri.parse(AppConstants.profileApiEndpoint),
        headers: headers,
      );
      final parsed = _parse(primary);
      if (parsed.profile != null || parsed.unauthorized) {
        return parsed;
      }

      final fallback = await http.get(
        Uri.parse(AppConstants.profileApiFallbackEndpoint),
        headers: headers,
      );
      return _parse(fallback);
    } catch (_) {
      return const ProfileFetchResult();
    }
  }

  ProfileFetchResult _parse(http.Response response) {
    if (response.statusCode == 401 || response.statusCode == 403) {
      return const ProfileFetchResult(unauthorized: true);
    }
    if (response.statusCode != 200) {
      return const ProfileFetchResult();
    }
    try {
      final json = jsonDecode(response.body);
      if (json is! Map<String, dynamic>) {
        return const ProfileFetchResult();
      }
      return ProfileFetchResult(profile: ProfileData.fromApi(json));
    } catch (_) {
      return const ProfileFetchResult();
    }
  }
}

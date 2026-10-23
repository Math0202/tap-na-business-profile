import 'dart:io';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/app_constants.dart';
import '../../core/models/profile_data.dart';

class OfflineProfileCard extends StatelessWidget {
  const OfflineProfileCard({
    super.key,
    required this.profile,
    this.errorMessage,
    this.onLogout,
  });

  final ProfileData profile;
  final String? errorMessage;
  final Future<void> Function()? onLogout;

  @override
  Widget build(BuildContext context) {
    final image = profile.localImagePath != null
        ? Image.file(File(profile.localImagePath!), fit: BoxFit.cover)
        : null;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Tap Na'),
        actions: [
          if (onLogout != null)
            IconButton(
              onPressed: () async => onLogout!(),
              icon: const Icon(Icons.logout),
            ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Container(
              width: 420,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF121212),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white12),
              ),
              child: Column(
                children: [
                  if (errorMessage != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 18),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2D1B1B),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        errorMessage!,
                        style: const TextStyle(
                          color: Color(0xFFFFD9D9),
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ClipOval(
                    child: SizedBox(
                      width: 110,
                      height: 110,
                      child: image ??
                          Container(
                            color: AppConstants.mint,
                            child: const Icon(
                              Icons.person,
                              size: 56,
                              color: Colors.black,
                            ),
                          ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  Text(
                    profile.safeName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (profile.title.trim().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      profile.title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppConstants.mint,
                        fontSize: 18,
                      ),
                    ),
                  ],
                  if (profile.company.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      profile.company,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 16,
                      ),
                    ),
                  ],
                  if (profile.bio.trim().isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text(
                      profile.bio,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ],
                  if (profile.links.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    ...profile.links.take(8).map(
                      (link) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(
                          '${link.label}: ${link.url}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white60,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  ],
                  if (profile.publicProfileUrl.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: QrImageView(
                        data: profile.publicProfileUrl,
                        size: 180,
                        backgroundColor: Colors.white,
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  const Text(
                    'Offline – view only',
                    style: TextStyle(
                      color: AppConstants.mint,
                      fontSize: 12,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

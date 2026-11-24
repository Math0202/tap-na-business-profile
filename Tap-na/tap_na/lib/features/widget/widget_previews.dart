import 'dart:io';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/models/profile_data.dart';

class WidgetPreviewOption extends StatelessWidget {
  const WidgetPreviewOption({
    super.key,
    required this.title,
    required this.child,
    this.onTap,
  });

  final String title;
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          child,
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFFA1A1AA), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class WidgetQrPreview extends StatelessWidget {
  const WidgetQrPreview({super.key, this.size = 72, this.profile});

  final double size;
  final ProfileData? profile;

  @override
  Widget build(BuildContext context) {
    final url = profile?.publicProfileUrl.trim() ?? '';
    return _Shell(
      width: size,
      height: size,
      child: _QrPlate(data: url, iconSize: size * 0.4),
    );
  }
}

class WidgetCardPreview extends StatelessWidget {
  const WidgetCardPreview({super.key, this.width, this.height = 110, this.profile});

  final double? width;
  final double height;
  final ProfileData? profile;

  @override
  Widget build(BuildContext context) {
    return _Shell(
      width: width,
      height: height,
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: _IdentityPanel(profile: profile, compact: true),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 6,
            child: _QrPlate(data: profile?.publicProfileUrl.trim() ?? ''),
          ),
        ],
      ),
    );
  }
}

class WidgetProfilePreview extends StatelessWidget {
  const WidgetProfilePreview({
    super.key,
    this.width,
    this.height = 180,
    this.profile,
  });

  final double? width;
  final double height;
  final ProfileData? profile;

  @override
  Widget build(BuildContext context) {
    return _Shell(
      width: width,
      height: height,
      child: Column(
        children: [
          Expanded(
            flex: 5,
            child: _IdentityPanel(profile: profile, compact: false),
          ),
          const SizedBox(height: 8),
          Expanded(
            flex: 3,
            child: _QrPlate(data: profile?.publicProfileUrl.trim() ?? ''),
          ),
        ],
      ),
    );
  }
}

class _IdentityPanel extends StatelessWidget {
  const _IdentityPanel({this.profile, required this.compact});

  final ProfileData? profile;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final photo = profile?.localImagePath;
    final hasPhoto = photo != null && File(photo).existsSync();
    final name = profile?.safeName ?? '';
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(compact ? 8 : 10),
      decoration: BoxDecoration(
        color: const Color(0xFF2A2A2A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Expanded(
            child: Center(
              child: AspectRatio(
                aspectRatio: 1,
                child: hasPhoto
                    ? ClipOval(
                        child: Image.file(File(photo), fit: BoxFit.cover),
                      )
                    : CircleAvatar(
                        backgroundColor: const Color(0xFF3F3F46),
                        child: name.isEmpty
                            ? null
                            : Text(
                                name.substring(0, 1).toUpperCase(),
                                style: const TextStyle(color: Colors.white),
                              ),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          if (profile == null) ...[
            const _Bar(width: 56),
            const SizedBox(height: 4),
            const _Bar(width: 40, color: Color(0xFF52525B)),
          ] else ...[
            Text(
              profile!.safeName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Colors.white,
                fontSize: compact ? 11 : 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (profile!.title.isNotEmpty)
              Text(
                profile!.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: const Color(0xFFA1A1AA),
                  fontSize: compact ? 9 : 11,
                ),
              ),
            if (profile!.company.isNotEmpty)
              Text(
                profile!.company,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: const Color(0xFF71717A),
                  fontSize: compact ? 9 : 11,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _QrPlate extends StatelessWidget {
  const _QrPlate({required this.data, this.iconSize = 40});

  final String data;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(8),
      child: data.isEmpty
          ? Icon(Icons.qr_code_2, color: Colors.black, size: iconSize)
          : QrImageView(
              data: data,
              padding: EdgeInsets.zero,
              backgroundColor: Colors.white,
            ),
    );
  }
}

class _Shell extends StatelessWidget {
  const _Shell({required this.child, this.width, this.height});

  final Widget child;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: const Color(0xFF121212),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF3A3A3A)),
      ),
      child: child,
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.width, this.color = Colors.white70});

  final double width;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: 6,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
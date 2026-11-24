import 'dart:io';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/app_constants.dart';
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
      child: Stack(
        children: [
          Positioned.fill(child: _QrPlate(data: url, iconSize: size * 0.4)),
          Positioned(
            right: 4,
            bottom: 4,
            child: _AvatarBadge(profile: profile, size: size * 0.28),
          ),
        ],
      ),
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
          _AvatarBadge(profile: profile, size: height * 0.62),
          const SizedBox(width: 8),
          Expanded(
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
          _AvatarBadge(profile: profile, size: height * 0.22),
          const SizedBox(height: 8),
          Expanded(
            child: _QrPlate(data: profile?.publicProfileUrl.trim() ?? ''),
          ),
        ],
      ),
    );
  }
}

class _AvatarBadge extends StatelessWidget {
  const _AvatarBadge({required this.profile, required this.size});

  final ProfileData? profile;
  final double size;

  @override
  Widget build(BuildContext context) {
    final photo = profile?.localImagePath;
    final hasPhoto = photo != null && File(photo).existsSync();
    final name = profile?.safeName ?? '';
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
      ),
      padding: EdgeInsets.all(size * 0.06),
      child: ClipOval(
        child: hasPhoto
            ? Image.file(File(photo), fit: BoxFit.cover)
            : ColoredBox(
                color: const Color(0xFF3F3F46),
                child: Center(
                  child: name.isEmpty
                      ? null
                      : Text(
                          name.substring(0, 1).toUpperCase(),
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: size * 0.35,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
              ),
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
    final isDark =
        MediaQuery.platformBrightnessOf(context) == Brightness.dark;
    return Container(
      width: width,
      height: height,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isDark ? AppConstants.bg : AppConstants.cream,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? const Color(0xFF3A3A3A) : const Color(0xFFD6D0C4),
        ),
      ),
      child: child,
    );
  }
}

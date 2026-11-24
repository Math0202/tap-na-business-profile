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
      child: _QrPlate(data: profile?.publicProfileUrl.trim() ?? ''),
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
      child: _QrPlate(data: profile?.publicProfileUrl.trim() ?? ''),
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

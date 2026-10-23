import 'package:flutter/material.dart';

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
            style: const TextStyle(color: Color(0xFFA1A1AA), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class WidgetQrPreview extends StatelessWidget {
  const WidgetQrPreview({super.key, this.size = 72});

  final double size;

  @override
  Widget build(BuildContext context) {
    return _Shell(
      width: size + 16,
      height: size + 16,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(Icons.qr_code_2, color: Colors.black, size: 48),
      ),
    );
  }
}

class WidgetCardPreview extends StatelessWidget {
  const WidgetCardPreview({super.key});

  @override
  Widget build(BuildContext context) {
    return _Shell(
      width: 220,
      height: 110,
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF2A2A2A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Column(
                children: [
                  Expanded(child: _PhotoDot()),
                  SizedBox(height: 6),
                  _Bar(width: 48),
                  SizedBox(height: 4),
                  _Bar(width: 36, color: Color(0xFF52525B)),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 6,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.qr_code_2, color: Colors.black),
            ),
          ),
        ],
      ),
    );
  }
}

class WidgetProfilePreview extends StatelessWidget {
  const WidgetProfilePreview({super.key});

  @override
  Widget build(BuildContext context) {
    return _Shell(
      width: 120,
      height: 180,
      child: Column(
        children: [
          Expanded(
            flex: 5,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF2A2A2A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Column(
                children: [
                  Expanded(child: _PhotoDot()),
                  SizedBox(height: 6),
                  _Bar(width: 56),
                  SizedBox(height: 4),
                  _Bar(width: 40, color: Color(0xFF52525B)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            flex: 3,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Icon(Icons.qr_code_2, color: Colors.black, size: 40),
              ),
            ),
          ),
        ],
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

class _PhotoDot extends StatelessWidget {
  const _PhotoDot();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: AspectRatio(
        aspectRatio: 1,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Color(0xFF3F3F46),
            shape: BoxShape.circle,
          ),
        ),
      ),
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

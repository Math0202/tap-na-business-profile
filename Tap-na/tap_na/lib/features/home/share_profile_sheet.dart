import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_constants.dart';

Future<void> showShareProfileSheet(
  BuildContext context, {
  required String url,
  required String name,
}) {
  return showDialog<void>(
    context: context,
    builder: (context) => ShareProfileSheet(url: url, name: name),
  );
}

class ShareProfileSheet extends StatelessWidget {
  const ShareProfileSheet({super.key, required this.url, required this.name});

  final String url;
  final String name;

  String get _message => url.isEmpty
      ? 'Check out this digital business card on tap-na.'
      : 'Check out this digital business card: $url';

  Future<void> _open(String href) async {
    final uri = Uri.parse(href);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _nativeShare() async {
    await SharePlus.instance.share(
      ShareParams(
        text: _message,
        subject: '$name \u2014 Digital Business Card',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppConstants.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Share Profile',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Colors.white),
                ),
              ],
            ),
            const Text(
              'Scan to open this profile.',
              style: TextStyle(color: AppConstants.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: url.isEmpty
                  ? const Icon(Icons.qr_code_2, size: 180, color: Colors.black)
                  : QrImageView(
                      data: url,
                      size: 200,
                      padding: EdgeInsets.zero,
                      backgroundColor: Colors.white,
                    ),
            ),
            const SizedBox(height: 20),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Share via',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 8,
              childAspectRatio: 0.78,
              children: [
                _Channel(
                  label: 'WhatsApp',
                  color: const Color(0xFF25D366),
                  icon: Icons.chat,
                  onTap: () => _open(
                    'https://wa.me/?text=${Uri.encodeComponent(_message)}',
                  ),
                ),
                _Channel(
                  label: 'SMS',
                  color: const Color(0xFF34C759),
                  icon: Icons.sms_outlined,
                  onTap: () => _open(
                    'sms:?&body=${Uri.encodeComponent(_message)}',
                  ),
                ),
                _Channel(
                  label: 'Email',
                  color: const Color(0xFF0A84FF),
                  icon: Icons.email_outlined,
                  onTap: () => _open(
                    'mailto:?subject=${Uri.encodeComponent('$name digital card')}&body=${Uri.encodeComponent(_message)}',
                  ),
                ),
                _Channel(
                  label: 'Telegram',
                  color: const Color(0xFF229ED9),
                  icon: Icons.send,
                  onTap: () => _open(
                    'https://t.me/share/url?url=${Uri.encodeComponent(url)}&text=${Uri.encodeComponent(_message)}',
                  ),
                ),
                _Channel(
                  label: 'LinkedIn',
                  color: const Color(0xFF0A66C2),
                  icon: Icons.work_outline,
                  onTap: () => _open(
                    'https://www.linkedin.com/sharing/share-offsite/?url=${Uri.encodeComponent(url)}',
                  ),
                ),
                _Channel(
                  label: 'X',
                  color: const Color(0xFF111111),
                  icon: Icons.alternate_email,
                  onTap: () => _open(
                    'https://twitter.com/intent/tweet?text=${Uri.encodeComponent(_message)}&url=${Uri.encodeComponent(url)}',
                  ),
                ),
                _Channel(
                  label: 'Facebook',
                  color: const Color(0xFF1877F2),
                  icon: Icons.facebook,
                  onTap: () => _open(
                    'https://www.facebook.com/sharer/sharer.php?u=${Uri.encodeComponent(url)}',
                  ),
                ),
                _Channel(
                  label: 'More',
                  color: const Color(0xFF3F3F46),
                  icon: Icons.more_horiz,
                  onTap: _nativeShare,
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppConstants.btnSecondary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                  shape: const StadiumBorder(),
                ),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: url));
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Profile link copied')),
                  );
                },
                child: const Text('Copy profile link'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Channel extends StatelessWidget {
  const _Channel({
    required this.label,
    required this.color,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final Color color;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Column(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: color,
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(color: Color(0xFFA1A1AA), fontSize: 10),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
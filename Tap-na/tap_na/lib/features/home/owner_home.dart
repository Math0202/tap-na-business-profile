import 'dart:io';

import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_constants.dart';
import '../../core/models/profile_data.dart';
import '../../core/models/vcard.dart';
import '../../core/services/session_service.dart';
import '../nfc/nfc_share.dart';
import '../widget/widget_previews.dart';

class OwnerHome extends StatelessWidget {
  const OwnerHome({
    super.key,
    required this.profile,
    required this.onLogout,
    this.errorMessage,
    this.offline = false,
  });

  final ProfileData profile;
  final Future<void> Function() onLogout;
  final String? errorMessage;
  final bool offline;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            _Header(onLogout: onLogout),
            const SizedBox(height: 20),
            _IdentityCard(profile: profile),
            if (offline || (errorMessage != null && errorMessage!.isNotEmpty)) ...[
              const SizedBox(height: 12),
              Text(
                errorMessage ?? 'Offline – view only',
                style: const TextStyle(color: Color(0xFFFCD34D), fontSize: 13),
              ),
            ],
            const SizedBox(height: 28),
            const Text(
              'Home screen widgets',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Choose a layout to pin on your home screen.',
              style: TextStyle(color: AppConstants.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 16,
              alignment: WrapAlignment.center,
              children: [
                WidgetPreviewOption(
                  title: 'Tap Na QR',
                  onTap: () => _pinWidget(context, AppConstants.widgetQrName),
                  child: const WidgetQrPreview(size: 96),
                ),
                WidgetPreviewOption(
                  title: 'Tap Na Card',
                  onTap: () => _pinWidget(context, AppConstants.widgetCardName),
                  child: const WidgetCardPreview(),
                ),
                WidgetPreviewOption(
                  title: 'Tap Na Profile',
                  onTap: () => _pinWidget(context, AppConstants.widgetProfileName),
                  child: const WidgetProfilePreview(),
                ),
              ],
            ),
            const SizedBox(height: 28),
            _ActionButton(
              title: 'Share Profile',
              subtitle: 'Send your public profile link.',
              onTap: () => _shareProfile(profile),
            ),
            const SizedBox(height: 10),
            _ActionButton(
              title: 'Share Details',
              subtitle: 'QR code saves the contact on their phone.',
              onTap: () => _showDetailsQr(context, profile),
            ),
            const SizedBox(height: 10),
            _ActionButton(
              title: 'Share Details with NFC',
              subtitle: 'Phone-to-phone contact share.',
              onTap: () => _showNfc(context, profile),
            ),
            const SizedBox(height: 10),
            _ActionButton(
              title: 'Edit Profile',
              subtitle: 'Opens tap-na in your browser.',
              onTap: () => _editProfile(profile),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pinWidget(BuildContext context, String androidName) async {
    if (Platform.isAndroid) {
      try {
        await HomeWidget.requestPinWidget(
          androidName: androidName,
          qualifiedAndroidName:
              '${AppConstants.androidApplicationId}.$androidName',
        );
        return;
      } catch (_) {}
    }
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: AppConstants.card,
        content: Text(
          'On iPhone, long-press the Home Screen, tap Edit, then Add Widget and choose Tap Na.',
        ),
      ),
    );
  }

  Future<void> _shareProfile(ProfileData profile) async {
    final url = profile.publicProfileUrl;
    await SharePlus.instance.share(
      ShareParams(
        text: url.isEmpty
            ? 'Check out this digital business card on tap-na.'
            : 'Check out this digital business card: $url',
        subject: '${profile.safeName} — Digital Business Card',
      ),
    );
  }

  Future<void> _editProfile(ProfileData profile) async {
    final token = await SessionService().accessToken;
    final uri = Uri.parse(profile.ownerHomeUrl).replace(
      queryParameters: {
        if (token != null && token.isNotEmpty) 'appToken': token,
      },
    );
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _showDetailsQr(BuildContext context, ProfileData profile) {
    final vcard = buildShareVcard(profile);
    showDialog<void>(
      context: context,
      builder: (context) {
        return Dialog(
          backgroundColor: AppConstants.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Share Direct Details',
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
                const SizedBox(height: 8),
                const Text(
                  'Scan to save this contact (includes profile link).',
                  style: TextStyle(
                    color: AppConstants.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: QrImageView(
                    data: vcard,
                    size: 200,
                    backgroundColor: Colors.white,
                    padding: EdgeInsets.zero,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showNfc(BuildContext context, ProfileData profile) async {
    final vcard = buildShareVcard(profile);
    await NfcShare.setAndroidPayload(vcard);
    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppConstants.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Share Details with NFC',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                Platform.isAndroid
                    ? 'Hold the other phone against yours. Their phone should open the contact.'
                    : 'iPhone cannot broadcast NFC to another phone. Hold near an NFC tag, or ask them to scan the QR.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppConstants.textSecondary,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppConstants.btnSecondary,
                  foregroundColor: Colors.white,
                  shape: const StadiumBorder(),
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () async {
                  try {
                    await NfcShare.writeToTag(vcard);
                  } catch (error) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: AppConstants.bgElevated,
                        content: Text(error.toString()),
                      ),
                    );
                  }
                },
                child: const Text('Ready to tap'),
              ),
            ],
          ),
        );
      },
    );
    await NfcShare.stop();
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onLogout});

  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Image.network(
          AppConstants.logoUrl,
          height: 36,
          errorBuilder: (_, _, _) => const Text(
            'tap-na',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.4,
            ),
          ),
        ),
        const Spacer(),
        TextButton(
          onPressed: onLogout,
          child: const Text(
            'Log out',
            style: TextStyle(color: AppConstants.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.profile});

  final ProfileData profile;

  @override
  Widget build(BuildContext context) {
    final photo = profile.localImagePath;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppConstants.card,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppConstants.border),
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 42,
            backgroundColor: AppConstants.btnSecondary,
            backgroundImage: photo != null && File(photo).existsSync()
                ? FileImage(File(photo))
                : null,
            child: photo == null || !File(photo).existsSync()
                ? Text(
                    profile.safeName.substring(0, 1).toUpperCase(),
                    style: const TextStyle(fontSize: 28, color: Colors.white),
                  )
                : null,
          ),
          const SizedBox(height: 12),
          Text(
            profile.safeName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (profile.title.isNotEmpty)
            Text(
              profile.title,
              style: const TextStyle(color: AppConstants.textSecondary),
            ),
          if (profile.company.isNotEmpty)
            Text(
              profile.company,
              style: const TextStyle(color: AppConstants.textMuted),
            ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xCC27272A),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF3F3F46)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(
                  color: AppConstants.textSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

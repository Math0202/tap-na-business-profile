import 'dart:io';
import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_constants.dart';
import '../../core/models/profile_data.dart';
import '../../core/models/vcard.dart';
import '../../core/services/session_service.dart';
import '../nfc/nfc_share.dart';
import '../widget/widget_previews.dart';
import 'share_profile_sheet.dart';

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

  static const double _cell = 76;

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
            if (offline || (errorMessage != null && errorMessage!.isNotEmpty)) ...[
              Text(
                errorMessage ?? 'Offline — view only',
                style: const TextStyle(color: Color(0xFFFCD34D), fontSize: 13),
              ),
              const SizedBox(height: 12),
            ],
            const Text(
              'Home screen widgets',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Choose a layout to pin on your home screen.',
              style: TextStyle(color: AppConstants.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                WidgetPreviewOption(
                  title: 'Tap Na QR',
                  onTap: () => _pinWidget(context, AppConstants.widgetQrName),
                  child: WidgetQrPreview(size: _cell * 2, profile: profile),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      return WidgetPreviewOption(
                        title: 'Tap Na Card',
                        onTap: () => _pinWidget(context, AppConstants.widgetCardName),
                        child: WidgetCardPreview(
                          width: constraints.maxWidth,
                          height: _cell * 2,
                          profile: profile,
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Expanded(
                                child: _ActionTile(
                                  icon: Icons.qr_code_2,
                                  title: 'Share Profile',
                                  subtitle: 'QR and share link',
                                  onTap: () => showShareProfileSheet(
                                    context,
                                    url: profile.publicProfileUrl,
                                    name: profile.safeName,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _ActionTile(
                                  icon: Icons.contact_page_outlined,
                                  title: 'Share Details',
                                  subtitle: 'QR saves the contact',
                                  onTap: () => _showDetailsQr(context, profile),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: Row(
                            children: [
                              Expanded(
                                child: _ActionTile(
                                  icon: Icons.nfc,
                                  title: 'NFC',
                                  subtitle: 'Phone-to-phone share',
                                  onTap: () => _showNfc(context, profile),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _ActionTile(
                                  icon: Icons.edit_outlined,
                                  title: 'Edit Profile',
                                  subtitle: 'Opens tap-na in browser',
                                  onTap: () => _editProfile(profile),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  WidgetPreviewOption(
                    title: 'Tap Na Profile',
                    onTap: () => _pinWidget(context, AppConstants.widgetProfileName),
                    child: WidgetProfilePreview(
                      width: _cell * 2,
                      height: _cell * 4,
                      profile: profile,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            LayoutBuilder(
              builder: (context, constraints) {
                return WidgetPreviewOption(
                  title: 'Tap Na Profile 4x4',
                  onTap: () => _pinWidget(
                    context,
                    AppConstants.widgetProfileLargeName,
                  ),
                  child: WidgetProfilePreview(
                    width: constraints.maxWidth,
                    height: _cell * 4,
                    profile: profile,
                  ),
                );
              },
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
              const SizedBox(height: 12),
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

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF2A2A2A),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Color(0xFF3F3F46)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppConstants.btnSecondary,
                child: Icon(icon, color: Colors.white, size: 18),
              ),
              const Spacer(),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppConstants.textSecondary,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
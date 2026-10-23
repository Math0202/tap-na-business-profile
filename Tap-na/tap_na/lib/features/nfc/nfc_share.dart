import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:ndef_record/ndef_record.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/nfc_manager_android.dart';
import 'package:nfc_manager/nfc_manager_ios.dart';

class NfcShare {
  static const MethodChannel _channel = MethodChannel('com.tapna.app/nfc');

  static Future<bool> androidNfcEnabled() async {
    if (!Platform.isAndroid) return false;
    try {
      final enabled = await _channel.invokeMethod<bool>('nfcEnabled');
      return enabled == true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> setAndroidPayload(String vcard) async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod<void>('setPayload', {'payload': vcard});
    } catch (_) {}
  }

  static Future<void> clearAndroidPayload() async {
    await setAndroidPayload('');
  }

  static Future<void> writeToTag(String vcard) async {
    final availability = await NfcManager.instance.checkAvailability();
    if (availability != NfcAvailability.enabled) {
      throw StateError('NFC is not available');
    }
    final message = NdefMessage(
      records: [
        NdefRecord(
          typeNameFormat: TypeNameFormat.media,
          type: Uint8List.fromList(utf8.encode('text/vcard')),
          identifier: Uint8List(0),
          payload: Uint8List.fromList(utf8.encode(vcard)),
        ),
      ],
    );
    await NfcManager.instance.startSession(
      pollingOptions: {
        NfcPollingOption.iso14443,
        NfcPollingOption.iso15693,
      },
      alertMessageIos: 'Hold your iPhone near the other device or an NFC tag.',
      onDiscovered: (tag) async {
        try {
          if (Platform.isAndroid) {
            final ndef = NdefAndroid.from(tag);
            if (ndef == null || !ndef.isWritable) {
              throw StateError('This NFC target is not writable');
            }
            await ndef.writeNdefMessage(message);
          } else {
            final ndef = NdefIos.from(tag);
            if (ndef == null) {
              throw StateError('This NFC target is not writable');
            }
            await ndef.writeNdef(message);
          }
          await NfcManager.instance.stopSession(
            alertMessageIos: 'Contact details sent.',
          );
        } catch (error) {
          await NfcManager.instance.stopSession(
            errorMessageIos: error.toString(),
          );
        }
      },
    );
  }

  static Future<void> stop() async {
    try {
      await NfcManager.instance.stopSession();
    } catch (_) {}
    await clearAndroidPayload();
  }
}

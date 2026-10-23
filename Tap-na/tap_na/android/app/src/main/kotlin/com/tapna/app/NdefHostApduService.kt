package com.tapna.app

import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import java.nio.charset.StandardCharsets
import java.util.Arrays

class NdefHostApduService : HostApduService() {
    private var selected = FILE_NONE

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null || commandApdu.size < 4) return FAILURE
        val ins = commandApdu[1]
        val p1 = commandApdu[2]
        val p2 = commandApdu[3]
        return when {
            ins == INS_SELECT && p1 == P1_SELECT_BY_NAME -> {
                selected = FILE_NDEF
                SUCCESS
            }
            ins == INS_SELECT && p1 == P1_SELECT_BY_FILE -> {
                val lc = commandApdu[4].toInt() and 0xFF
                if (commandApdu.size < 5 + lc) return FAILURE
                val fileId = commandApdu.copyOfRange(5, 5 + lc)
                selected = when {
                    Arrays.equals(fileId, FILE_CC_ID) -> FILE_CC
                    Arrays.equals(fileId, FILE_NDEF_ID) -> FILE_NDEF
                    else -> FILE_NONE
                }
                if (selected == FILE_NONE) FAILURE else SUCCESS
            }
            ins == INS_READ -> {
                val offset = ((p1.toInt() and 0xFF) shl 8) or (p2.toInt() and 0xFF)
                val length = if (commandApdu.size >= 5) commandApdu[4].toInt() and 0xFF else 0
                val file = currentFile() ?: return FAILURE
                if (offset >= file.size) return SUCCESS
                val end = (offset + if (length == 0) file.size - offset else length).coerceAtMost(file.size)
                file.copyOfRange(offset, end) + SUCCESS
            }
            else -> FAILURE
        }
    }

    override fun onDeactivated(reason: Int) {
        selected = FILE_NONE
    }

    private fun currentFile(): ByteArray? {
        return when (selected) {
            FILE_CC -> CC
            FILE_NDEF -> ndefFile()
            else -> null
        }
    }

    companion object {
        @Volatile
        var payload: String = ""

        private const val FILE_NONE = 0
        private const val FILE_CC = 1
        private const val FILE_NDEF = 2
        private const val INS_SELECT: Byte = 0xA4.toByte()
        private const val INS_READ: Byte = 0xB0.toByte()
        private const val P1_SELECT_BY_NAME: Byte = 0x04
        private const val P1_SELECT_BY_FILE: Byte = 0x00
        private val SUCCESS = byteArrayOf(0x90.toByte(), 0x00)
        private val FAILURE = byteArrayOf(0x6A.toByte(), 0x82.toByte())
        private val FILE_CC_ID = byteArrayOf(0xE1.toByte(), 0x03)
        private val FILE_NDEF_ID = byteArrayOf(0xE1.toByte(), 0x04)
        private val CC = byteArrayOf(
            0x00, 0x0F, 0x20,
            0x00, 0xFF.toByte(),
            0x00, 0xFF.toByte(),
            0x04, 0x06,
            0xE1.toByte(), 0x04,
            0xFF.toByte(), 0xFE.toByte(),
            0x00, 0x00
        )

        private fun ndefFile(): ByteArray {
            val text = payload.ifBlank { "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Tap Na\r\nEND:VCARD" }
            val record = NdefRecord.createMime("text/vcard", text.toByteArray(StandardCharsets.UTF_8))
            val message = NdefMessage(record)
            val bytes = message.toByteArray()
            val file = ByteArray(bytes.size + 2)
            file[0] = ((bytes.size shr 8) and 0xFF).toByte()
            file[1] = (bytes.size and 0xFF).toByte()
            System.arraycopy(bytes, 0, file, 2, bytes.size)
            return file
        }
    }
}
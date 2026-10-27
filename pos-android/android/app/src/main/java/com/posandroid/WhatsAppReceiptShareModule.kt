package com.posandroid

import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class WhatsAppReceiptShareModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "WhatsAppReceiptShare"

  @ReactMethod
  fun share(imageUri: String, message: String, phone: String?, promise: Promise) {
    try {
      val targetPackage = findWhatsAppPackage()
        ?: throw IllegalStateException("WhatsApp tidak terpasang")
      val contentUri = toShareableUri(imageUri)

      val intent = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        setPackage(targetPackage)
        putExtra(Intent.EXTRA_STREAM, contentUri)
        putExtra(Intent.EXTRA_TEXT, message)
        clipData = ClipData.newRawUri("Struk transaksi", contentUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)

        phone
          ?.filter(Char::isDigit)
          ?.takeIf { it.length in 9..15 }
          ?.let { putExtra("jid", "$it@s.whatsapp.net") }
      }

      reactContext.grantUriPermission(
        targetPackage,
        contentUri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("WHATSAPP_RECEIPT_SHARE_FAILED", error.message, error)
    }
  }

  private fun findWhatsAppPackage(): String? {
    val candidates = listOf("com.whatsapp", "com.whatsapp.w4b")
    return candidates.firstOrNull { packageName ->
      try {
        reactContext.packageManager.getApplicationInfo(packageName, 0)
        true
      } catch (_: PackageManager.NameNotFoundException) {
        false
      }
    }
  }

  private fun toShareableUri(rawUri: String): Uri {
    val parsed = Uri.parse(rawUri)
    if (parsed.scheme == "content") return parsed

    val filePath = if (parsed.scheme == "file") parsed.path else rawUri
    val file = File(filePath ?: throw IllegalArgumentException("Lokasi gambar struk tidak valid"))
    if (!file.exists()) throw IllegalArgumentException("Gambar struk tidak ditemukan")

    return FileProvider.getUriForFile(
      reactContext,
      "${reactContext.packageName}.receipt.fileprovider",
      file,
    )
  }
}

package com.posandroid

import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class OrderNotificationSoundModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private var ringtone: Ringtone? = null

  override fun getName() = "OrderNotificationSound"

  @ReactMethod
  fun play() {
    reactContext.runOnUiQueueThread {
      try {
        ringtone?.stop()
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        ringtone = RingtoneManager.getRingtone(reactContext, uri)
        ringtone?.audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        ringtone?.play()
      } catch (_: Exception) {
        ringtone = RingtoneManager.getRingtone(reactContext, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
        ringtone?.play()
      }
    }
  }
}

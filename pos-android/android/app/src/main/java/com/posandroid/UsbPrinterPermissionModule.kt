package com.posandroid

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class UsbPrinterPermissionModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val actionUsbPermission = "${reactContext.packageName}.USB_PRINTER_PERMISSION"
  private var permissionReceiver: BroadcastReceiver? = null
  private var pendingPromise: Promise? = null

  override fun getName() = "UsbPrinterPermission"

  @ReactMethod
  fun request(vendorId: Double, productId: Double, promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("USB_PERMISSION_BUSY", "Permintaan izin USB lain masih berlangsung.")
      return
    }

    val usbManager = reactContext.getSystemService(Context.USB_SERVICE) as UsbManager
    val vendor = vendorId.toInt()
    val product = productId.toInt()
    val device = usbManager.deviceList.values.firstOrNull {
      it.vendorId == vendor && it.productId == product
    }

    if (device == null) {
      promise.reject("USB_NOT_FOUND", "Printer USB tidak terdeteksi. Periksa kabel OTG dan daya printer.")
      return
    }

    if (usbManager.hasPermission(device)) {
      promise.resolve(true)
      return
    }

    pendingPromise = promise
    permissionReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != actionUsbPermission) return
        val resultDevice = getUsbDevice(intent)
        if (resultDevice == null || resultDevice.vendorId != vendor || resultDevice.productId != product) return

        val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
        if (granted) {
          pendingPromise?.resolve(true)
        } else {
          pendingPromise?.reject("USB_PERMISSION_DENIED", "Izin akses printer USB ditolak.")
        }
        clearPendingRequest()
      }
    }

    val filter = IntentFilter(actionUsbPermission)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(permissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      reactContext.registerReceiver(permissionReceiver, filter)
    }

    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    val permissionIntent = PendingIntent.getBroadcast(
      reactContext,
      device.deviceId,
      Intent(actionUsbPermission).setPackage(reactContext.packageName),
      flags,
    )
    usbManager.requestPermission(device, permissionIntent)
  }

  @Suppress("DEPRECATION")
  private fun getUsbDevice(intent: Intent): UsbDevice? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
    } else {
      intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
    }

  private fun clearPendingRequest() {
    permissionReceiver?.let {
      try {
        reactContext.unregisterReceiver(it)
      } catch (_: IllegalArgumentException) {
      }
    }
    permissionReceiver = null
    pendingPromise = null
  }

  override fun invalidate() {
    pendingPromise?.reject("USB_PERMISSION_CANCELLED", "Permintaan izin USB dibatalkan.")
    clearPendingRequest()
    super.invalidate()
  }
}

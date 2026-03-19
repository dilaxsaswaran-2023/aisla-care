package com.aislacaremobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DirectCallModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DirectCallModule"

  @ReactMethod
  fun placeCall(phoneNumber: String, promise: Promise) {
    val normalizedPhoneNumber = phoneNumber.trim()
    if (normalizedPhoneNumber.isEmpty()) {
      promise.reject("E_INVALID_PHONE_NUMBER", "Phone number is required.")
      return
    }

    val permissionGranted =
        ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CALL_PHONE) ==
            PackageManager.PERMISSION_GRANTED
    if (!permissionGranted) {
      promise.reject("E_CALL_PERMISSION_DENIED", "CALL_PHONE permission not granted.")
      return
    }

    try {
      val callIntent =
          Intent(Intent.ACTION_CALL).apply {
            data = Uri.parse("tel:$normalizedPhoneNumber")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }

      if (callIntent.resolveActivity(reactContext.packageManager) == null) {
        promise.reject("E_NO_CALL_ACTIVITY", "No phone app available to place the call.")
        return
      }

      reactContext.startActivity(callIntent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("E_CALL_FAILED", error.message, error)
    }
  }
}

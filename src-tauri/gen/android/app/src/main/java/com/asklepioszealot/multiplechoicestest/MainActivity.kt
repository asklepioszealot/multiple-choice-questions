package com.asklepioszealot.multiplechoicestest

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // MCQ-only: WebView, sistem çubuğu/kamera kesiği boşluklarını CSS env(safe-area-inset-*)
    // ile ancak M144'ten itibaren iletiyor; daha eski WebView'larda içerik saat/pil çubuğunun
    // altına giriyordu. Boşluğu yerel dolgu olarak uygula ve WebView'a sıfırlanmış ilet
    // (çift dolguyu önler). Kaynak: developer.android.com "Understand window insets in WebView".
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, windowInsets ->
      val types = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      val insets = windowInsets.getInsets(types)
      view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
      WindowInsetsCompat.Builder(windowInsets).setInsets(types, Insets.NONE).build()
    }
  }
}

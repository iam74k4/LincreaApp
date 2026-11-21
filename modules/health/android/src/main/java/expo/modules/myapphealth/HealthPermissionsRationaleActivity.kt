// ヘルスコネクト（Health Connect）の権限の画面の「プライバシー ポリシー」から開く、歩数の扱いの説明
// （Health Connect を使うアプリは、この画面を用意する決まり。Google Play に出すときは、プライバシー ポリシーの URL も示す。docs/android-release.md）。
package expo.modules.myapphealth

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.view.WindowInsets
import android.widget.ScrollView
import android.widget.TextView

class HealthPermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val density = resources.displayMetrics.density
    val padding = (24 * density).toInt()
    val text = TextView(this).apply {
      text = listOf(
        "LINCREA の歩数の扱い",
        "",
        "読むもの: ヘルスコネクトの「歩数」だけです。ほかの健康のデータは読みません。ヘルスコネクトに書き込むこともありません。",
        "",
        "使い道: Walk the Talk の「歩数入力」を開いたとき、その週の今日までの日ごとの歩数を読み、入力欄に入れます。",
        "",
        "送り先: 「保存」を押したときだけ、入力欄の歩数が、会社の Walk the Talk に登録されます。" +
          "広告に使ったり、会社のほかに送ったりすることはありません。",
        "",
        "アプリに残すもの: 読んだ歩数は、アプリの中に保存しません（入力欄に入れるだけです）。" +
          "登録したあとの歩数の保管と削除は、会社の Walk the Talk の決まりによります。",
        "",
        "やめるとき: ヘルスコネクトの設定で、LINCREA の歩数の権限をオフにしてください。歩数は手で入力できます。",
      ).joinToString("\n")
      textSize = 16f
      setPadding(padding, padding, padding, padding)
    }
    val scroll = ScrollView(this).apply { addView(text) }
    // Android 15 からは、画面の上下（時刻・戻るの棒）の下まで描く。文字が重ならないように、そのぶん空ける
    scroll.setOnApplyWindowInsetsListener { view, insets ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
        view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      } else {
        @Suppress("DEPRECATION")
        view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
      }
      insets
    }
    setContentView(scroll)
  }
}

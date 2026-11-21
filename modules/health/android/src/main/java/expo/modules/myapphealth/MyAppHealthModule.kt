// ヘルスコネクト（Health Connect）から、1日の歩数の合計を読む。読むだけで、ヘルスコネクトには書き込まない（iPhone の ../../ios と同じ3つの関数と呼び名）。
// スマートフォンと腕時計など、いくつもの記録元の歩数は、Health Connect の画面と同じく重ならないように足す（aggregate の COUNT_TOTAL）。
package expo.modules.myapphealth

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

class MyAppHealthModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** Android 13 まで: ヘルスコネクトのアプリに、歩数を読む許可を求める画面を出す（結果は、許された権限の一覧） */
  private lateinit var permissionLauncher: AppContextActivityResultLauncher<HashSet<String>, Set<String>>

  private val readSteps = HealthPermission.getReadPermission(StepsRecord::class)

  override fun definition() = ModuleDefinition {
    Name("MyAppHealth")

    // 歩数を読む先の呼び名（ページの知らせに出す。日本語の端末で Health Connect が名乗る名前。iPhone の部品は「ヘルスケア」）
    Constant("sourceName") { "ヘルスコネクト" }

    RegisterActivityContracts {
      permissionLauncher = registerForActivityResult(RequestHealthPermissions())
    }

    // この端末でヘルスコネクトが使えるか（Android 9 より前・ヘルスコネクトが入っていない・更新が要るときは false）
    Function("isAvailable") {
      available()
    }

    // 歩数を読む許可を求める（まだ許されていないときだけ、ヘルスコネクトの許可の画面が出る）。許されたら true
    AsyncFunction("requestStepsAccess") Coroutine { ->
      if (!available()) return@Coroutine false
      val client = HealthConnectClient.getOrCreate(context)
      if (readSteps in client.permissionController.getGrantedPermissions()) return@Coroutine true
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        // Android 14 からは、ヘルスコネクトの権限は端末のふつうの権限（requestPermissions で求める）。
        // ヘルスコネクトの contract もそれを使うが、Expo の activity result の仕組みは onActivityResult しか受けず、
        // 答え（onRequestPermissionsResult）が届かないまま待ち続ける。そこで、答えを受け取れる Expo の権限の仕組みで求める
        return@Coroutine askRuntimePermission(readSteps)
      }
      // Android 13 まで: ヘルスコネクトのアプリの画面を開いて、答えを受け取る（onActivityResult）
      val granted = permissionLauncher.launch(hashSetOf(readSteps))
      readSteps in granted
    }

    // その日（端末の暦で 0:00〜24:00）の歩数の合計。day は "yyyy-MM-dd"。記録がない・読むのを許されていなければ 0（iPhone と同じ）
    AsyncFunction("stepsOnDay") Coroutine { day: String ->
      if (!available()) return@Coroutine 0
      val date = try {
        LocalDate.parse(day)
      } catch (e: DateTimeParseException) {
        throw InvalidDayException(day)
      }
      val client = HealthConnectClient.getOrCreate(context)
      if (readSteps !in client.permissionController.getGrantedPermissions()) return@Coroutine 0
      val zone = ZoneId.systemDefault()
      val start = date.atStartOfDay(zone).toInstant()
      val end = date.plusDays(1).atStartOfDay(zone).toInstant()
      val result = client.aggregate(
        AggregateRequest(
          metrics = setOf(StepsRecord.COUNT_TOTAL),
          timeRangeFilter = TimeRangeFilter.between(start, end),
        ),
      )
      (result[StepsRecord.COUNT_TOTAL] ?: 0L).toInt()
    }
  }

  /** 端末の権限を求めて、許されたら true（答えは React Native の画面が受け取り、Expo の権限の仕組みが返す） */
  private suspend fun askRuntimePermission(permission: String): Boolean {
    val permissions = appContext.permissions ?: return false
    return suspendCancellableCoroutine { continuation ->
      permissions.askForPermissions(
        { result ->
          if (continuation.isActive) continuation.resume(result[permission]?.status == PermissionsStatus.GRANTED)
        },
        permission,
      )
    }
  }

  /** ヘルスコネクトが使えるか（Android 9 以上で、ヘルスコネクトが入っていて、そのまま使えるとき） */
  private fun available(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false
    return try {
      HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    } catch (e: Exception) {
      false
    }
  }
}

/** Android 13 まで: ヘルスコネクトの許可を求める画面（ヘルスコネクトが用意する画面を、Expo の部品から開けるように包む） */
private class RequestHealthPermissions : AppContextActivityResultContract<HashSet<String>, Set<String>> {
  private val delegate = PermissionController.createRequestPermissionResultContract()

  override fun createIntent(context: Context, input: HashSet<String>): Intent = delegate.createIntent(context, input)

  override fun parseResult(input: HashSet<String>, resultCode: Int, intent: Intent?): Set<String> =
    delegate.parseResult(resultCode, intent)
}

private class InvalidDayException(day: String) : CodedException("ERR_HEALTH_DAY", "日付が読めません: $day", null)

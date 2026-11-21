// ヘルスケア（HealthKit）から、1日の歩数の合計を読む。読むだけで、ヘルスケアには書き込まない。
// iPhone と Apple Watch の両方で数えた分は、ヘルスケアの画面と同じく重ならないように足す（cumulativeSum）。
import ExpoModulesCore
import HealthKit

public class MyAppHealthModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("MyAppHealth")

    // 歩数を読む先の呼び名（ページの知らせに出す。Android の部品は「ヘルスコネクト」）
    Constant("sourceName") { "ヘルスケア" }

    // この端末でヘルスケアが使えるか（ヘルスケアのない端末では false）
    Function("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    // 歩数を読む許可を求める（初めてのときだけ、iOS の許可の画面が出る）。
    // iOS は、読むのを断られたかどうかをアプリに教えない。断られても true が返り、歩数が 0 に見えるだけ
    AsyncFunction("requestStepsAccess") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(),
            let steps = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.resolve(false)
        return
      }
      self.store.requestAuthorization(toShare: nil, read: [steps]) { ok, error in
        if let error = error {
          promise.reject("ERR_HEALTH_AUTH", error.localizedDescription)
          return
        }
        promise.resolve(ok)
      }
    }

    // その日（端末の暦で 0:00〜24:00）の歩数の合計。day は "yyyy-MM-dd"。記録がなければ 0
    AsyncFunction("stepsOnDay") { (day: String, promise: Promise) in
      guard let steps = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.resolve(0)
        return
      }
      let calendar = Calendar.current
      let parser = DateFormatter()
      parser.calendar = calendar
      parser.locale = Locale(identifier: "en_US_POSIX")
      parser.timeZone = calendar.timeZone
      parser.dateFormat = "yyyy-MM-dd"
      guard let date = parser.date(from: day),
            let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date)) else {
        promise.reject("ERR_HEALTH_DAY", "日付が読めません: \(day)")
        return
      }
      let start = calendar.startOfDay(for: date)
      let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
      let query = HKStatisticsQuery(quantityType: steps, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, error in
        if let error = error as NSError? {
          // その日の記録がない（または読むのを断られている）
          if error.domain == HKErrorDomain && error.code == HKError.Code.errorNoData.rawValue {
            promise.resolve(0)
            return
          }
          promise.reject("ERR_HEALTH_QUERY", error.localizedDescription)
          return
        }
        let count = stats?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
        promise.resolve(Int(count.rounded()))
      }
      self.store.execute(query)
    }
  }
}

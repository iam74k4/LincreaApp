// 保存（登録・削除など）のあいだにアプリが裏に回っても（ほかのアプリに切り替えた・ホームに戻った）、
// iOS が許す少しのあいだ（ふつう 30 秒ほど）動き続けられるよう頼む。頼まないと、裏に回ってすぐに止められ、
// サーバーとの保存のやりとりが途中で切れる（書きかけが残り、次の保存が「Lock wait timeout」で待たされる）。
// 頼みは名前（key）ごとに1つ。終わったら返す（end）。時間が切れたら、iOS に言われて返す。
// 返さないまま時間が切れると、iOS はアプリを止めるので、どの道筋でも必ず返す。
import ExpoModulesCore
import UIKit

/** 頼んだ番号の入れ物（時間切れのときに iOS が呼ぶ処理から、頼んだあとに決まる番号を読むため）。メインスレッドでだけ触る */
private final class BackgroundTaskBox: @unchecked Sendable {
  var id: UIBackgroundTaskIdentifier = .invalid
}

// この部品は、アプリが動いているあいだずっと残る（ほかの Expo の部品と同じ）。時間切れの処理が部品を持っていても困らない
public class MyAppBackgroundTimeModule: Module {
  /** 名前ごとの頼み。メインスレッドでだけ触る */
  private var tasks: [String: BackgroundTaskBox] = [:]

  public func definition() -> ModuleDefinition {
    Name("MyAppBackgroundTime")

    Function("begin") { (key: String) in
      DispatchQueue.main.async {
        guard self.tasks[key] == nil else { return }
        let box = BackgroundTaskBox()
        box.id = UIApplication.shared.beginBackgroundTask(withName: "myapp.save") {
          // 時間切れ（iOS が、これ以上は動かせないと言ってきた）。この部品がもうなくても、必ず返す（返さないと、iOS がアプリを止める）
          if box.id != .invalid {
            UIApplication.shared.endBackgroundTask(box.id)
            box.id = .invalid
          }
          self.tasks.removeValue(forKey: key)
        }
        if box.id != .invalid { self.tasks[key] = box }
      }
    }

    Function("end") { (key: String) in
      DispatchQueue.main.async {
        guard let box = self.tasks.removeValue(forKey: key), box.id != .invalid else { return }
        UIApplication.shared.endBackgroundTask(box.id)
        box.id = .invalid
      }
    }

    // 部品がなくなるとき（開発中の読み直しなど）は、残っている頼みをすべて返す（頼みの一覧は、メインスレッドでだけ触る）
    OnDestroy {
      DispatchQueue.main.async {
        let remaining = Array(self.tasks.values)
        self.tasks.removeAll()
        for box in remaining where box.id != .invalid {
          UIApplication.shared.endBackgroundTask(box.id)
          box.id = .invalid
        }
      }
    }
  }
}

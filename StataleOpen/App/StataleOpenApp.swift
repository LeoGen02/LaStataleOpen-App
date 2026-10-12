import SwiftUI
import UserNotifications

@main
struct StataleOpenApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session = SessionStore()
    @StateObject private var updates = UpdateChecker()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(updates)
                .task { await updates.checkIfNeeded() }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background:
                BackgroundRefresher.schedule()
            case .active:
                Task { await updates.checkIfNeeded() }
            default:
                break
            }
        }
        .backgroundTask(.appRefresh(SiteConfig.backgroundRefreshID)) {
            await BackgroundRefresher.run()
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // Mostra i promemoria anche quando l'app è in primo piano.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        switch session.phase {
        case .checking:
            ProgressView("Connessione al portale…")
        case .loggedOut:
            LoginView()
        case .webOnly:
            WebOnlyTabView()
        case .ready:
            MainTabView()
        }
    }
}

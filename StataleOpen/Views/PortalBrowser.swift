import SwiftUI
import WebKit
import QuickLook

struct WebTarget: Identifiable {
    let id = UUID()
    let url: URL
    var title: String = ""
    /// Per le pagine Moodle prova l'autologin prima di caricarle.
    var authenticate = true
}

struct DownloadedFile: Identifiable {
    let id = UUID()
    let url: URL
}

final class BrowserModel: ObservableObject {
    @Published var title = ""
    @Published var progress: Double = 0
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var currentURL: URL?
    @Published var downloadedFile: DownloadedFile?
    @Published var errorMessage: String?
    weak var webView: WKWebView?

    func goBack() { webView?.goBack() }
    func goForward() { webView?.goForward() }
    func reload() { webView?.reload() }
    func load(_ url: URL) { webView?.load(URLRequest(url: url)) }
}

extension View {
    func portalBrowser(_ target: Binding<WebTarget?>, session: SessionStore) -> some View {
        fullScreenCover(item: target) { target in
            PortalBrowser(target: target, isModal: true)
                .environmentObject(session)
        }
    }
}

/// Browser interno: lezioni, quiz ed e-tivity si svolgono qui, con la sessione del portale condivisa.
struct PortalBrowser: View {
    let target: WebTarget
    var isModal = false
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model = BrowserModel()
    @State private var resolvedURL: URL?

    var body: some View {
        NavigationStack {
            content
                .navigationTitle(model.title.isEmpty ? target.title : model.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { toolbar }
                .sheet(item: $model.downloadedFile) { file in
                    QuickLookPreview(url: file.url)
                        .ignoresSafeArea()
                }
        }
        .task {
            if resolvedURL == nil {
                resolvedURL = target.authenticate ? await session.webURL(for: target.url) : target.url
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let resolvedURL {
            PortalWebView(url: resolvedURL, model: model)
                .ignoresSafeArea(edges: .bottom)
                .overlay(alignment: .top) {
                    if model.progress > 0 && model.progress < 1 {
                        ProgressView(value: model.progress)
                            .progressViewStyle(.linear)
                    }
                }
                .overlay(alignment: .bottom) {
                    if let message = model.errorMessage {
                        Text(message)
                            .font(.footnote)
                            .padding(10)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
                            .padding()
                            .onTapGesture { model.errorMessage = nil }
                    }
                }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if isModal {
            ToolbarItem(placement: .topBarLeading) {
                Button("Chiudi") { dismiss() }
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button {
                    if let url = model.currentURL ?? resolvedURL { UIApplication.shared.open(url) }
                } label: {
                    Label("Apri in Safari", systemImage: "safari")
                }
                if let url = model.currentURL {
                    ShareLink(item: url) { Label("Condividi link", systemImage: "square.and.arrow.up") }
                    Button {
                        UIPasteboard.general.url = url
                    } label: {
                        Label("Copia link", systemImage: "doc.on.doc")
                    }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
        ToolbarItemGroup(placement: .bottomBar) {
            Button { model.goBack() } label: { Image(systemName: "chevron.backward") }
                .disabled(!model.canGoBack)
            Button { model.goForward() } label: { Image(systemName: "chevron.forward") }
                .disabled(!model.canGoForward)
            Spacer()
            if !isModal {
                Button { model.load(target.url) } label: { Image(systemName: "house") }
            }
            Button { model.reload() } label: { Image(systemName: "arrow.clockwise") }
        }
    }
}

struct PortalWebView: UIViewRepresentable {
    let url: URL
    let model: BrowserModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.observe(webView)
        model.webView = webView
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        let model: BrowserModel
        private var observations: [NSKeyValueObservation] = []
        private var destinations: [ObjectIdentifier: URL] = [:]
        private var autoSubmitted = false

        init(model: BrowserModel) {
            self.model = model
        }

        func observe(_ webView: WKWebView) {
            observations = [
                webView.observe(\.estimatedProgress) { [weak self] wv, _ in self?.sync(wv) },
                webView.observe(\.title) { [weak self] wv, _ in self?.sync(wv) },
                webView.observe(\.url) { [weak self] wv, _ in self?.sync(wv) },
                webView.observe(\.canGoBack) { [weak self] wv, _ in self?.sync(wv) },
                webView.observe(\.canGoForward) { [weak self] wv, _ in self?.sync(wv) },
            ]
        }

        private func sync(_ webView: WKWebView) {
            DispatchQueue.main.async { [model, weak webView] in
                guard let webView else { return }
                model.title = webView.title ?? ""
                model.progress = webView.estimatedProgress
                model.currentURL = webView.url
                model.canGoBack = webView.canGoBack
                model.canGoForward = webView.canGoForward
            }
        }

        private func show(_ message: String) {
            DispatchQueue.main.async { [model] in model.errorMessage = message }
        }

        // MARK: Navigazione

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
                decisionHandler(.allow)
                return
            }
            if !["http", "https", "about", "blob", "data"].contains(scheme) {
                decisionHandler(.cancel)
                if scheme != SiteConfig.urlScheme { UIApplication.shared.open(url) }
                return
            }
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if !navigationResponse.canShowMIMEType {
                decisionHandler(.download)
                return
            }
            if navigationResponse.isForMainFrame,
               let http = navigationResponse.response as? HTTPURLResponse,
               let disposition = http.value(forHTTPHeaderField: "Content-Disposition"),
               disposition.lowercased().hasPrefix("attachment") {
                decisionHandler(.download)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async { [model] in model.errorMessage = nil }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Se la sessione è scaduta il portale mostra il login: lo compiliamo (e inviamo una volta sola).
            guard CredentialAutofill.isLoginPage(webView.url) else { return }
            let submit = CredentialAutofill.autoLoginEnabled && !autoSubmitted
            CredentialAutofill.run(in: webView, submit: submit) { [weak self] submitted in
                if submitted { self?.autoSubmitted = true }
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            report(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            report(error)
        }

        private func report(_ error: Error) {
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled || nsError.code == 102 { return }
            show(error.localizedDescription)
        }

        // MARK: Download (PDF, slide, materiali)

        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("Download-\(UUID().uuidString)", isDirectory: true)
            try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let destination = folder.appendingPathComponent(suggestedFilename.isEmpty ? "file" : suggestedFilename)
            destinations[ObjectIdentifier(download)] = destination
            completionHandler(destination)
        }

        func downloadDidFinish(_ download: WKDownload) {
            guard let destination = destinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
            DispatchQueue.main.async { [model] in model.downloadedFile = DownloadedFile(url: destination) }
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            destinations.removeValue(forKey: ObjectIdentifier(download))
            show("Download non riuscito: \(error.localizedDescription)")
        }

        // MARK: Finestre e dialoghi JavaScript

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            if !present(alert, from: webView) { completionHandler() }
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Annulla", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            if !present(alert, from: webView) { completionHandler(false) }
        }

        private func present(_ alert: UIAlertController, from webView: WKWebView) -> Bool {
            guard var top = webView.window?.rootViewController else { return false }
            while let next = top.presentedViewController { top = next }
            top.present(alert, animated: true)
            return true
        }
    }
}

struct QuickLookPreview: UIViewControllerRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator(url: url) }

    func makeUIViewController(context: Context) -> UINavigationController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        return UINavigationController(rootViewController: controller)
    }

    func updateUIViewController(_ controller: UINavigationController, context: Context) {}

    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        let url: URL

        init(url: URL) {
            self.url = url
        }

        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            url as NSURL
        }
    }
}

import SwiftUI

struct CourseDetailView: View {
    let course: Course

    @EnvironmentObject private var session: SessionStore
    @State private var sections: [CourseSection] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var filter: ActivityKind?
    @State private var query = ""
    @State private var webTarget: WebTarget?

    var body: some View {
        List {
            Section {
                Picker("Tipo", selection: $filter) {
                    Text("Tutto").tag(ActivityKind?.none)
                    ForEach([ActivityKind.lesson, .exercise, .etivity]) { kind in
                        Text(kind.title).tag(Optional(kind))
                    }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Button("Apri il corso nel portale") {
                        webTarget = WebTarget(url: course.webURL, title: course.title)
                    }
                }
            }

            ForEach(visibleSections) { section in
                Section {
                    if filter == nil && query.isEmpty, let summary = section.summary?.htmlStripped, !summary.isEmpty {
                        Text(summary)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .lineLimit(6)
                    }
                    ForEach(modules(in: section)) { module in
                        ModuleRow(module: module) { open(module) }
                            .contextMenu { contextMenu(for: module) }
                    }
                } header: {
                    Text(section.name.htmlStripped)
                }
            }

            if isLoading && sections.isEmpty {
                ProgressView().frame(maxWidth: .infinity)
            } else if !isLoading && errorMessage == nil && visibleSections.isEmpty {
                Text("Nessuna attività").foregroundStyle(.secondary)
            }
        }
        .navigationTitle(course.title)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Cerca nel corso")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    webTarget = WebTarget(url: course.webURL, title: course.title)
                } label: {
                    Image(systemName: "safari")
                }
            }
        }
        .task { if sections.isEmpty { await load() } }
        .refreshable { await load() }
        .portalBrowser($webTarget, session: session)
    }

    private var visibleSections: [CourseSection] {
        sections.filter { section in
            !modules(in: section).isEmpty || (filter == nil && query.isEmpty && !(section.summary ?? "").htmlStripped.isEmpty)
        }
    }

    private func modules(in section: CourseSection) -> [CourseModule] {
        section.modules.filter { module in
            guard module.uservisible ?? true else { return false }
            if let filter, module.kind != filter { return false }
            if !query.isEmpty && !module.name.htmlStripped.localizedCaseInsensitiveContains(query) { return false }
            return true
        }
    }

    private func load() async {
        guard let client = session.client else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            sections = try await client.courseContents(courseID: course.id)
            errorMessage = nil
        } catch {
            if (error as? MoodleClientError) == .sessionExpired { session.expire(); return }
            errorMessage = error.localizedDescription
        }
    }

    private func open(_ module: CourseModule) {
        let title = module.name.htmlStripped
        if module.modname == "url", let external = module.contents?.first?.fileurl, let url = URL(string: external) {
            webTarget = WebTarget(url: url, title: title, authenticate: false)
        } else if module.modname == "resource",
                  let file = module.contents?.first(where: { $0.type == "file" }), let fileURL = file.fileurl,
                  let url = session.client?.authenticatedFileURL(fileURL) {
            webTarget = WebTarget(url: url, title: title, authenticate: false)
        } else if let string = module.url, let url = URL(string: string) {
            webTarget = WebTarget(url: url, title: title)
        }
    }

    @ViewBuilder
    private func contextMenu(for module: CourseModule) -> some View {
        if let string = module.url, let url = URL(string: string) {
            Button {
                webTarget = WebTarget(url: url, title: module.name.htmlStripped)
            } label: {
                Label("Apri pagina dell'attività", systemImage: "globe")
            }
        }
        if module.allowsManualCompletion {
            Button {
                Task { await toggleCompletion(module) }
            } label: {
                if module.isCompleted {
                    Label("Segna come da fare", systemImage: "circle")
                } else {
                    Label("Segna come completata", systemImage: "checkmark.circle")
                }
            }
        }
    }

    private func toggleCompletion(_ module: CourseModule) async {
        guard let client = session.client else { return }
        do {
            try await client.setManualCompletion(moduleID: module.id, completed: !module.isCompleted)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ModuleRow: View {
    let module: CourseModule
    let action: () -> Void

    var body: some View {
        if module.modname == "label" {
            if let text = module.description?.htmlStripped, !text.isEmpty {
                Text(text)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        } else {
            Button(action: action) {
                HStack(spacing: 12) {
                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundStyle(tint)
                        .frame(width: 30)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(module.name.htmlStripped)
                            .foregroundStyle(.primary)
                        HStack(spacing: 6) {
                            Text(module.kind.title)
                            if let plural = module.modplural {
                                Text("· \(plural)")
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        if let due = module.dueDate {
                            Label {
                                Text(due, format: .dateTime.day().month().hour().minute())
                            } icon: {
                                Image(systemName: "clock")
                            }
                            .font(.caption)
                            .foregroundStyle(due < Date() ? Color.secondary : Color.orange)
                        }
                    }
                    Spacer()
                    if module.tracksCompletion {
                        Image(systemName: module.isCompleted ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(module.isCompleted ? Color.green : Color.secondary)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private var tint: Color {
        switch module.kind {
        case .lesson: return .blue
        case .exercise: return .purple
        case .etivity: return .teal
        case .other: return .gray
        }
    }

    private var icon: String {
        switch module.modname {
        case "resource": return "doc.richtext"
        case "url": return "link"
        case "page", "book": return "book"
        case "folder": return "folder"
        case "quiz": return "pencil.and.list.clipboard"
        case "assign": return "tray.and.arrow.up"
        case "forum": return "bubble.left.and.bubble.right"
        case "scorm", "h5pactivity", "hvp", "lesson": return "play.rectangle"
        case "lti", "kalvidres", "kalvidpres": return "video"
        case "wiki", "glossary": return "text.book.closed"
        default: return module.kind.systemImage
        }
    }
}

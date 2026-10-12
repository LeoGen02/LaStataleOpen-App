import SwiftUI

struct CoursesView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var data: PortalData
    @State private var scope = Scope.mine
    @State private var query = ""
    @AppStorage(SiteConfig.programIDKey) private var programID = SiteConfig.defaultProgramID
    @AppStorage(SiteConfig.programNameKey) private var programName = SiteConfig.defaultProgramName

    enum Scope: String, CaseIterable, Identifiable {
        case mine = "I miei corsi"
        case program = "Percorso"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            Group {
                switch scope {
                case .mine: myCourses
                case .program:
                    // .id: cambiando percorso in Altro l'elenco si ricarica da capo.
                    CategoryBrowserView(categoryID: programID, title: programName, embedded: true)
                        .id(programID)
                }
            }
            .safeAreaInset(edge: .top) {
                Picker("Ambito", selection: $scope) {
                    ForEach(Scope.allCases) { Text($0 == .program ? "Percorso \(programName)" : $0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.bottom, 6)
                .background(.bar)
            }
            .navigationTitle("Corsi")
            .navigationDestination(for: Course.self) { CourseDetailView(course: $0) }
        }
    }

    private var myCourses: some View {
        List {
            ForEach(filtered) { course in
                NavigationLink(value: course) { CourseRow(course: course) }
            }
            if filtered.isEmpty {
                Text(data.isLoading ? "Caricamento…" : "Nessun corso")
                    .foregroundStyle(.secondary)
            }
        }
        .searchable(text: $query, prompt: "Cerca un corso")
        .refreshable { await data.refreshAll(using: session) }
    }

    private var filtered: [Course] {
        guard !query.isEmpty else { return data.courses }
        return data.courses.filter { $0.title.localizedCaseInsensitiveContains(query) || ($0.shortname ?? "").localizedCaseInsensitiveContains(query) }
    }
}

/// Esplora la categoria del percorso: cluster (sottocategorie) e insegnamenti.
struct CategoryBrowserView: View {
    let categoryID: Int
    let title: String
    var embedded = false

    @EnvironmentObject private var session: SessionStore
    @State private var categories: [CourseCategory] = []
    @State private var courses: [Course] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var webTarget: WebTarget?

    var body: some View {
        List {
            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Button("Apri la pagina nel portale") {
                        webTarget = WebTarget(url: SiteConfig.url("course/index.php?categoryid=\(categoryID)"), title: title)
                    }
                }
            }
            if !categories.isEmpty {
                Section("Cluster") {
                    ForEach(categories) { category in
                        NavigationLink {
                            CategoryBrowserView(categoryID: category.id, title: category.name.htmlStripped)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(category.name.htmlStripped).font(.body.weight(.medium))
                                if let count = category.coursecount, count > 0 {
                                    Text("\(count) insegnamenti").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            if !courses.isEmpty {
                Section("Insegnamenti") {
                    ForEach(courses) { course in
                        NavigationLink(value: course) { CourseRow(course: course) }
                    }
                }
            }
            if isLoading && categories.isEmpty && courses.isEmpty {
                ProgressView().frame(maxWidth: .infinity)
            } else if !isLoading && errorMessage == nil && categories.isEmpty && courses.isEmpty {
                Text("Nessun contenuto in questa categoria").foregroundStyle(.secondary)
            }
        }
        .navigationTitle(embedded ? "Corsi" : title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    webTarget = WebTarget(url: SiteConfig.url("course/index.php?categoryid=\(categoryID)"), title: title)
                } label: {
                    Image(systemName: "safari")
                }
            }
        }
        .task { if categories.isEmpty && courses.isEmpty { await load() } }
        .refreshable { await load() }
        .portalBrowser($webTarget, session: session)
    }

    private func load() async {
        guard let client = session.client else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            async let subcategories = client.categories(parent: categoryID)
            async let categoryCourses = client.courses(inCategory: categoryID)
            categories = try await subcategories.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
            courses = try await categoryCourses.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
            errorMessage = nil
        } catch {
            if (error as? MoodleClientError) == .sessionExpired { session.expire(); return }
            errorMessage = error.localizedDescription
        }
    }
}

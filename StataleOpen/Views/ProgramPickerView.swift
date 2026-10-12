import SwiftUI

/// Scelta del percorso mostrato nella scheda Corsi, tra le categorie principali del portale.
struct ProgramPickerView: View {
    @EnvironmentObject private var session: SessionStore
    @AppStorage(SiteConfig.programIDKey) private var programID = SiteConfig.defaultProgramID
    @AppStorage(SiteConfig.programNameKey) private var programName = SiteConfig.defaultProgramName
    @State private var categories: [CourseCategory] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section("Attuale") {
                LabeledContent(programName, value: "categoria \(programID)")
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                }
            }

            Section {
                ForEach(categories) { category in
                    Button {
                        programID = category.id
                        programName = category.name.htmlStripped
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(category.name.htmlStripped)
                                    .foregroundStyle(.primary)
                                if let count = category.coursecount, count > 0 {
                                    Text("\(count) insegnamenti")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if category.id == programID {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.tint)
                            }
                        }
                    }
                }
                if isLoading && categories.isEmpty {
                    ProgressView().frame(maxWidth: .infinity)
                }
            } header: {
                Text("Percorsi del portale")
            } footer: {
                Text("Le categorie principali di La Statale Open. Dentro ogni percorso la scheda Corsi mostra cluster e insegnamenti.")
            }

            if programID != SiteConfig.defaultProgramID {
                Section {
                    Button("Torna a \(SiteConfig.defaultProgramName)") {
                        programID = SiteConfig.defaultProgramID
                        programName = SiteConfig.defaultProgramName
                    }
                }
            }
        }
        .navigationTitle("Percorso")
        .task { if categories.isEmpty { await load() } }
        .refreshable { await load() }
    }

    private func load() async {
        guard let client = session.client else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            categories = try await client.categories(parent: 0)
                .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
            errorMessage = nil
        } catch {
            if (error as? MoodleClientError) == .sessionExpired { session.expire(); return }
            errorMessage = error.localizedDescription
        }
    }
}

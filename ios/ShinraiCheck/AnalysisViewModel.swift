import Foundation

@MainActor
final class AnalysisViewModel: ObservableObject {
    @Published var claim = ""
    @Published var result: AnalysisResponse?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let client = APIClient()

    var canSubmit: Bool {
        claim.trimmingCharacters(in: .whitespacesAndNewlines).count >= 5 && !isLoading
    }

    func analyze() async {
        let cleaned = claim.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleaned.count >= 5 else { return }
        result = nil
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        do {
            result = try await client.analyze(claim: cleaned)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

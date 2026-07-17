import Foundation

enum APIClientError: LocalizedError {
    case invalidURL
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: "APIのURLが正しくありません。"
        case .invalidResponse: "サーバーから不正な応答が返されました。"
        case .server(let message): message
        }
    }
}

struct APIClient {
    // 実機からlocalhostには接続できません。公開したWebサイトのURLに変更してください。
    var baseURL = "https://YOUR-DOMAIN.example"

    func analyze(claim: String) async throws -> AnalysisResponse {
        guard let url = URL(string: "\(baseURL)/api/analyze") else {
            throw APIClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 45
        request.httpBody = try JSONEncoder().encode(["claim": claim])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        if !(200...299).contains(http.statusCode) {
            let decoded = try? JSONDecoder().decode(APIErrorResponse.self, from: data)
            throw APIClientError.server(decoded?.error ?? "判定に失敗しました（\(http.statusCode)）。")
        }

        return try JSONDecoder().decode(AnalysisResponse.self, from: data)
    }
}

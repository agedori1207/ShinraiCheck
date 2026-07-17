import Foundation

enum Verdict: String, Codable {
    case likelyTrue = "likely_true"
    case leaningTrue = "leaning_true"
    case uncertain
    case leaningFalse = "leaning_false"
    case likelyFalse = "likely_false"

    var label: String {
        switch self {
        case .likelyTrue: "正しい可能性が高い"
        case .leaningTrue: "やや正しい可能性が高い"
        case .uncertain: "判断困難"
        case .leaningFalse: "やや誤りの可能性が高い"
        case .likelyFalse: "誤りの可能性が高い"
        }
    }
}

enum EvidenceStance: String, Codable {
    case support, contradict, neutral

    var label: String {
        switch self {
        case .support: "支持"
        case .contradict: "反証"
        case .neutral: "中立"
        }
    }
}

struct EvidenceSource: Codable, Identifiable {
    let title: String
    let url: String
    let description: String
    let age: String?
    let domain: String
    let category: String
    let reputation: Double
    let relevance: Double
    let stance: EvidenceStance
    let stanceConfidence: Double
    let contribution: Double
    let reasons: [String]

    var id: String { url }
}

struct ScoreBreakdown: Codable {
    let supportingEvidence: Double
    let contradictingEvidence: Double
    let independentCorroboration: Double
    let sourceQuality: Double
    let uncertaintyPenalty: Double
}

struct AnalysisResponse: Codable {
    let claim: String
    let probability: Int
    let verdict: Verdict
    let summary: String
    let reasons: [String]
    let breakdown: ScoreBreakdown
    let sources: [EvidenceSource]
    let warnings: [String]
    let analyzedAt: String
    let methodologyVersion: String
}

struct APIErrorResponse: Codable {
    let error: String
}

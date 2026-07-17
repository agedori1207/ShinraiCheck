export type Verdict =
  | "likely_true"
  | "leaning_true"
  | "uncertain"
  | "leaning_false"
  | "likely_false";

export type EvidenceStance = "support" | "contradict" | "neutral";

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export interface EvidenceSource extends SearchResult {
  domain: string;
  category: string;
  reputation: number;
  relevance: number;
  stance: EvidenceStance;
  stanceConfidence: number;
  contribution: number;
  reasons: string[];
}

export interface ScoreBreakdown {
  supportingEvidence: number;
  contradictingEvidence: number;
  independentCorroboration: number;
  sourceQuality: number;
  uncertaintyPenalty: number;
}

export interface AnalysisResponse {
  claim: string;
  probability: number;
  verdict: Verdict;
  summary: string;
  reasons: string[];
  breakdown: ScoreBreakdown;
  sources: EvidenceSource[];
  warnings: string[];
  analyzedAt: string;
  methodologyVersion: string;
}

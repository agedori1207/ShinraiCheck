import { domainFromUrl, reputationForUrl } from "./source-reputation";
import type {
  AnalysisResponse,
  EvidenceSource,
  EvidenceStance,
  SearchResult,
  Verdict,
} from "./types";

const JAPANESE_STOPWORDS = new Set([
  "これ", "それ", "ため", "よう", "こと", "もの", "ある", "いる", "なる",
  "です", "ます", "した", "して", "から", "まで", "より", "について",
  "という", "では", "には", "へ", "を", "が", "は", "に", "の", "と", "で",
]);

const CONTRADICTION_MARKERS = [
  "誤り", "デマ", "虚偽", "偽情報", "事実ではない", "根拠がない", "否定",
  "訂正", "撤回", "誤解", "フェイク", "false", "incorrect", "debunk",
  "misleading", "not true", "no evidence",
];

const SUPPORT_MARKERS = [
  "発表", "確認", "判明", "報告", "公表", "認めた", "明らか", "成立",
  "実施", "開始", "決定", "confirmed", "announced", "reported",
];

function tokenize(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}]/gu, " ");

  const latin = normalized.match(/[a-z0-9]{2,}/g) ?? [];
  const japaneseChunks = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu) ?? [];
  const japanese = japaneseChunks.flatMap((chunk) => {
    if (chunk.length <= 4) return [chunk];
    const grams: string[] = [];
    for (let size = 2; size <= 4; size += 1) {
      for (let i = 0; i <= chunk.length - size; i += 1) {
        grams.push(chunk.slice(i, i + size));
      }
    }
    return grams;
  });

  return [...new Set([...latin, ...japanese])].filter(
    (token) => token.length >= 2 && !JAPANESE_STOPWORDS.has(token),
  );
}

function relevanceScore(claim: string, result: SearchResult): number {
  const claimTokens = tokenize(claim);
  if (claimTokens.length === 0) return 0;
  const haystack = `${result.title} ${result.description}`.toLowerCase().normalize("NFKC");
  const weightedMatches = claimTokens.reduce((sum, token) => {
    if (!haystack.includes(token)) return sum;
    return sum + (token.length >= 4 ? 1.5 : 1);
  }, 0);
  const maxPossible = claimTokens.reduce(
    (sum, token) => sum + (token.length >= 4 ? 1.5 : 1),
    0,
  );
  return Math.min(1, weightedMatches / Math.max(1, maxPossible));
}

function determineStance(result: SearchResult, relevance: number): {
  stance: EvidenceStance;
  confidence: number;
  reason: string;
} {
  const text = `${result.title} ${result.description}`.toLowerCase().normalize("NFKC");
  const contradictionHits = CONTRADICTION_MARKERS.filter((marker) => text.includes(marker));
  const supportHits = SUPPORT_MARKERS.filter((marker) => text.includes(marker));

  if (contradictionHits.length > 0 && relevance >= 0.12) {
    return {
      stance: "contradict",
      confidence: Math.min(1, 0.55 + contradictionHits.length * 0.12 + relevance * 0.2),
      reason: `反証・訂正を示す語（${contradictionHits.slice(0, 3).join("、")}）が見つかりました`,
    };
  }
  if (relevance >= 0.18) {
    return {
      stance: "support",
      confidence: Math.min(0.92, 0.35 + relevance * 0.5 + supportHits.length * 0.06),
      reason:
        supportHits.length > 0
          ? `主張と関連し、確認・公表を示す語（${supportHits.slice(0, 3).join("、")}）があります`
          : "タイトル・概要が主張の主要語と一致しています",
    };
  }
  return {
    stance: "neutral",
    confidence: Math.max(0.1, relevance),
    reason: "主張との関連が弱く、支持・反証の根拠としては限定的です",
  };
}

function verdictFromProbability(probability: number): Verdict {
  if (probability >= 78) return "likely_true";
  if (probability >= 60) return "leaning_true";
  if (probability >= 40) return "uncertain";
  if (probability >= 22) return "leaning_false";
  return "likely_false";
}

const verdictLabel: Record<Verdict, string> = {
  likely_true: "正しい可能性が高い",
  leaning_true: "やや正しい可能性が高い",
  uncertain: "判断材料が不足・情報が競合",
  leaning_false: "やや誤っている可能性が高い",
  likely_false: "誤っている可能性が高い",
};

function independentDomains(sources: EvidenceSource[], stance: EvidenceStance): number {
  return new Set(
    sources
      .filter((source) => source.stance === stance && source.contribution > 0.025)
      .map((source) => source.domain),
  ).size;
}

export function analyzeEvidence(claim: string, results: SearchResult[]): AnalysisResponse {
  const sources: EvidenceSource[] = results.map((result) => {
    const reputation = reputationForUrl(result.url);
    const relevance = relevanceScore(claim, result);
    const stanceInfo = determineStance(result, relevance);
    const contribution = reputation.score * relevance * stanceInfo.confidence;

    return {
      ...result,
      domain: domainFromUrl(result.url),
      category: reputation.category,
      reputation: Number(reputation.score.toFixed(3)),
      relevance: Number(relevance.toFixed(3)),
      stance: stanceInfo.stance,
      stanceConfidence: Number(stanceInfo.confidence.toFixed(3)),
      contribution: Number(contribution.toFixed(3)),
      reasons: [...reputation.reasons, stanceInfo.reason],
    };
  });

  // 同じ媒体内の複数ページを独立した証拠として重複加算しない。
  // 各ドメインについて、最も強い寄与だけを採用する。
  function contributionByIndependentDomain(stance: EvidenceStance): number {
    const strongest = new Map<string, number>();
    for (const source of sources.filter((item) => item.stance === stance)) {
      strongest.set(
        source.domain,
        Math.max(strongest.get(source.domain) ?? 0, source.contribution),
      );
    }
    return [...strongest.values()].reduce((sum, value) => sum + value, 0);
  }

  const supportingRaw = contributionByIndependentDomain("support");
  const contradictingRaw = contributionByIndependentDomain("contradict");

  const supportDomains = independentDomains(sources, "support");
  const contradictDomains = independentDomains(sources, "contradict");
  const corroboration = Math.min(0.14, Math.max(0, supportDomains - 1) * 0.035);
  const contradictionCorroboration = Math.min(
    0.14,
    Math.max(0, contradictDomains - 1) * 0.035,
  );

  const relevant = sources.filter((source) => source.relevance >= 0.12);
  const sourceQuality = relevant.length
    ? relevant.reduce((sum, source) => sum + source.reputation, 0) / relevant.length
    : 0;
  const lowEvidencePenalty = relevant.length < 3 ? (3 - relevant.length) * 0.07 : 0;
  const socialShare = relevant.length
    ? relevant.filter((source) => source.category === "個人投稿可能なプラットフォーム").length /
      relevant.length
    : 0;
  const uncertaintyPenalty = Math.min(0.28, lowEvidencePenalty + socialShare * 0.12);

  const evidenceNet =
    supportingRaw + corroboration - contradictingRaw - contradictionCorroboration;
  const evidenceMass = supportingRaw + contradictingRaw + 0.5;
  const centered = evidenceNet / evidenceMass;
  const probability = Math.round(
    Math.max(
      2,
      Math.min(
        98,
        50 + centered * 38 + (sourceQuality - 0.5) * 10 - uncertaintyPenalty * 30,
      ),
    ),
  );

  const verdict = verdictFromProbability(probability);
  const topSupport = sources
    .filter((source) => source.stance === "support")
    .sort((a, b) => b.contribution - a.contribution)[0];
  const topContradiction = sources
    .filter((source) => source.stance === "contradict")
    .sort((a, b) => b.contribution - a.contribution)[0];

  const reasons: string[] = [];
  if (topSupport) {
    reasons.push(
      `最も強い支持材料は「${topSupport.title}」で、媒体信頼度${Math.round(topSupport.reputation * 100)}点・関連度${Math.round(topSupport.relevance * 100)}点です。`,
    );
  }
  if (topContradiction) {
    reasons.push(
      `反証材料として「${topContradiction.title}」が見つかり、判定を下げています。`,
    );
  }
  if (supportDomains >= 2) {
    reasons.push(`独立した${supportDomains}ドメインから支持材料が見つかりました。`);
  }
  if (contradictDomains >= 2) {
    reasons.push(`独立した${contradictDomains}ドメインから反証材料が見つかりました。`);
  }
  if (relevant.length < 3) {
    reasons.push("十分に関連するソースが3件未満のため、確信度を下げています。");
  }
  if (socialShare > 0) {
    reasons.push("個人投稿可能な媒体は、判定への影響を小さくしています。");
  }
  if (reasons.length === 0) {
    reasons.push("検索結果と主張の関連が弱く、判定可能な証拠が不足しています。");
  }

  const warnings = [
    "この数値は数学的な真実の確率ではなく、取得できた公開情報から計算した推定スコアです。",
    "Wikipediaの概要とGDELTが収集した記事タイトルを中心に分析する無料MVPです。重要な判断では原文と一次資料を確認してください。",
    "速報・災害・医療・法律などは情報が更新されるため、判定時刻も確認してください。",
  ];

  return {
    claim,
    probability,
    verdict,
    summary: `${verdictLabel[verdict]}（推定${probability}%）`,
    reasons,
    breakdown: {
      supportingEvidence: Number(supportingRaw.toFixed(3)),
      contradictingEvidence: Number(contradictingRaw.toFixed(3)),
      independentCorroboration: Number((corroboration - contradictionCorroboration).toFixed(3)),
      sourceQuality: Number(sourceQuality.toFixed(3)),
      uncertaintyPenalty: Number(uncertaintyPenalty.toFixed(3)),
    },
    sources: sources.sort((a, b) => b.contribution - a.contribution),
    warnings,
    analyzedAt: new Date().toISOString(),
    methodologyVersion: "mvp-1.1-free",
  };
}

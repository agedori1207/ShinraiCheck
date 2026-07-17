"use client";

import { FormEvent, useState } from "react";
import type { AnalysisResponse, EvidenceSource, Verdict } from "@/lib/types";

const verdictLabels: Record<Verdict, string> = {
  likely_true: "正しい可能性が高い",
  leaning_true: "やや正しい可能性が高い",
  uncertain: "判断困難",
  leaning_false: "やや誤りの可能性が高い",
  likely_false: "誤りの可能性が高い",
};

function scoreLabel(value: number) {
  return `${Math.round(value * 100)} / 100`;
}

function SourceCard({ source, index }: { source: EvidenceSource; index: number }) {
  const stance =
    source.stance === "support" ? "支持" : source.stance === "contradict" ? "反証" : "中立";
  return (
    <article className="source-card">
      <div className="source-heading">
        <span className={`stance ${source.stance}`}>{stance}</span>
        <span className="source-number">#{index + 1}</span>
      </div>
      <h3>{source.title}</h3>
      <p className="domain">{source.domain} · {source.category}</p>
      <p>{source.description || "検索結果に概要がありません。リンク先で原文を確認してください。"}</p>
      <div className="metrics">
        <span>媒体信頼度 {scoreLabel(source.reputation)}</span>
        <span>主張との関連度 {scoreLabel(source.relevance)}</span>
        <span>判定への寄与 {scoreLabel(source.contribution)}</span>
      </div>
      <ul>
        {source.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <a href={source.url} target="_blank" rel="noreferrer">原文を開く ↗</a>
    </article>
  );
}

export default function Home() {
  const [claim, setClaim] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "判定に失敗しました。");
      setResult(data as AnalysisResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "判定に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">SOURCE-TRANSPARENT FACT CHECK</p>
        <h1>ShinraiCheck</h1>
        <p className="lead">ネット上の複数ソースを比較し、判定理由と使用したURLをすべて表示します。</p>
      </header>

      <section className="panel input-panel">
        <form onSubmit={submit}>
          <label htmlFor="claim">確認したい情報</label>
          <textarea
            id="claim"
            value={claim}
            onChange={(event) => setClaim(event.target.value)}
            placeholder="例：青森県では2026年から〇〇制度が開始された"
            minLength={5}
            maxLength={500}
            required
          />
          <div className="form-footer">
            <span>{claim.length} / 500文字</span>
            <button disabled={loading || claim.trim().length < 5}>
              {loading ? "公開情報を確認中…" : "信頼性を確認"}
            </button>
          </div>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <>
          <section className="panel result-header">
            <div className={`score-ring ${result.verdict}`}>
              <strong>{result.probability}%</strong>
              <span>推定スコア</span>
            </div>
            <div>
              <p className="eyebrow">判定</p>
              <h2>{verdictLabels[result.verdict]}</h2>
              <p>{result.claim}</p>
              <small>分析日時：{new Date(result.analyzedAt).toLocaleString("ja-JP")} / 手法：{result.methodologyVersion}</small>
            </div>
          </section>

          <section className="grid two-columns">
            <div className="panel">
              <h2>なぜこの判定なのか</h2>
              <ol className="reason-list">
                {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ol>
            </div>
            <div className="panel">
              <h2>点数の内訳</h2>
              <dl className="breakdown">
                <div><dt>支持証拠</dt><dd>{result.breakdown.supportingEvidence.toFixed(3)}</dd></div>
                <div><dt>反証証拠</dt><dd>{result.breakdown.contradictingEvidence.toFixed(3)}</dd></div>
                <div><dt>独立媒体の一致</dt><dd>{result.breakdown.independentCorroboration.toFixed(3)}</dd></div>
                <div><dt>平均ソース品質</dt><dd>{result.breakdown.sourceQuality.toFixed(3)}</dd></div>
                <div><dt>不確実性ペナルティ</dt><dd>{result.breakdown.uncertaintyPenalty.toFixed(3)}</dd></div>
              </dl>
            </div>
          </section>

          <section className="panel warning-panel">
            <h2>判定上の注意</h2>
            <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </section>

          <section className="sources-section">
            <div className="section-title">
              <div><p className="eyebrow">ALL SOURCES</p><h2>使用したソース（全{result.sources.length}件）</h2></div>
              <p>高く評価したものだけでなく、弱い・反対の情報も表示します。</p>
            </div>
            <div className="source-list">
              {result.sources.map((source, index) => (
                <SourceCard key={`${source.url}-${index}`} source={source} index={index} />
              ))}
            </div>
          </section>
        </>
      )}

      <footer>
        ShinraiCheckは真偽を断定するサービスではありません。重要な意思決定では一次資料と専門家を確認してください。
      </footer>
    </main>
  );
}

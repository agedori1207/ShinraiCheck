import { buildGdeltQuery, searchGdelt } from "./gdelt";
import type { SearchResult } from "./types";
import { searchWikipedia } from "./wikipedia";

export interface SearchOutput {
  results: SearchResult[];
  warnings: string[];
}

function envCount(name: string, fallback: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function deduplicate(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    let key = result.url.replace(/\/$/, "");
    try {
      const parsed = new URL(result.url);
      parsed.hash = "";
      parsed.searchParams.delete("utm_source");
      parsed.searchParams.delete("utm_medium");
      parsed.searchParams.delete("utm_campaign");
      key = parsed.toString().replace(/\/$/, "");
    } catch {
      // URL解析に失敗した場合は元URLを使う。
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchFreeSources(claim: string): Promise<SearchOutput> {
  const totalCount = envCount("SEARCH_RESULT_COUNT", 12, 20);
  const wikipediaCount = envCount("WIKIPEDIA_RESULT_COUNT", 4, 8);
  const gdeltCount = envCount("GDELT_RESULT_COUNT", 8, 20);
  const warnings: string[] = [];

  let wikipediaResults: SearchResult[] = [];
  let englishTitles: string[] = [];
  try {
    const wikipedia = await searchWikipedia(claim, wikipediaCount);
    wikipediaResults = wikipedia.results;
    englishTitles = wikipedia.englishTitles;
  } catch (error) {
    warnings.push(
      `Wikipediaの取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
  }

  let gdeltResults: SearchResult[] = [];
  try {
    const gdeltQuery = buildGdeltQuery(claim, englishTitles);
    gdeltResults = await searchGdelt(gdeltQuery, gdeltCount);
    if (gdeltResults.length === 0) {
      warnings.push("GDELTで関連ニュースが見つからなかったため、一般知識ソースを中心に判定しています。");
    }
  } catch (error) {
    warnings.push(
      `GDELTニュース検索を利用できませんでした: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
  }

  const results = deduplicate([...gdeltResults, ...wikipediaResults]).slice(0, totalCount);
  if (results.length === 0) {
    throw new Error(
      "無料検索元から関連ソースを取得できませんでした。入力を短い1つの主張にして再試行してください。",
    );
  }

  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(claim)) {
    warnings.push(
      "GDELTは英語検索を中心とするため、日本語の固有名詞や地域ニュースを十分に拾えない場合があります。",
    );
  }

  return { results, warnings };
}

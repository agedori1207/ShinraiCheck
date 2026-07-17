import type { SearchResult } from "./types";

interface GdeltArticle {
  title?: string;
  url?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

const USER_AGENT =
  "ShinraiCheck/0.2 (+https://github.com/agedori1207/ShinraiCheck)";

function quoteTerm(term: string): string {
  return `"${term.replace(/["()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)}"`;
}

export function buildGdeltQuery(claim: string, englishTitles: string[]): string {
  const titles = englishTitles
    .map((title) => title.trim())
    .filter((title) => title.length >= 2)
    .slice(0, 3);

  if (titles.length === 1) return quoteTerm(titles[0]);
  if (titles.length > 1) return `(${titles.map(quoteTerm).join(" OR ")})`;

  const asciiTerms = claim
    .normalize("NFKC")
    .match(/[A-Za-z][A-Za-z0-9_-]{1,}/g)
    ?.slice(0, 6);
  if (asciiTerms && asciiTerms.length > 0) return asciiTerms.join(" ");

  // GDELTは英語検索が中心です。日本語しかない場合も試行し、
  // 取得できなければWikipedia結果のみで判定します。
  return claim.slice(0, 180);
}

function formatSeenDate(value?: string): string | undefined {
  if (!value || !/^\d{8}T\d{6}Z$/.test(value)) return undefined;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function searchGdelt(query: string, count: number): Promise<SearchResult[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", String(Math.max(1, Math.min(30, count))));
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("timespan", "3m");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`GDELT APIエラー (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (!contentType.includes("json") && !body.trim().startsWith("{")) {
    throw new Error("GDELTからJSON以外の応答が返されました。");
  }

  let data: GdeltResponse;
  try {
    data = JSON.parse(body) as GdeltResponse;
  } catch {
    throw new Error("GDELTの応答を解析できませんでした。");
  }

  return (data.articles ?? [])
    .filter(
      (article): article is GdeltArticle & { title: string; url: string } =>
        Boolean(article.title && article.url),
    )
    .map((article) => {
      const metadata = [
        article.domain ? `媒体: ${article.domain}` : "",
        article.language ? `言語: ${article.language}` : "",
        article.sourcecountry ? `発信国: ${article.sourcecountry}` : "",
      ].filter(Boolean);
      return {
        title: article.title,
        url: article.url,
        description: metadata.length
          ? `GDELTが収集したニュース記事（${metadata.join(" / ")}）`
          : "GDELTが収集したニュース記事です。",
        age: formatSeenDate(article.seendate),
      };
    });
}

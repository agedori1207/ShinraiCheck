import type { SearchResult } from "./types";

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
  news?: { results?: BraveWebResult[] };
}

function normalize(items: BraveWebResult[]): SearchResult[] {
  return items
    .filter((item): item is Required<Pick<BraveWebResult, "title" | "url">> & BraveWebResult =>
      Boolean(item.title && item.url),
    )
    .map((item) => ({
      title: item.title,
      url: item.url,
      description: item.description ?? "",
      age: item.age,
    }));
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BRAVE_SEARCH_API_KEY が設定されていません。.env.local を作成してください。",
    );
  }

  const count = Math.max(
    1,
    Math.min(20, Number(process.env.SEARCH_RESULT_COUNT ?? "12")),
  );
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query.slice(0, 400));
  url.searchParams.set("country", "JP");
  url.searchParams.set("search_lang", "jp");
  url.searchParams.set("ui_lang", "ja-JP");
  url.searchParams.set("count", String(count));
  url.searchParams.set("safesearch", "strict");
  url.searchParams.set("extra_snippets", "true");
  url.searchParams.set("result_filter", "web,news");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`検索APIエラー (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as BraveResponse;
  const merged = [...normalize(data.news?.results ?? []), ...normalize(data.web?.results ?? [])];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = item.url.replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, count);
}

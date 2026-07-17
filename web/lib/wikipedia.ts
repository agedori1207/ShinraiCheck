import type { SearchResult } from "./types";

interface WikipediaPage {
  pageid?: number;
  title?: string;
  fullurl?: string;
  extract?: string;
  langlinks?: Array<{ lang?: string; title?: string }>;
}

interface WikipediaResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
  error?: {
    code?: string;
    info?: string;
  };
}

export interface WikipediaSearchOutput {
  results: SearchResult[];
  englishTitles: string[];
}

const USER_AGENT =
  "ShinraiCheck/0.2 (+https://github.com/agedori1207/ShinraiCheck)";

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function searchWikipedia(
  query: string,
  count: number,
): Promise<WikipediaSearchOutput> {
  const url = new URL("https://ja.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query.slice(0, 300));
  url.searchParams.set("gsrlimit", String(Math.max(1, Math.min(8, count))));
  url.searchParams.set("gsrnamespace", "0");
  url.searchParams.set("prop", "extracts|info|langlinks");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exsentences", "3");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("lllang", "en");
  url.searchParams.set("lllimit", "1");
  url.searchParams.set("maxlag", "5");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "Api-User-Agent": USER_AGENT,
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia APIエラー (${response.status})`);
  }

  const data = (await response.json()) as WikipediaResponse;
  if (data.error) {
    throw new Error(
      `Wikipedia APIエラー: ${data.error.info ?? data.error.code ?? "unknown"}`,
    );
  }

  const pages = Object.values(data.query?.pages ?? {}).filter(
    (page): page is WikipediaPage & { title: string } => Boolean(page.title),
  );

  const results = pages.map((page) => ({
    title: page.title,
    url:
      page.fullurl ??
      `https://ja.wikipedia.org/?curid=${encodeURIComponent(String(page.pageid ?? ""))}`,
    description: cleanText(page.extract ?? "Wikipediaの関連項目です。"),
  }));

  const englishTitles = pages
    .flatMap((page) => page.langlinks ?? [])
    .map((link) => link.title?.trim() ?? "")
    .filter(Boolean);

  return { results, englishTitles: [...new Set(englishTitles)] };
}

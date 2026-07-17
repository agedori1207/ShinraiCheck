export interface ReputationResult {
  score: number;
  category: string;
  reasons: string[];
}

const MAJOR_NEWS: Record<string, number> = {
  "nhk.or.jp": 0.93,
  "asahi.com": 0.86,
  "yomiuri.co.jp": 0.86,
  "mainichi.jp": 0.84,
  "nikkei.com": 0.88,
  "kyodonews.jp": 0.88,
  "jiji.com": 0.87,
  "sankei.com": 0.82,
  "bbc.com": 0.88,
  "reuters.com": 0.92,
  "apnews.com": 0.92,
  "cnn.co.jp": 0.82,
  "toonippo.co.jp": 0.84,
};

const AGGREGATORS: Record<string, number> = {
  "news.yahoo.co.jp": 0.62,
  "news.google.com": 0.58,
  "smartnews.com": 0.56,
};

const SOCIAL = new Set([
  "x.com",
  "twitter.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "note.com",
  "ameblo.jp",
]);

function rootDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const parts = host.split(".");
  if (parts.length <= 2) return host;

  const jpSecondLevel = new Set(["co.jp", "or.jp", "ac.jp", "go.jp", "ne.jp"]);
  const lastTwo = parts.slice(-2).join(".");
  if (jpSecondLevel.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function matchesDomain(host: string, candidate: string): boolean {
  return host === candidate || host.endsWith(`.${candidate}`);
}

export function reputationForUrl(url: string): ReputationResult {
  const host = domainFromUrl(url);

  if (host.endsWith(".go.jp") || host === "go.jp") {
    return {
      score: 0.98,
      category: "政府・自治体",
      reasons: ["日本の政府・自治体ドメインです"],
    };
  }
  if (host.endsWith(".ac.jp") || host.endsWith(".edu")) {
    return {
      score: 0.92,
      category: "大学・研究機関",
      reasons: ["大学・教育研究機関のドメインです"],
    };
  }
  if (host.endsWith("who.int") || host.endsWith("un.org")) {
    return {
      score: 0.96,
      category: "国際公的機関",
      reasons: ["国際的な公的機関のドメインです"],
    };
  }

  for (const [domain, score] of Object.entries(MAJOR_NEWS)) {
    if (matchesDomain(host, domain)) {
      return {
        score,
        category: "報道機関",
        reasons: ["編集責任を持つ報道機関として登録されています"],
      };
    }
  }

  for (const [domain, score] of Object.entries(AGGREGATORS)) {
    if (matchesDomain(host, domain)) {
      return {
        score,
        category: "ニュース集約サイト",
        reasons: [
          "ニュース集約サイトのため、掲載先だけでなく元の配信社も確認する必要があります",
        ],
      };
    }
  }

  for (const domain of SOCIAL) {
    if (matchesDomain(host, domain)) {
      return {
        score: 0.14,
        category: "個人投稿可能なプラットフォーム",
        reasons: ["個人でも投稿でき、編集・査読を必須としない媒体です"],
      };
    }
  }

  if (host.endsWith(".or.jp")) {
    return {
      score: 0.7,
      category: "団体・法人",
      reasons: ["日本の団体・法人ドメインですが、内容ごとの確認が必要です"],
    };
  }
  if (host.endsWith(".co.jp")) {
    return {
      score: 0.62,
      category: "企業公式サイトの可能性",
      reasons: ["日本企業のドメインですが、当事者発表には利害関係があり得ます"],
    };
  }

  const root = rootDomain(host);
  return {
    score: 0.38,
    category: "未登録サイト",
    reasons: [`${root} は信頼度リストに未登録です`],
  };
}

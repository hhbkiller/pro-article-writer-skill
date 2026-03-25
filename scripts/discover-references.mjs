#!/usr/bin/env node

import {
  fetchJson,
  loadEnvFile,
  normalizeDraft,
  parseArgs,
  readJson,
  resolveDraftPath,
  writeJson
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const draft = normalizeDraft(readJson(draftPath));
const limit = clampInteger(args.limit, 4, 12, 6);
const perQuery = clampInteger(args["per-query"], 3, 10, 6);
const queryInput = typeof args.queries === "string" ? args.queries.split("|").map((item) => item.trim()).filter(Boolean) : [];
const append = Boolean(args.append);
const providerPreference = normalizeProvider(args.provider);
const tavilyEnvKey = args["env-key"] || "TAVILY_API_KEY";
const tavilyApiKey = resolveOptionalApiKey({
  apiKey: args["api-key"],
  envFile: args["env-file"],
  envKey: tavilyEnvKey
});

const queries = queryInput.length > 0 ? queryInput : buildQueries(draft);
if (queries.length === 0) {
  throw new Error("Could not build research queries. Provide --queries or fill theme/direction/brief.");
}

const searchResult = await collectResearchCandidates({
  queries,
  perQuery,
  providerPreference,
  tavilyApiKey
});

if (searchResult.candidates.length === 0) {
  throw new Error(`No search results were collected from ${searchResult.provider}.`);
}

const sortedCandidates = [...searchResult.candidates].sort((left, right) => right.score - left.score);
const topExemplars = sortedCandidates
  .slice(0, limit)
  .map((candidate, index) => ({
    title: candidate.title,
    url: candidate.url,
    platform: candidate.platform,
    publishedAt: candidate.publishedAt || null,
    searchQuery: candidate.searchQuery,
    snippet: candidate.snippet,
    engagementEvidence: candidate.engagementEvidence,
    reason: buildReason(candidate, index),
    takeaways: buildTakeaways(candidate),
    qualitySignals: candidate.qualitySignals
  }));

const topSources = sortedCandidates
  .slice(0, Math.max(2, Math.min(limit, 4)))
  .map((candidate) => ({
    title: candidate.title,
    url: candidate.url,
    publishedAt: candidate.publishedAt || null,
    note: buildSourceNote(candidate),
    platform: candidate.platform,
    searchQuery: candidate.searchQuery,
    snippet: candidate.snippet
  }));

const findings = buildFindings({
  queryAnswers: searchResult.queryAnswers,
  candidates: sortedCandidates
});

draft.research.searchQueries = dedupeStrings([
  ...(draft.research?.searchQueries || []),
  ...queries
]);
draft.research.sources = append
  ? dedupeSources([...(draft.research?.sources || []), ...topSources])
  : dedupeSources(topSources);
draft.research.findings = append
  ? dedupeStrings([...(draft.research?.findings || []), ...findings])
  : dedupeStrings(findings);
draft.research.exemplars = append
  ? dedupeExemplars([...(draft.research?.exemplars || []), ...topExemplars])
  : topExemplars;

writeJson(draftPath, draft);
console.log(JSON.stringify({
  draftPath,
  provider: searchResult.provider,
  usedFallback: searchResult.usedFallback,
  tavilyConfigured: Boolean(tavilyApiKey),
  queries,
  sources: topSources.map((item) => ({
    title: item.title,
    platform: item.platform,
    url: item.url
  })),
  exemplars: topExemplars.map((item) => ({
    title: item.title,
    platform: item.platform,
    url: item.url,
    engagementEvidence: item.engagementEvidence
  }))
}, null, 2));

async function collectResearchCandidates({ queries: currentQueries, perQuery: currentPerQuery, providerPreference: currentProviderPreference, tavilyApiKey: currentTavilyApiKey }) {
  if (currentProviderPreference === "tavily" && !currentTavilyApiKey) {
    throw new Error("Missing Tavily API key. Provide --api-key, set TAVILY_API_KEY, or use --env-file.");
  }

  let tavilyError = null;
  if (currentProviderPreference !== "bing" && currentTavilyApiKey) {
    try {
      const tavilyResult = await collectFromTavily({
        queries: currentQueries,
        perQuery: currentPerQuery,
        apiKey: currentTavilyApiKey
      });
      if (tavilyResult.candidates.length > 0) {
        return {
          provider: "tavily",
          usedFallback: false,
          candidates: tavilyResult.candidates,
          queryAnswers: tavilyResult.queryAnswers
        };
      }
      tavilyError = "Tavily returned no usable results.";
    } catch (error) {
      tavilyError = error instanceof Error ? error.message : String(error);
      if (currentProviderPreference === "tavily") {
        throw error;
      }
    }
  }

  const bingResult = await collectFromBing({
    queries: currentQueries,
    perQuery: currentPerQuery
  });

  if (bingResult.candidates.length === 0 && tavilyError) {
    throw new Error(`Tavily search failed (${tavilyError}) and Bing fallback returned no results.`);
  }

  return {
    provider: tavilyError ? "bing-fallback" : "bing",
    usedFallback: Boolean(tavilyError),
    candidates: bingResult.candidates,
    queryAnswers: []
  };
}

async function collectFromTavily({ queries: currentQueries, perQuery: currentPerQuery, apiKey }) {
  const candidates = [];
  const queryAnswers = [];
  const seenUrls = new Set();

  for (const query of currentQueries) {
    const body = {
      query,
      topic: inferTavilyTopic(query),
      search_depth: "advanced",
      max_results: currentPerQuery,
      include_answer: true,
      include_raw_content: false,
      include_images: false
    };
    const country = inferTavilyCountry(query);
    if (country) {
      body.country = country;
    }

    const response = await fetchJson("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        ...body
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (typeof response.answer === "string" && response.answer.trim()) {
      queryAnswers.push({
        query,
        answer: cleanText(response.answer)
      });
    }

    for (const result of Array.isArray(response.results) ? response.results : []) {
      const url = normalizeUrl(result.url);
      const title = cleanText(result.title || "");
      if (!url || !title || seenUrls.has(url)) {
        continue;
      }
      seenUrls.add(url);

      candidates.push(finalizeCandidate({
        title,
        url,
        snippet: cleanText(result.content || result.raw_content || ""),
        preview: cleanText(result.raw_content || result.content || "").slice(0, 3000),
        publishedAt: normalizePublishedAt(result.published_date || result.publishedAt || null),
        searchQuery: query,
        sourceProvider: "tavily",
        relevanceScore: typeof result.score === "number" ? result.score : null
      }));
    }
  }

  return {
    candidates,
    queryAnswers
  };
}

async function collectFromBing({ queries: currentQueries, perQuery: currentPerQuery }) {
  const candidates = [];
  const seenUrls = new Set();

  for (const query of currentQueries) {
    const html = await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
      headers: {
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "user-agent": "Mozilla/5.0"
      }
    });
    const results = parseBingResults(html).slice(0, currentPerQuery);

    for (const result of results) {
      if (seenUrls.has(result.url)) {
        continue;
      }
      seenUrls.add(result.url);

      let preview = "";
      try {
        preview = await fetchPagePreview(result.url);
      } catch {
        preview = "";
      }

      candidates.push(finalizeCandidate({
        ...result,
        preview,
        searchQuery: query,
        sourceProvider: "bing"
      }));
    }
  }

  return {
    candidates
  };
}

function finalizeCandidate(candidate) {
  const snippet = truncate(cleanText(candidate.snippet || ""), 600);
  const preview = truncate(cleanText(candidate.preview || snippet), 1500);
  const analysis = analyzeQuality({
    ...candidate,
    snippet,
    preview
  });
  return {
    ...candidate,
    snippet,
    preview,
    platform: inferPlatform(candidate.url),
    publishedAt: candidate.publishedAt || extractPublishedAt(`${snippet}\n${preview}`),
    qualitySignals: analysis.signals,
    engagementEvidence: analysis.engagementEvidence,
    score: analysis.score + boostFromRelevance(candidate.relevanceScore)
  };
}

function buildQueries(currentDraft) {
  const topic = currentDraft.research?.userIntent?.topic || currentDraft.theme || "";
  const direction = currentDraft.research?.userIntent?.direction || currentDraft.direction || "";
  const brief = currentDraft.research?.userIntent?.brief || currentDraft.brief || "";
  if (!topic.trim()) {
    return [];
  }

  if (containsChinese(`${topic} ${direction} ${brief}`)) {
    return dedupeStrings([
      `${topic} ${direction}`.trim(),
      `${topic} 深度分析 文章`,
      `${topic} 高赞 文章`,
      `${topic} 爆文 点赞 转发`,
      `${topic} site:zhuanlan.zhihu.com`,
      `${topic} site:mp.weixin.qq.com`,
      `${topic} ${brief}`.trim()
    ]);
  }

  return dedupeStrings([
    `${topic} ${direction}`.trim(),
    `${topic} longform analysis article`,
    `${topic} high engagement article`,
    `${topic} viral post analysis`,
    `${topic} site:medium.com`,
    `${topic} site:substack.com`,
    `${topic} ${brief}`.trim()
  ]);
}

function parseBingResults(html) {
  const matches = [...html.matchAll(/<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?(?:<div class="b_caption"><p[^>]*>([\s\S]*?)<\/p><\/div>)?/g)];
  return matches
    .map((match) => ({
      url: normalizeUrl(match[1] || ""),
      title: cleanText(match[2] || ""),
      snippet: cleanText(match[3] || "")
    }))
    .filter((item) => item.url && item.title)
    .filter((item) => !/^https?:\/\/(www\.)?bing\.com\//i.test(item.url));
}

async function fetchPagePreview(url) {
  const html = await fetchText(url, {
    headers: {
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "user-agent": "Mozilla/5.0"
    },
    timeoutMs: 8000
  });
  return cleanText(html).slice(0, 3000);
}

function analyzeQuality(candidate) {
  const haystack = `${candidate.title}\n${candidate.snippet}\n${candidate.preview || ""}`;
  const lowerUrl = String(candidate.url || "").toLowerCase();
  const patterns = [
    { regex: /10w\+|10万\+|10万阅读|100k\+|百万阅读/gi, weight: 5, label: "出现高阅读量标记" },
    { regex: /高赞|爆文|刷屏|热文|热门|viral|widely shared/gi, weight: 4, label: "出现高传播描述" },
    { regex: /点赞|转发|收藏|阅读量|likes?|shares?|views?|claps?/gi, weight: 3, label: "出现互动指标关键词" },
    { regex: /深度|长文|分析|拆解|复盘|longform|analysis/gi, weight: 2, label: "更像深度文章而非浅层摘要" },
    { regex: /案例|实战|经验|方法论|framework|playbook/gi, weight: 1, label: "包含可借鉴的方法或案例表达" },
    { regex: /专栏|观察|评论|文章|column|essay|opinion/gi, weight: 2, label: "文章页特征更明显" }
  ];
  const penalties = [
    { regex: /文档|安装|教程|指南|docs|documentation|quickstart|getting started/gi, weight: 4, label: "文档或教程特征过强" },
    { regex: /中文站|官网|首页|home|what is/gi, weight: 3, label: "更像站点入口而非范文" }
  ];

  let score = 0;
  const signals = [];
  for (const item of patterns) {
    if (item.regex.test(haystack)) {
      score += item.weight;
      signals.push(item.label);
    }
  }

  if (/zhihu\.com|xiaohongshu\.com|mp\.weixin\.qq\.com|36kr\.com|juejin\.cn|substack\.com|medium\.com/i.test(candidate.url)) {
    score += 2;
    signals.push("内容平台域名命中");
  }
  if (/\/(p|article|articles|post|posts|insight|news|column)\//i.test(lowerUrl) || /zhuanlan\.zhihu\.com\/p\//i.test(lowerUrl)) {
    score += 2;
    signals.push("URL 更像具体文章页");
  }
  if (lowerUrl.endsWith("/") && countUrlPathSegments(lowerUrl) <= 1) {
    score -= 3;
  }
  for (const item of penalties) {
    if (item.regex.test(haystack)) {
      score -= item.weight;
    }
  }

  const engagementEvidence = signals.length > 0
    ? signals.join("；")
    : "搜索结果未直接暴露点赞/转发数据，保留为同主题候选范文，后续写作前需人工复核互动质量。";

  return {
    score,
    signals,
    engagementEvidence
  };
}

function buildReason(candidate, index) {
  const starter = index === 0
    ? "优先参考这篇范文的选题角度和结构节奏。"
    : "参考这篇范文的结构组织和材料展开方式。";
  if (candidate.qualitySignals?.includes("更像深度文章而非浅层摘要")) {
    return `${starter}重点借鉴其如何把观点拆成可读的小节，而不是照搬措辞。`;
  }
  return `${starter}只借鉴角度、证据组织和叙事推进，不直接复制原文。`;
}

function buildTakeaways(candidate) {
  const takeaways = [];
  if (candidate.snippet) {
    takeaways.push(candidate.snippet.slice(0, 140));
  }
  if (candidate.qualitySignals?.length > 0) {
    takeaways.push(`质量信号：${candidate.qualitySignals.join("，")}`);
  }
  takeaways.push(`检索词：${candidate.searchQuery}`);
  return takeaways.slice(0, 3);
}

function buildSourceNote(candidate) {
  const parts = [];
  if (candidate.searchQuery) {
    parts.push(`对应检索词「${candidate.searchQuery}」`);
  }
  if (candidate.publishedAt) {
    parts.push(`可补充发布时间线索 ${candidate.publishedAt}`);
  }
  if (candidate.snippet) {
    parts.push(`可为正文提供事实线索或表述范围`);
  }
  if (candidate.qualitySignals?.includes("更像深度文章而非浅层摘要")) {
    parts.push("同时可借鉴其分析框架");
  }
  return `${parts.join("，")}。`;
}

function buildFindings({ queryAnswers, candidates }) {
  const findings = [];

  for (const item of queryAnswers) {
    const answer = String(item.answer || "").trim();
    if (!isUsefulFindingAnswer(answer)) {
      continue;
    }
    findings.push(`检索词「${item.query}」的综合摘要：${truncate(answer, 180)}`);
  }

  for (const candidate of candidates) {
    if (findings.length >= 4) {
      break;
    }
    if (!candidate.snippet) {
      continue;
    }
    findings.push(`来源《${candidate.title}》显示：${truncate(candidate.snippet, 160)}`);
  }

  return dedupeStrings(findings).slice(0, 4);
}

function dedupeStrings(items) {
  const seen = new Set();
  const output = [];
  for (const item of items.map((value) => String(value || "").trim()).filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

function dedupeSources(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = String(item?.url || "").trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

function dedupeExemplars(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = String(item?.url || "").trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

function inferPlatform(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname.replace(/^www\./i, "");
    return hostname;
  } catch {
    return "unknown";
  }
}

function countUrlPathSegments(rawUrl) {
  try {
    const pathname = new URL(rawUrl).pathname;
    return pathname.split("/").filter(Boolean).length;
  } catch {
    return 99;
  }
}

function extractPublishedAt(text) {
  const absolute = text.match(/\b20\d{2}[-/.年](?:0?[1-9]|1[0-2])[-/.月](?:0?[1-9]|[12]\d|3[01])日?\b/);
  if (absolute) {
    return absolute[0].replaceAll("年", "-").replaceAll("月", "-").replaceAll("日", "").replaceAll("/", "-").replaceAll(".", "-");
  }
  const relative = text.match(/\b\d+\s*(?:天|日|小时|分钟前)\s*(?:之前|前)\b/);
  return relative ? relative[0] : null;
}

async function fetchText(url, { headers = {}, timeoutMs = 10000 } = {}) {
  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function cleanText(value) {
  return decodeHtml(stripTags(String(value || "")))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function containsChinese(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function clampInteger(input, min, max, fallback) {
  const value = Number.parseInt(String(input ?? fallback), 10);
  if (Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function normalizeProvider(value) {
  const provider = String(value || "auto").trim().toLowerCase();
  return provider === "tavily" || provider === "bing" ? provider : "auto";
}

function resolveOptionalApiKey({ apiKey, envFile, envKey }) {
  if (apiKey) {
    return String(apiKey).trim();
  }
  if (process.env[envKey]) {
    return String(process.env[envKey]).trim();
  }
  if (!envFile) {
    return "";
  }
  const envMap = loadEnvFile(envFile);
  return String(envMap[envKey] || "").trim();
}

function normalizeUrl(value) {
  const url = decodeHtml(String(value || "")).trim();
  if (!url) {
    return "";
  }
  try {
    return new URL(url).toString();
  } catch {
    return "";
  }
}

function normalizePublishedAt(value) {
  if (!value) {
    return null;
  }
  return extractPublishedAt(String(value)) || String(value).trim() || null;
}

function boostFromRelevance(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.round(Math.max(0, Math.min(1, value)) * 3);
}

function truncate(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function isUsefulFindingAnswer(value) {
  const text = String(value || "").trim();
  if (text.length < 40) {
    return false;
  }
  return !/^(i am an ai system|i'm an ai system|i am an ai assistant|i do not identify as any specific model|based on my training data)/i.test(text);
}

function inferTavilyTopic(query) {
  const lower = String(query || "").toLowerCase();
  if (/(news|最新|今日|本周|recent|202[4-9]|20[3-9]\d)/i.test(lower)) {
    return "news";
  }
  return "general";
}

function inferTavilyCountry(query) {
  return containsChinese(query) ? "china" : "";
}

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  imagePathToDataUri,
  normalizeArtifactManifest,
  normalizeDraft,
  parseArgs,
  readJson,
  resolveDraftPath,
  upsertArtifact,
  writeJson,
  writeText
} from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const draft = normalizeDraft(readJson(draftPath));
const outPath = path.resolve(args.out || path.join(path.dirname(draftPath), "review.single.html"));
const artifactManifestPath = path.resolve(args["artifacts-out"] || path.join(path.dirname(outPath), "artifacts.json"));
const draftDir = path.dirname(draftPath);
const article = draft.article || {};
const embeddedImageCount = (article.images || []).filter((image) => image.localImage).length;
const selfContained = true;

if (embeddedImageCount < 3) {
  throw new Error("A banner plus at least 2 inline generated images are required before rendering review.single.html.");
}

const notesHtml = Array.isArray(draft.notes) && draft.notes.length > 0
  ? `<section class="notes"><h2>备注</h2><ul>${draft.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></section>`
  : "";

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(article.title || draft.theme)} - 审核页</title>
  <style>
    :root {
      --bg: #f4efe7;
      --ink: #1f1b18;
      --muted: #665d55;
      --card: rgba(255,255,255,0.86);
      --line: rgba(31,27,24,0.12);
      --accent: #d6602b;
      --accent-2: #145f63;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(214,96,43,0.15), transparent 32%),
        radial-gradient(circle at top right, rgba(20,95,99,0.16), transparent 28%),
        linear-gradient(180deg, #f7f1e8 0%, #efe5d7 100%);
    }
    .page {
      width: min(1400px, calc(100vw - 24px));
      margin: 24px auto 48px;
    }
    .hero {
      border: 1px solid var(--line);
      background: linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,248,239,0.74));
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 24px 60px rgba(56, 42, 24, 0.10);
    }
    .eyebrow {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(214,96,43,0.12);
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    h1 {
      margin: 16px 0 10px;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.08;
    }
    .meta, .rules {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
      color: var(--muted);
      font-size: 14px;
    }
    .chip {
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255,255,255,0.72);
    }
    .grid {
      display: grid;
      gap: 18px;
      grid-template-columns: 1.1fr 0.9fr;
      margin-top: 24px;
    }
    .stack {
      display: grid;
      gap: 18px;
      margin-top: 24px;
    }
    .card {
      border: 1px solid var(--line);
      background: var(--card);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 40px rgba(44, 33, 19, 0.08);
    }
    .body {
      padding: 20px;
    }
    .kicker {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(20,95,99,0.10);
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 24px;
      line-height: 1.2;
    }
    .post-meta {
      display: grid;
      gap: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      color: var(--muted);
    }
    .content, .muted {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    .article-flow {
      display: grid;
      gap: 14px;
    }
    .article-flow h3 {
      margin: 8px 0 0;
      font-size: 18px;
      line-height: 1.35;
    }
    .article-flow p, .article-flow blockquote {
      margin: 0;
      font-size: 15px;
      line-height: 1.9;
    }
    .article-flow blockquote {
      padding: 14px 16px;
      border-left: 4px solid rgba(214,96,43,0.55);
      background: rgba(214,96,43,0.06);
      border-radius: 12px;
      color: #473730;
    }
    .article-flow ul {
      margin: 0;
      padding-left: 20px;
    }
    .source-list, .plan-list {
      display: grid;
      gap: 12px;
      margin-top: 12px;
    }
    .source-item, .plan-item {
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255,255,255,0.70);
    }
    .source-item a {
      color: var(--accent-2);
      text-decoration: none;
    }
    .article-flow img, .img-missing {
      display: block;
      width: 100%;
      border-radius: 18px;
      object-fit: contain;
      background: linear-gradient(135deg, rgba(214,96,43,0.15), rgba(20,95,99,0.16));
    }
    .banner-figure {
      margin: 0 0 22px;
      display: block;
    }
    .banner-stage {
      position: relative;
      overflow: hidden;
      border-radius: 22px;
      border: 1px solid var(--line);
      background: #efe7da;
    }
    .banner-stage::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(19,16,14,0.12) 0%, rgba(19,16,14,0.55) 100%);
      pointer-events: none;
    }
    .banner-stage img {
      display: block;
      width: 100%;
      aspect-ratio: 5 / 2;
      object-fit: contain;
      object-position: center;
      border-radius: 0;
      background: linear-gradient(135deg, rgba(214,96,43,0.10), rgba(20,95,99,0.14));
    }
    .banner-copy {
      position: absolute;
      inset: auto 0 0 0;
      z-index: 1;
      padding: clamp(16px, 2.2vw, 30px);
      color: #fff7f0;
    }
    .banner-copy h3 {
      margin: 0;
      font-size: clamp(22px, 3.4vw, 38px);
      line-height: 1.12;
      color: inherit;
      text-shadow: 0 4px 18px rgba(0,0,0,0.26);
    }
    .banner-copy p {
      margin: 10px 0 0;
      max-width: 70ch;
      font-size: clamp(13px, 1.5vw, 16px);
      line-height: 1.6;
      color: rgba(255,247,240,0.92);
      text-shadow: 0 2px 10px rgba(0,0,0,0.22);
    }
    .img-missing {
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 14px;
      min-height: 240px;
    }
    figure {
      margin: 0;
      display: grid;
      gap: 8px;
    }
    figcaption {
      font-size: 13px;
      color: var(--muted);
    }
    .notes {
      margin-top: 24px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.76);
      border-radius: 20px;
      padding: 22px;
    }
    ul {
      margin: 10px 0 0;
      padding-left: 18px;
      line-height: 1.8;
    }
    @media (max-width: 980px) {
    .page { width: min(100vw - 20px, 1200px); }
      .hero { padding: 22px; }
      .grid { grid-template-columns: 1fr; }
      .banner-copy p { max-width: none; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <span class="eyebrow">REVIEW ONLY</span>
      <h1>${escapeHtml(article.title || draft.theme)} 图文审核页</h1>
      <div class="meta">
        <span class="chip">Job ID: ${escapeHtml(draft.jobId || "")}</span>
        <span class="chip">当前状态: ${escapeHtml(draft.status || "draft")}</span>
        <span class="chip">审核状态: ${escapeHtml(draft.approval?.status || "pending")}</span>
        <span class="chip">Humanizer: ${escapeHtml(article.humanizer?.status || "pending")}</span>
        <span class="chip">Banner: ${escapeHtml(article.bannerImageKey || "未设置")}</span>
        <span class="chip">已规划配图: ${escapeHtml(String((article.images || []).length))}</span>
      </div>
      <div class="rules">
        <span class="chip">规则 1：未明确批准前，不得发布</span>
        <span class="chip">规则 2：先调研、后定结构、再写正文</span>
        <span class="chip">规则 3：正文必须先经 humanizer，再生成配图与 HTML</span>
      </div>
    </section>
    <section class="grid">
      <article class="card">
        <div class="body">
          <span class="kicker">用户输入</span>
          <h2>${escapeHtml(draft.theme || "")}</h2>
          <div class="muted">方向：${escapeHtml(draft.research?.userIntent?.direction || draft.direction || "未填写")}</div>
          <div class="muted">简要思路：${escapeHtml(draft.research?.userIntent?.brief || draft.brief || "未填写")}</div>
          <div class="muted">文章角度：${escapeHtml(draft.plan?.angle || "未填写")}</div>
          <div class="muted">目标读者：${escapeHtml(draft.plan?.audience || "未填写")}</div>
          <div class="muted">文章承诺：${escapeHtml(draft.plan?.promise || "未填写")}</div>
        </div>
      </article>
      <article class="card">
        <div class="body">
          <span class="kicker">调研摘要</span>
          <h2>已收集 ${escapeHtml(String((draft.research?.sources || []).length))} 个来源</h2>
          <div class="content">${escapeHtml((draft.research?.findings || []).join("\n\n"))}</div>
        </div>
      </article>
    </section>
    <section class="stack">
      <article class="card">
        <div class="body">
          <span class="kicker">资料来源</span>
          <h2>检索与参考</h2>
          <div class="source-list">${renderSources(draft.research?.sources || [])}</div>
        </div>
      </article>
      <article class="card">
        <div class="body">
          <span class="kicker">对标范文</span>
          <h2>优先参考高质量已发布文章</h2>
          <div class="source-list">${renderExemplars(draft.research?.exemplars || [])}</div>
        </div>
      </article>
      <article class="card">
        <div class="body">
          <span class="kicker">文章结构</span>
          <h2>段落与叙事安排</h2>
          <div class="plan-list">${renderSections(draft.plan?.sections || [])}</div>
        </div>
      </article>
      <article class="card">
        <div class="body">
          <span class="kicker">配图规划</span>
          <h2>1 张标题横幅 + 至少 2 张文内配图</h2>
          <div class="plan-list">${renderImagePlan(draft.plan?.imagePlan || [], article.images || [])}</div>
        </div>
      </article>
      ${renderArticle(article, draftDir)}
    </section>
    ${notesHtml}
  </main>
</body>
</html>
`;

writeText(outPath, html);
const artifactManifest = buildArtifactManifest();
writeJson(artifactManifestPath, artifactManifest);
console.log(JSON.stringify({
  outPath,
  artifactManifestPath,
  embeddedImageCount,
  selfContained,
  artifacts: artifactManifest.artifacts
}, null, 2));

function buildArtifactManifest() {
  const stat = fs.statSync(outPath);
  let manifest = normalizeArtifactManifest(
    fs.existsSync(artifactManifestPath) ? readJson(artifactManifestPath) : null,
    {
      draft,
      generatedAt: new Date().toISOString()
    }
  );
  manifest.generatedAt = new Date().toISOString();
  manifest = upsertArtifact(manifest, {
    id: "review_html",
    kind: "html_review",
    role: "review",
    path: outPath,
    filename: path.basename(outPath),
    mimeType: "text/html",
    caption: `审核状态：${draft.approval?.status || "pending approval"}`,
    selfContained,
    embeddedImageCount,
    fileSizeBytes: stat.size
  });
  return manifest;
}

function renderSources(sources) {
  if (sources.length === 0) {
    return `<div class="source-item">暂无来源</div>`;
  }
  return sources.map((source) => `<div class="source-item">
    <div><strong>${escapeHtml(source.title || "")}</strong></div>
    <div class="muted">${escapeHtml(source.publishedAt || "日期未记录")}</div>
    <div class="muted">${escapeHtml(source.note || "")}</div>
    ${source.url ? `<div class="muted"><a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a></div>` : ""}
  </div>`).join("\n");
}

function renderExemplars(exemplars) {
  if (exemplars.length === 0) {
    return `<div class="source-item">暂无对标范文</div>`;
  }
  return exemplars.map((item) => `<div class="source-item">
    <div><strong>${escapeHtml(item.title || "")}</strong></div>
    <div class="muted">平台：${escapeHtml(item.platform || "未记录")}</div>
    <div class="muted">${escapeHtml(item.publishedAt || "日期未记录")}</div>
    <div class="muted">质量信号：${escapeHtml(item.engagementEvidence || "未记录")}</div>
    <div class="muted">参照理由：${escapeHtml(item.reason || "")}</div>
    ${Array.isArray(item.takeaways) && item.takeaways.length > 0
      ? `<ul>${item.takeaways.map((takeaway) => `<li>${escapeHtml(takeaway)}</li>`).join("")}</ul>`
      : ""}
    ${item.url ? `<div class="muted"><a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a></div>` : ""}
  </div>`).join("\n");
}

function renderSections(sections) {
  if (sections.length === 0) {
    return `<div class="plan-item">暂无结构</div>`;
  }
  return sections.map((section, index) => `<div class="plan-item">
    <div><strong>${index + 1}. ${escapeHtml(section.heading || "")}</strong></div>
    <div class="muted">${escapeHtml(section.purpose || "")}</div>
    ${Array.isArray(section.keyPoints) && section.keyPoints.length > 0
      ? `<ul>${section.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : ""}
  </div>`).join("\n");
}

function renderImagePlan(imagePlan, images) {
  if (imagePlan.length === 0 && images.length === 0) {
    return `<div class="plan-item">暂无配图规划</div>`;
  }
  const imageMap = new Map(images.map((image) => [image.key, image]));
  return (imagePlan.length > 0 ? imagePlan : images).map((item, index) => {
    const image = imageMap.get(item.key) || item;
    return `<div class="plan-item">
      <div><strong>${index + 1}. ${escapeHtml(image.key || "")}</strong></div>
      <div class="muted">位置：${escapeHtml(item.placement || image.placement || "正文中")}</div>
      ${(item.size || image.size) ? `<div class="muted">尺寸：${escapeHtml(item.size || image.size)}</div>` : ""}
      <div class="muted">目的：${escapeHtml(item.purpose || image.purpose || "")}</div>
      ${(item.relatedSectionHeading || image.relatedSectionHeading) ? `<div class="muted">关联段落：${escapeHtml(item.relatedSectionHeading || image.relatedSectionHeading)}</div>` : ""}
      ${(item.scene || image.scene) ? `<div class="muted">使用场景：${escapeHtml(item.scene || image.scene)}</div>` : ""}
      <div class="muted">图注：${escapeHtml(image.caption || item.caption || "未填写")}</div>
    </div>`;
  }).join("\n");
}

function renderArticle(article, draftDir) {
  return `<article class="card">
    <div class="body">
      <span class="kicker">正文成稿</span>
      <h2>${escapeHtml(article.title || "")}</h2>
      <div class="post-meta">
        <span>副标题：${escapeHtml(article.subtitle || "无")}</span>
        <span>摘要：${escapeHtml(article.summary || "")}</span>
        <span>标题横幅：${escapeHtml(article.bannerImageKey || "未设置")}</span>
        <span>Humanizer 来源：${escapeHtml(article.humanizer?.source || "bundled-humanizer")}</span>
        ${article.images?.[0]?.imageModel ? `<span>配图模型：${escapeHtml(article.images[0].imageModel)}</span>` : ""}
      </div>
      ${renderBanner(article, draftDir)}
      <div class="article-flow">${renderBlocks(article, draftDir)}</div>
    </div>
  </article>`;
}

function renderBanner(article, draftDir) {
  if (!article.bannerImageKey) {
    return "";
  }
  const image = (article.images || []).find((item) => item.key === article.bannerImageKey);
  if (!image?.localImage) {
    throw new Error(`Missing generated banner image for key '${article.bannerImageKey}'.`);
  }
  const dataUri = imagePathToDataUri(path.resolve(draftDir, image.localImage));
  const subtitle = article.subtitle || article.summary || "";
  return `<figure class="banner-figure">
    <div class="banner-stage">
      <img src="${escapeAttr(dataUri)}" alt="${escapeAttr(image.alt || article.title || "banner image")}">
      <div class="banner-copy">
        <h3>${escapeHtml(article.title || "")}</h3>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
      </div>
    </div>
    ${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}
  </figure>`;
}

function renderBlocks(article, draftDir) {
  const imageMap = new Map((article.images || []).map((image) => [image.key, image]));
  return (article.blocks || []).map((block) => {
    if (block.type === "paragraph") {
      return `<p>${escapeHtml(block.text || "")}</p>`;
    }
    if (block.type === "heading") {
      return `<h3>${escapeHtml(block.text || "")}</h3>`;
    }
    if (block.type === "quote") {
      return `<blockquote>${escapeHtml(block.text || "")}</blockquote>`;
    }
    if (block.type === "list") {
      return `<ul>${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }
    if (block.type === "image") {
      if (article.bannerImageKey && block.imageKey === article.bannerImageKey) {
        return "";
      }
      const image = imageMap.get(block.imageKey);
      if (!image?.localImage) {
        throw new Error(`Missing generated image for block key '${block.imageKey || ""}'.`);
      }
      const dataUri = imagePathToDataUri(path.resolve(draftDir, image.localImage));
      const caption = block.caption || image.caption || "";
      const alt = image.alt || article.title || "article image";
      return `<figure><img src="${escapeAttr(dataUri)}" alt="${escapeAttr(alt)}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
    }
    return "";
  }).filter(Boolean).join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

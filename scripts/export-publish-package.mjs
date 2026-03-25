#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
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
const draftDir = path.dirname(draftPath);
const outDir = path.resolve(args["out-dir"] || path.join(draftDir, "publish"));
const zipPath = path.resolve(args.out || path.join(draftDir, "publish-package.zip"));
const artifactManifestPath = path.resolve(args["artifacts-out"] || path.join(draftDir, "artifacts.json"));

if (!draft.article?.title || !Array.isArray(draft.article?.blocks) || draft.article.blocks.length === 0) {
  throw new Error("Draft article is incomplete. Fill article.title and article.blocks before exporting.");
}
if ((draft.article?.images || []).filter((image) => image.localImage).length < 3) {
  throw new Error("A banner plus at least 2 inline generated images are required before exporting the publish package.");
}
if (!draft.article?.bannerImageKey) {
  throw new Error("article.bannerImageKey is required before exporting the publish package.");
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, "images"), { recursive: true });

const copiedImages = copyImages();
const articleMdPath = path.join(outDir, "article.md");
const articleTxtPath = path.join(outDir, "article.txt");
const articleHtmlPath = path.join(outDir, "article.html");
const sourcesMdPath = path.join(outDir, "sources.md");
const publishManifestPath = path.join(outDir, "manifest.json");

writeText(articleMdPath, renderMarkdown(copiedImages));
writeText(articleTxtPath, renderPlainText(copiedImages));
writeText(articleHtmlPath, renderHtml(copiedImages));
writeText(sourcesMdPath, renderSourcesMarkdown());
writeJson(publishManifestPath, {
  schemaVersion: 1,
  jobId: draft.jobId,
  theme: draft.theme,
  title: draft.article.title,
  subtitle: draft.article.subtitle || null,
  summary: draft.article.summary || null,
  generatedAt: new Date().toISOString(),
  files: {
    articleMarkdown: "article.md",
    articleText: "article.txt",
    articleHtml: "article.html",
    sources: "sources.md",
    images: copiedImages.map((item) => item.outputPath)
  }
});

createZipArchive(outDir, zipPath);

const zipStat = fs.statSync(zipPath);
let artifactManifest = normalizeArtifactManifest(
  fs.existsSync(artifactManifestPath) ? readJson(artifactManifestPath) : null,
  {
    draft,
    generatedAt: new Date().toISOString()
  }
);
artifactManifest.generatedAt = new Date().toISOString();
artifactManifest = upsertArtifact(artifactManifest, {
  id: "publish_package_zip",
  kind: "publish_package",
  role: "publish",
  path: zipPath,
  filename: path.basename(zipPath),
  mimeType: "application/zip",
  caption: `${draft.article.title || draft.theme} 发布包`,
  fileSizeBytes: zipStat.size
});
writeJson(artifactManifestPath, artifactManifest);

console.log(JSON.stringify({
  draftPath,
  outDir,
  zipPath,
  artifactManifestPath,
  copiedImages: copiedImages.map((item) => item.outputPath)
}, null, 2));

function copyImages() {
  const images = [];
  const seen = new Set();

  for (const image of draft.article?.images || []) {
    if (!image.localImage) {
      continue;
    }
    const inputPath = path.resolve(draftDir, image.localImage);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Missing generated image file: ${inputPath}`);
    }
    const fileName = path.basename(inputPath);
    const outputRelativePath = path.posix.join("images", fileName);
    if (!seen.has(outputRelativePath)) {
      fs.copyFileSync(inputPath, path.join(outDir, outputRelativePath));
      seen.add(outputRelativePath);
    }
    images.push({
      key: image.key,
      caption: image.caption || "",
      alt: image.alt || "",
      outputPath: outputRelativePath
    });
  }

  return images;
}

function renderMarkdown(images) {
  const lines = [];
  const bannerImage = findBannerImage(images);
  lines.push(`# ${draft.article.title || draft.theme}`);
  if (draft.article.subtitle) {
    lines.push("");
    lines.push(`> ${draft.article.subtitle}`);
  }
  if (draft.article.summary) {
    lines.push("");
    lines.push(draft.article.summary);
  }
  if (bannerImage) {
    lines.push("");
    lines.push(`![${bannerImage.alt || draft.article.title || "banner image"}](${bannerImage.outputPath})`);
    if (bannerImage.caption) {
      lines.push("");
      lines.push(`*${bannerImage.caption}*`);
    }
  }
  lines.push("");
  lines.push(...renderMarkdownBlocks(images));
  lines.push("");
  lines.push("## 参考资料");
  lines.push("");
  for (const source of draft.research?.sources || []) {
    lines.push(`- ${source.title} - ${source.url}`);
  }
  return `${lines.join("\n").trim()}\n`;
}

function renderMarkdownBlocks(images) {
  const lines = [];
  const imageMap = new Map(images.map((image) => [image.key, image]));
  for (const block of draft.article?.blocks || []) {
    if (block.type === "heading") {
      lines.push(`## ${block.text || ""}`);
      lines.push("");
      continue;
    }
    if (block.type === "paragraph") {
      lines.push(block.text || "");
      lines.push("");
      continue;
    }
    if (block.type === "quote") {
      lines.push(`> ${block.text || ""}`);
      lines.push("");
      continue;
    }
    if (block.type === "list") {
      for (const item of block.items || []) {
        lines.push(`- ${item}`);
      }
      lines.push("");
      continue;
    }
    if (block.type === "image") {
      if (draft.article?.bannerImageKey && block.imageKey === draft.article.bannerImageKey) {
        continue;
      }
      const image = imageMap.get(block.imageKey);
      if (!image) {
        continue;
      }
      lines.push(`![${image.alt || draft.article.title || "article image"}](${image.outputPath})`);
      if (block.caption || image.caption) {
        lines.push("");
        lines.push(`*${block.caption || image.caption}*`);
      }
      lines.push("");
    }
  }
  return lines;
}

function renderPlainText(images) {
  const lines = [];
  const bannerImage = findBannerImage(images);
  lines.push(draft.article.title || draft.theme || "");
  if (draft.article.subtitle) {
    lines.push(draft.article.subtitle);
  }
  if (draft.article.summary) {
    lines.push("");
    lines.push(draft.article.summary);
  }
  if (bannerImage) {
    lines.push("");
    lines.push(`[标题横幅] ${bannerImage.outputPath}`);
    if (bannerImage.caption) {
      lines.push(bannerImage.caption);
    }
  }
  lines.push("");
  const imageMap = new Map(images.map((image) => [image.key, image]));
  for (const block of draft.article?.blocks || []) {
    if (block.type === "heading") {
      lines.push(block.text || "");
      lines.push("");
      continue;
    }
    if (block.type === "paragraph" || block.type === "quote") {
      lines.push(block.text || "");
      lines.push("");
      continue;
    }
    if (block.type === "list") {
      for (const item of block.items || []) {
        lines.push(`- ${item}`);
      }
      lines.push("");
      continue;
    }
    if (block.type === "image") {
      if (draft.article?.bannerImageKey && block.imageKey === draft.article.bannerImageKey) {
        continue;
      }
      const image = imageMap.get(block.imageKey);
      if (image) {
        lines.push(`[配图] ${image.outputPath}`);
        if (block.caption || image.caption) {
          lines.push(block.caption || image.caption);
        }
        lines.push("");
      }
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

function renderHtml(images) {
  const imageMap = new Map(images.map((image) => [image.key, image]));
  const bannerImage = findBannerImage(images);
  const blocks = (draft.article?.blocks || []).map((block) => {
    if (block.type === "heading") {
      return `<h2>${escapeHtml(block.text || "")}</h2>`;
    }
    if (block.type === "paragraph") {
      return `<p>${escapeHtml(block.text || "")}</p>`;
    }
    if (block.type === "quote") {
      return `<blockquote>${escapeHtml(block.text || "")}</blockquote>`;
    }
    if (block.type === "list") {
      return `<ul>${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }
    if (block.type === "image") {
      if (draft.article?.bannerImageKey && block.imageKey === draft.article.bannerImageKey) {
        return "";
      }
      const image = imageMap.get(block.imageKey);
      if (!image) {
        return "";
      }
      const caption = block.caption || image.caption || "";
      return `<figure><img src="${escapeAttr(image.outputPath)}" alt="${escapeAttr(image.alt || draft.article.title || "article image")}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
    }
    return "";
  }).filter(Boolean).join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(draft.article.title || draft.theme || "Article")}</title>
  <style>
    body {
      margin: 0;
      background: #f6f1e8;
      color: #1f1b18;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
    }
    main {
      width: min(1080px, calc(100vw - 24px));
      margin: 32px auto 56px;
      padding: 32px;
      background: rgba(255,255,255,0.92);
      border-radius: 24px;
      box-shadow: 0 18px 48px rgba(31, 27, 24, 0.10);
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.1;
    }
    h2 {
      margin: 28px 0 10px;
      font-size: 24px;
      line-height: 1.3;
    }
    p, li, blockquote {
      font-size: 16px;
      line-height: 1.9;
    }
    blockquote {
      margin: 0;
      padding: 14px 18px;
      border-left: 4px solid #d6602b;
      background: rgba(214, 96, 43, 0.07);
      border-radius: 12px;
    }
    img {
      display: block;
      width: 100%;
      border-radius: 18px;
      object-fit: contain;
    }
    figure {
      margin: 22px 0;
    }
    figcaption {
      margin-top: 8px;
      color: #665d55;
      font-size: 14px;
    }
    .subtitle, .summary {
      color: #665d55;
      line-height: 1.8;
    }
    .banner-stage {
      position: relative;
      overflow: hidden;
      border-radius: 22px;
      background: #efe7da;
    }
    .banner-stage img {
      aspect-ratio: 5 / 2;
      border-radius: 0;
    }
    .banner-stage::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(19,16,14,0.10) 0%, rgba(19,16,14,0.52) 100%);
      pointer-events: none;
    }
    .banner-copy {
      position: absolute;
      inset: auto 0 0 0;
      z-index: 1;
      padding: clamp(16px, 2vw, 28px);
      color: #fff7f0;
    }
    .banner-copy h2 {
      margin: 0;
      color: inherit;
      font-size: clamp(24px, 3.2vw, 40px);
      line-height: 1.1;
    }
    .banner-copy p {
      margin: 10px 0 0;
      max-width: 70ch;
      color: rgba(255,247,240,0.92);
      font-size: 15px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(draft.article.title || draft.theme || "")}</h1>
    ${draft.article.subtitle ? `<p class="subtitle">${escapeHtml(draft.article.subtitle)}</p>` : ""}
    ${draft.article.summary ? `<p class="summary">${escapeHtml(draft.article.summary)}</p>` : ""}
    ${bannerImage ? `<figure><div class="banner-stage"><img src="${escapeAttr(bannerImage.outputPath)}" alt="${escapeAttr(bannerImage.alt || draft.article.title || "banner image")}"><div class="banner-copy"><h2>${escapeHtml(draft.article.title || draft.theme || "")}</h2>${draft.article.subtitle || draft.article.summary ? `<p>${escapeHtml(draft.article.subtitle || draft.article.summary || "")}</p>` : ""}</div></div>${bannerImage.caption ? `<figcaption>${escapeHtml(bannerImage.caption)}</figcaption>` : ""}</figure>` : ""}
    ${blocks}
  </main>
</body>
</html>
`;
}

function findBannerImage(images) {
  return images.find((image) => image.key === draft.article?.bannerImageKey) || null;
}

function renderSourcesMarkdown() {
  const lines = [];
  lines.push("# 资料清单");
  lines.push("");
  lines.push("## 检索来源");
  lines.push("");
  for (const source of draft.research?.sources || []) {
    lines.push(`- ${source.title}`);
    lines.push(`  - 链接: ${source.url}`);
    if (source.publishedAt) {
      lines.push(`  - 日期: ${source.publishedAt}`);
    }
    if (source.note) {
      lines.push(`  - 用途: ${source.note}`);
    }
  }
  lines.push("");
  lines.push("## 对标范文");
  lines.push("");
  for (const exemplar of draft.research?.exemplars || []) {
    lines.push(`- ${exemplar.title}`);
    lines.push(`  - 链接: ${exemplar.url}`);
    if (exemplar.platform) {
      lines.push(`  - 平台: ${exemplar.platform}`);
    }
    if (exemplar.engagementEvidence) {
      lines.push(`  - 质量信号: ${exemplar.engagementEvidence}`);
    }
    if (exemplar.reason) {
      lines.push(`  - 参照理由: ${exemplar.reason}`);
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

function createZipArchive(sourceDir, destinationZipPath) {
  fs.rmSync(destinationZipPath, { force: true });

  if (process.platform === "win32") {
    const command = `Compress-Archive -Path '${escapePowerShell(path.join(sourceDir, "*"))}' -DestinationPath '${escapePowerShell(destinationZipPath)}' -Force`;
    const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
      encoding: "utf8"
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "Compress-Archive failed").trim());
    }
    return;
  }

  let result = spawnSync("python3", ["-m", "zipfile", "-c", destinationZipPath, "."], {
    cwd: sourceDir,
    encoding: "utf8"
  });
  if (result.status === 0) {
    return;
  }

  result = spawnSync("zip", ["-r", destinationZipPath, "."], {
    cwd: sourceDir,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "zip archive creation failed").trim());
  }
}

function escapePowerShell(value) {
  return String(value || "").replaceAll("'", "''");
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

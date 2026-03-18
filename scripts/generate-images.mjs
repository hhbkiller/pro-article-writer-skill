#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  ensureDir,
  fetchJson,
  inferExt,
  normalizeDraft,
  parseArgs,
  readJson,
  resolveGatewayBaseUrl,
  resolveGatewayIdentity,
  resolveApiKey,
  resolveDraftPath,
  writeJson
} from "./lib.mjs";

const MIN_IMAGE_PIXELS = 3686400;
const DEFAULT_BANNER_SIZE = "3200x1280";
const DEFAULT_INLINE_SIZE = "2400x1600";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const draft = normalizeDraft(readJson(draftPath));
const draftDir = path.dirname(draftPath);
const imagesDir = path.resolve(args["out-dir"] || path.join(draftDir, "images"));
const model = args.model || "doubao-seedream-5-0-260128";
const useDirectProvider = Boolean(args.direct || args["env-file"] || args["api-key"]);

ensureDir(imagesDir);

if (useDirectProvider) {
  await generateImagesDirect();
} else {
  await generateImagesViaGateway();
}

writeJson(draftPath, draft);
console.log(JSON.stringify({
  draftPath,
  imagesDir,
  article: {
    title: draft.article?.title || "",
    images: (draft.article?.images || []).map((image) => ({
      key: image.key,
      localImage: image.localImage,
      imageModel: image.imageModel
    }))
  }
}, null, 2));

async function generateImagesDirect() {
  const baseUrl = args.baseUrl || "https://ark.cn-beijing.volces.com/api/v3";
  const apiKey = resolveApiKey({
    envFile: args["env-file"],
    envKey: args["env-key"] || "huoshan_API_KEY",
    apiKey: args["api-key"]
  });

  for (const [imageIndex, imageSpec] of (draft.article?.images || []).entries()) {
    assertImageSpecSafe(imageSpec, imageIndex);
    const prompt = buildImagePrompt({ draft, imageSpec, imageIndex });
    const resolvedSize = resolveRequestSize({
      requestedSize: imageSpec.size || args.size || null,
      isBanner: imageSpec.key === draft.article?.bannerImageKey
    });
    const requestBody = {
      model,
      prompt
    };

    if (resolvedSize) {
      requestBody.size = resolvedSize;
    }

    const result = await fetchJson(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const image = result.data?.[0];
    if (!image?.url) {
      throw new Error(`No image URL returned for article.images[${imageIndex}]`);
    }

    await downloadAndAttachImage({
      imageIndex,
      imageSpec,
      imageUrl: image.url,
      imageModel: result.model || model,
      imageSize: image.size || resolvedSize
    });
  }
}

async function generateImagesViaGateway() {
  const gatewayBaseUrl = resolveGatewayBaseUrl(args["gateway-base-url"]);
  const identity = resolveGatewayIdentity({
    explicitApiKey: args["gateway-api-key"],
    stateDir: args["state-dir"]
  });
  for (const [imageIndex, imageSpec] of (draft.article?.images || []).entries()) {
    assertImageSpecSafe(imageSpec, imageIndex);
    const requestSize = resolveRequestSize({
      requestedSize: imageSpec.size || args.size || null,
      isBanner: imageSpec.key === draft.article?.bannerImageKey
    });
    const prompt = buildImagePrompt({ draft, imageSpec, imageIndex });
    const result = await fetchJson(`${gatewayBaseUrl}/relay/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${identity.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        job_id: draft.jobId || null,
        theme: draft.theme || null,
        model,
        size: requestSize,
        items: [
          {
            article_image_index: imageIndex,
            key: imageSpec.key,
            prompt,
            size: requestSize
          }
        ]
      })
    });

    if (!Array.isArray(result.items) || result.items.length !== 1) {
      throw new Error("Gateway image generation returned incomplete results.");
    }

    const item = result.items[0];
    const itemIndex = typeof item.article_image_index === "number" ? item.article_image_index : imageIndex;
    const targetImageSpec = draft.article?.images?.[itemIndex];
    if (!targetImageSpec || !item.url) {
      throw new Error("Gateway image generation returned invalid item mapping.");
    }

    await downloadAndAttachImage({
      imageIndex: itemIndex,
      imageSpec: targetImageSpec,
      imageUrl: item.url,
      imageModel: item.model || result.model || model,
      imageSize: item.size || requestSize
    });
  }
}

async function downloadAndAttachImage({ imageIndex, imageSpec, imageUrl, imageModel, imageSize }) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image for article.images[${imageIndex}]`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const extension = inferExt(imageResponse.headers.get("content-type"));
  const safeKey = String(imageSpec.key || `image-${imageIndex + 1}`).replace(/[^a-zA-Z0-9_-]+/g, "-");
  const fileName = `${String(imageIndex + 1).padStart(2, "0")}-${safeKey}${extension}`;
  const filePath = path.join(imagesDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

  imageSpec.imageModel = imageModel;
  imageSpec.imageGeneratedAt = new Date().toISOString();
  imageSpec.imageSize = imageSize;
  imageSpec.imageUrl = imageUrl;
  imageSpec.localImage = path.relative(draftDir, filePath).replaceAll("\\", "/");
}

function resolveRequestSize({ requestedSize, isBanner }) {
  const parsed = parseSize(requestedSize);
  if (!parsed) {
    return isBanner ? DEFAULT_BANNER_SIZE : DEFAULT_INLINE_SIZE;
  }
  if ((parsed.width * parsed.height) >= MIN_IMAGE_PIXELS) {
    return `${parsed.width}x${parsed.height}`;
  }
  if (isBanner && (parsed.width * 2 === parsed.height * 5)) {
    return DEFAULT_BANNER_SIZE;
  }
  if (parsed.width * 2 === parsed.height * 3) {
    return DEFAULT_INLINE_SIZE;
  }

  const scale = Math.sqrt(MIN_IMAGE_PIXELS / (parsed.width * parsed.height));
  const width = roundUpToMultiple(Math.ceil(parsed.width * scale), 64);
  const height = roundUpToMultiple(Math.ceil(parsed.height * scale), 64);
  return `${width}x${height}`;
}

function parseSize(value) {
  const match = String(value || "").trim().match(/^(\d+)\s*[xX]\s*(\d+)$/);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function roundUpToMultiple(value, multiple) {
  return Math.ceil(value / multiple) * multiple;
}

function buildImagePrompt({ draft, imageSpec, imageIndex }) {
  const article = draft.article || {};
  const sectionHeading = resolveRelatedSectionHeading(article, imageSpec);
  const parts = [
    String(imageSpec.prompt || "").trim(),
    "",
    "Additional generation requirements:",
    `- Theme: ${draft.theme || article.title || "article illustration"}`,
    article.summary ? `- Article summary: ${article.summary}` : "",
    imageSpec.purpose ? `- Narrative purpose: ${imageSpec.purpose}` : "",
    sectionHeading ? `- Related section: ${sectionHeading}` : "",
    imageSpec.scene ? `- Concrete scene: ${imageSpec.scene}` : "",
    imageSpec.key === article.bannerImageKey
      ? "- Create a clean 5:2 editorial banner background that matches the article subject and leaves comfortable visual breathing room for HTML title overlay."
      : "- Depict a concrete usage scene, working context, product touchpoint, or real-life moment that directly supports the related section instead of generic conceptual art.",
    "- Keep the image tightly aligned with the article topic and avoid symbolic filler that could fit any unrelated post.",
    "- No visible text, no title words, no letters, no numbers, no logos, no watermarks, no QR codes, no barcodes, no payment codes.",
    "- Do not depict political figures, public leaders, election materials, propaganda visuals, celebrity portraits, or real-person poster imagery.",
    "- Do not include scam-like visual cues such as fake coupons, prize claims, payment prompts, or call-to-action cards.",
    "- Avoid infographic layouts or screenshot-like text-heavy compositions unless the article explicitly requires a product UI scene."
  ].filter(Boolean);

  return parts.join("\n");
}

function resolveRelatedSectionHeading(article, imageSpec) {
  if (imageSpec.relatedSectionHeading) {
    return imageSpec.relatedSectionHeading;
  }

  const blocks = Array.isArray(article.blocks) ? article.blocks : [];
  let activeHeading = article.title || "";
  for (const block of blocks) {
    if (block.type === "heading" && block.text) {
      activeHeading = block.text;
      continue;
    }
    if (block.type === "image" && block.imageKey === imageSpec.key) {
      return activeHeading;
    }
  }

  return article.title || "";
}

function assertImageSpecSafe(imageSpec, imageIndex) {
  const fields = [
    ["prompt", imageSpec.prompt],
    ["alt", imageSpec.alt],
    ["caption", imageSpec.caption],
    ["purpose", imageSpec.purpose],
    ["scene", imageSpec.scene],
    ["relatedSectionHeading", imageSpec.relatedSectionHeading]
  ];

  for (const [field, value] of fields) {
    if (!value) {
      continue;
    }
    if (containsBlockedVisualRequest(value)) {
      throw new Error(`Unsafe visual request detected in article.images[${imageIndex}].${field}. Remove QR/political/fraud-like elements before generation.`);
    }
  }
}

function containsBlockedVisualRequest(value) {
  const text = String(value || "");
  return [
    /二维码|条形码|付款码|收款码|政治人物|领导人|政客|竞选|宣传海报|名人肖像|明星肖像/i,
    /\b(qr|qr code|barcode|payment code|political figure|public leader|celebrity portrait|campaign poster)\b/i
  ].some((pattern) => pattern.test(text));
}

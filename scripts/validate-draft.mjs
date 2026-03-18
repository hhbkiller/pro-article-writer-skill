#!/usr/bin/env node

import { normalizeDraft, parseArgs, readJson, resolveDraftPath } from "./lib.mjs";

const MIN_IMAGE_PIXELS = 3686400;
const RECOMMENDED_BANNER_SIZE = "3200x1280";
const RECOMMENDED_INLINE_SIZE = "2400x1600";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const draft = normalizeDraft(readJson(draftPath));

const errors = [];
const topic = draft.research?.userIntent?.topic || draft.theme;
const article = draft.article || {};

if (!draft.jobId) {
  errors.push("Missing jobId");
}
if (!draft.theme) {
  errors.push("Missing theme");
}
if (!topic) {
  errors.push("research.userIntent.topic is required");
}
if (!Array.isArray(draft.research?.searchQueries) || draft.research.searchQueries.length === 0) {
  errors.push("research.searchQueries must be a non-empty array");
}
if (!Array.isArray(draft.research?.sources) || draft.research.sources.length < 2) {
  errors.push("research.sources must contain at least 2 sources");
}
if (!Array.isArray(draft.research?.exemplars) || draft.research.exemplars.length < 1) {
  errors.push("research.exemplars must contain at least 1 reference article");
}
if (!Array.isArray(draft.research?.findings) || draft.research.findings.length < 1) {
  errors.push("research.findings must contain at least 1 concrete takeaway");
}

for (const [index, source] of (draft.research?.sources || []).entries()) {
  const prefix = `research.sources[${index}]`;
  if (!source.title) {
    errors.push(`${prefix}.title is required`);
  }
  if (!source.url) {
    errors.push(`${prefix}.url is required`);
  }
  if (!source.note) {
    errors.push(`${prefix}.note is required`);
  }
}

for (const [index, exemplar] of (draft.research?.exemplars || []).entries()) {
  const prefix = `research.exemplars[${index}]`;
  if (!exemplar.title) {
    errors.push(`${prefix}.title is required`);
  }
  if (!exemplar.url) {
    errors.push(`${prefix}.url is required`);
  }
  if (!exemplar.reason) {
    errors.push(`${prefix}.reason is required`);
  }
  if (!exemplar.engagementEvidence) {
    errors.push(`${prefix}.engagementEvidence is required`);
  }
}

if (!draft.plan?.angle) {
  errors.push("plan.angle is required");
}
if (!Array.isArray(draft.plan?.sections) || draft.plan.sections.length === 0) {
  errors.push("plan.sections must be a non-empty array");
}
for (const [index, section] of (draft.plan?.sections || []).entries()) {
  const prefix = `plan.sections[${index}]`;
  if (!section.heading) {
    errors.push(`${prefix}.heading is required`);
  }
  if (!section.purpose) {
    errors.push(`${prefix}.purpose is required`);
  }
}
if (!Array.isArray(draft.plan?.imagePlan) || draft.plan.imagePlan.length < 3) {
  errors.push("plan.imagePlan must contain at least 3 planned images");
}
for (const [imagePlanIndex, imagePlanItem] of (draft.plan?.imagePlan || []).entries()) {
  const prefix = `plan.imagePlan[${imagePlanIndex}]`;
  if (!imagePlanItem.key) {
    errors.push(`${prefix}.key is required`);
  }
  if (!imagePlanItem.placement) {
    errors.push(`${prefix}.placement is required`);
  }
  if (!imagePlanItem.size) {
    errors.push(`${prefix}.size is required`);
  } else if (!hasMinimumPixels(imagePlanItem.size)) {
    errors.push(`${prefix}.size must be at least ${MIN_IMAGE_PIXELS} pixels. Use ${String((imagePlanItem.placement || "").toLowerCase()) === "banner" ? RECOMMENDED_BANNER_SIZE : RECOMMENDED_INLINE_SIZE} or another larger size.`);
  }
  if (!imagePlanItem.purpose) {
    errors.push(`${prefix}.purpose is required`);
  }
}

if (!article.title) {
  errors.push("article.title is required");
}
if (!article.summary) {
  errors.push("article.summary is required");
}
if (!article.bannerImageKey) {
  errors.push("article.bannerImageKey is required");
}
if (!Array.isArray(article.blocks) || article.blocks.length === 0) {
  errors.push("article.blocks must be a non-empty array");
}
if (!Array.isArray(article.images) || article.images.length < 3) {
  errors.push("article.images must contain at least 3 images");
}

const imageKeys = new Set();
let bannerImage = null;
for (const [imageIndex, image] of (article.images || []).entries()) {
  const imagePrefix = `article.images[${imageIndex}]`;
  if (!image.key) {
    errors.push(`${imagePrefix}.key is required`);
  }
  if (!image.prompt) {
    errors.push(`${imagePrefix}.prompt is required`);
  }
  if (!image.alt) {
    errors.push(`${imagePrefix}.alt is required`);
  }
  if (!image.caption) {
    errors.push(`${imagePrefix}.caption is required`);
  }
  if (!image.size) {
    errors.push(`${imagePrefix}.size is required`);
  } else if (!hasMinimumPixels(image.size)) {
    errors.push(`${imagePrefix}.size must be at least ${MIN_IMAGE_PIXELS} pixels. Use ${image.key === article.bannerImageKey ? RECOMMENDED_BANNER_SIZE : RECOMMENDED_INLINE_SIZE} or another larger size.`);
  }
  if (!image.purpose) {
    errors.push(`${imagePrefix}.purpose is required`);
  }
  if (containsBlockedVisualRequest(image.prompt) || containsBlockedVisualRequest(image.alt) || containsBlockedVisualRequest(image.caption) || containsBlockedVisualRequest(image.purpose) || containsBlockedVisualRequest(image.scene) || containsBlockedVisualRequest(image.relatedSectionHeading)) {
    errors.push(`${imagePrefix} contains blocked visual elements such as QR codes, barcodes, political/public figures, or scam-like imagery`);
  }
  if (image.key && imageKeys.has(image.key)) {
    errors.push(`${imagePrefix}.key '${image.key}' is duplicated`);
  }
  if (image.key) {
    imageKeys.add(image.key);
  }
  if (image.key && image.key === article.bannerImageKey) {
    bannerImage = image;
  }
}

if (bannerImage) {
  if ((bannerImage.placement || "").toLowerCase() !== "banner") {
    errors.push("article.bannerImageKey must point to an image with placement 'banner'");
  }
  if (!hasAspectRatioFiveToTwo(bannerImage.size)) {
    errors.push(`banner image size must use a 5:2 ratio such as ${RECOMMENDED_BANNER_SIZE}`);
  }
} else if (article.bannerImageKey) {
  errors.push(`article.bannerImageKey references missing image '${article.bannerImageKey}'`);
}

const plannedBanner = (draft.plan?.imagePlan || []).find((image) => image.key === article.bannerImageKey);
if (!plannedBanner) {
  errors.push("plan.imagePlan must include the banner image");
} else {
  if ((plannedBanner.placement || "").toLowerCase() !== "banner") {
    errors.push("plan.imagePlan banner entry must use placement 'banner'");
  }
  if (!hasAspectRatioFiveToTwo(plannedBanner.size)) {
    errors.push(`plan.imagePlan banner size must use a 5:2 ratio such as ${RECOMMENDED_BANNER_SIZE}`);
  }
}

let inlineImageBlockCount = 0;
for (const [blockIndex, block] of (article.blocks || []).entries()) {
  const blockPrefix = `article.blocks[${blockIndex}]`;
  if (!block.type) {
    errors.push(`${blockPrefix}.type is required`);
    continue;
  }
  if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
    if (!block.text) {
      errors.push(`${blockPrefix}.text is required for ${block.type}`);
    }
  } else if (block.type === "list") {
    if (!Array.isArray(block.items) || block.items.length === 0) {
      errors.push(`${blockPrefix}.items must be a non-empty array`);
    }
  } else if (block.type === "image") {
    if (!block.imageKey) {
      errors.push(`${blockPrefix}.imageKey is required`);
    } else if (!imageKeys.has(block.imageKey)) {
      errors.push(`${blockPrefix}.imageKey references missing image '${block.imageKey}'`);
    } else if (block.imageKey !== article.bannerImageKey) {
      inlineImageBlockCount += 1;
    }
  } else {
    errors.push(`${blockPrefix}.type '${block.type}' is not supported`);
  }
}

if (inlineImageBlockCount < 2) {
  errors.push("article.blocks must contain at least 2 inline image blocks besides the banner");
}

if (!draft.approval || !draft.approval.status) {
  errors.push("approval.status is required");
}
if (!article.humanizer?.required) {
  errors.push("article.humanizer.required must be true");
}
if (article.humanizer?.preferredSkill !== "humanizer") {
  errors.push("article.humanizer.preferredSkill must be 'humanizer'");
}
if (article.humanizer?.status !== "done") {
  errors.push("article.humanizer.status must be 'done' before validation passes");
}

if (errors.length > 0) {
  console.error("DRAFT_INVALID");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("DRAFT_VALID");

function hasAspectRatioFiveToTwo(size) {
  const parsed = parseSize(size);
  if (!parsed) {
    return false;
  }
  return parsed.width * 2 === parsed.height * 5;
}

function hasMinimumPixels(size) {
  const parsed = parseSize(size);
  if (!parsed) {
    return false;
  }
  return (parsed.width * parsed.height) >= MIN_IMAGE_PIXELS;
}

function parseSize(size) {
  if (!size || typeof size !== "string") {
    return null;
  }
  const match = size.trim().match(/^(\d+)\s*[xX]\s*(\d+)$/);
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

function containsBlockedVisualRequest(value) {
  if (!value) {
    return false;
  }
  return [
    /二维码|条形码|付款码|收款码|政治人物|领导人|政客|竞选|宣传海报|名人肖像|明星肖像/i,
    /\b(qr|qr code|barcode|payment code|political figure|public leader|celebrity portrait|campaign poster)\b/i
  ].some((pattern) => pattern.test(String(value)));
}

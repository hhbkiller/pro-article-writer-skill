#!/usr/bin/env node

import { normalizeDraft, parseArgs, readJson, resolveDraftPath } from "./lib.mjs";

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
if (!Array.isArray(draft.plan?.imagePlan) || draft.plan.imagePlan.length < 2) {
  errors.push("plan.imagePlan must contain at least 2 planned images");
}

if (!article.title) {
  errors.push("article.title is required");
}
if (!article.summary) {
  errors.push("article.summary is required");
}
if (!Array.isArray(article.blocks) || article.blocks.length === 0) {
  errors.push("article.blocks must be a non-empty array");
}
if (!Array.isArray(article.images) || article.images.length < 2) {
  errors.push("article.images must contain at least 2 images");
}

const imageKeys = new Set();
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
  if (image.key && imageKeys.has(image.key)) {
    errors.push(`${imagePrefix}.key '${image.key}' is duplicated`);
  }
  if (image.key) {
    imageKeys.add(image.key);
  }
}

let imageBlockCount = 0;
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
    imageBlockCount += 1;
    if (!block.imageKey) {
      errors.push(`${blockPrefix}.imageKey is required`);
    } else if (!imageKeys.has(block.imageKey)) {
      errors.push(`${blockPrefix}.imageKey references missing image '${block.imageKey}'`);
    }
  } else {
    errors.push(`${blockPrefix}.type '${block.type}' is not supported`);
  }
}

if (imageBlockCount < 2) {
  errors.push("article.blocks must contain at least 2 image blocks");
}

if (!draft.approval || !draft.approval.status) {
  errors.push("approval.status is required");
}
if (!article.humanizer?.required) {
  errors.push("article.humanizer.required must be true");
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

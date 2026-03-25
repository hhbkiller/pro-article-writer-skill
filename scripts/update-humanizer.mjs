#!/usr/bin/env node

import { normalizeDraft, parseArgs, readJson, resolveDraftPath, writeJson } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const draftPath = resolveDraftPath(args.draft);
const status = args.status;

if (!status || !["pending", "done"].includes(status)) {
  throw new Error("Use --status pending|done");
}

const draft = normalizeDraft(readJson(draftPath));
const notes = args.note
  ? [...(draft.article?.humanizer?.notes || []), args.note]
  : [...(draft.article?.humanizer?.notes || [])];

draft.article.humanizer = {
  ...(draft.article?.humanizer || {}),
  required: true,
  preferredSkill: args["preferred-skill"] || draft.article?.humanizer?.preferredSkill || "humanizer",
  source: args.source || draft.article?.humanizer?.source || "bundled-humanizer",
  status,
  appliedAt: status === "done" ? new Date().toISOString() : null,
  notes
};

if (status === "done" && draft.status === "research") {
  draft.status = "draft";
}

writeJson(draftPath, draft);
console.log(JSON.stringify(draft.article.humanizer, null, 2));

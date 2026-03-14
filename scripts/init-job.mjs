#!/usr/bin/env node

import path from "node:path";
import { ensureDir, nowStamp, parseArgs, slugify, writeJson, writeText } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || "./jobs");
const theme = args.theme || "untitled-article";
const direction = args.direction || "";
const brief = args.brief || "";

const jobId = `${nowStamp()}-${slugify(theme)}`;
const jobDir = path.join(root, jobId);
const imagesDir = path.join(jobDir, "images");
const draftPath = path.join(jobDir, "draft.json");
const reviewPath = path.join(jobDir, "review.single.html");
const artifactManifestPath = path.join(jobDir, "artifacts.json");

ensureDir(imagesDir);

const draft = {
  jobId,
  theme,
  direction,
  brief,
  createdAt: new Date().toISOString(),
  status: "research",
  approval: {
    status: "pending",
    approvedBy: null,
    approvedAt: null,
    note: null
  },
  research: {
    userIntent: {
      topic: theme,
      direction,
      brief
    },
    searchQueries: [],
    sources: [],
    findings: []
  },
  plan: {
    angle: "",
    audience: "",
    promise: "",
    sections: [],
    imagePlan: []
  },
  article: {
    title: "",
    subtitle: "",
    summary: "",
    blocks: [],
    images: [],
    humanizer: {
      required: true,
      source: "bundled-humanizer",
      status: "pending",
      appliedAt: null,
      notes: []
    }
  },
  notes: []
};

writeJson(draftPath, draft);
writeText(reviewPath, "<!doctype html><title>Pending review</title><body><p>Pending review</p></body>\n");
writeJson(artifactManifestPath, {
  schemaVersion: 1,
  jobId,
  theme,
  generatedAt: null,
  delivery: {
    owner: "runtime",
    mode: "current_request_only"
  },
  artifacts: []
});

console.log(JSON.stringify({
  jobId,
  jobDir,
  draftPath,
  reviewPath,
  artifactManifestPath,
  imagesDir
}, null, 2));

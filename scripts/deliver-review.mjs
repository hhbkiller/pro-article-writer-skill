#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { inferAgentId, nowStamp, parseArgs, readJson, resolveStateDir } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const filePath = path.resolve(args.file || args.media || args.path || "");

if (!filePath || !fs.existsSync(filePath)) {
  throw new Error("Use --file <artifact path>. File must exist.");
}

const caption = args.caption || args.message || "审核状态：pending approval";
const stagedFilePath = stageMediaFile(filePath, args["state-dir"]);
const candidates = resolveDeliveryCandidates(args)
  .map((candidate) => ({
    ...candidate,
    target: normalizeTarget(candidate.target, candidate.channel)
  }))
  .filter((candidate) => candidate.channel && candidate.target);

if (candidates.length === 0) {
  throw new Error("Could not resolve delivery target. Provide --channel and --target explicitly.");
}

let delivered = null;
let lastFailure = null;

for (const candidate of candidates) {
  const result = sendMessage({
    channel: candidate.channel,
    target: candidate.target,
    account: candidate.accountId,
    stagedFilePath,
    caption,
    args,
    threadId: candidate.threadId
  });

  if (result.status === 0) {
    delivered = {
      channel: candidate.channel,
      target: candidate.target,
      accountId: candidate.accountId || null,
      stdout: (result.stdout || "").trim()
    };
    break;
  }

  const detail = (result.stderr || result.stdout || result.error?.message || "").trim();
  lastFailure = {
    channel: candidate.channel,
    target: candidate.target,
    accountId: candidate.accountId || null,
    detail
  };

  if (!isRetryableContextError(detail)) {
    throw new Error(`openclaw message send failed: ${detail || "unknown error"}`);
  }
}

if (!delivered) {
  const detail = lastFailure?.detail || "unknown error";
  throw new Error(`openclaw message send failed after trying ${candidates.length} target(s): ${detail}`);
}

const stdout = delivered.stdout;
let parsed;
try {
  parsed = stdout ? JSON.parse(stdout) : null;
} catch {
  parsed = null;
}

console.log(JSON.stringify({
  delivered: true,
  channel: delivered.channel,
  target: delivered.target,
  accountId: delivered.accountId,
  filePath,
  stagedFilePath,
  caption,
  result: parsed || stdout || null
}, null, 2));

function resolveDeliveryCandidates(cliArgs) {
  const explicit = resolveExplicitDelivery(cliArgs);
  if (explicit) {
    return [explicit];
  }

  return resolveSessionCandidates(cliArgs);
}

function resolveExplicitDelivery(cliArgs) {
  const channel = cliArgs.channel || process.env.OPENCLAW_DELIVERY_CHANNEL || null;
  const target = cliArgs.target || process.env.OPENCLAW_DELIVERY_TARGET || null;
  const accountId = cliArgs.account || process.env.OPENCLAW_DELIVERY_ACCOUNT || null;

  if (!channel && !target) {
    return null;
  }

  return {
    channel,
    target,
    accountId
  };
}

function resolveRequestedSession(cliArgs) {
  const sessionKey = cliArgs["session-key"] || process.env.OPENCLAW_SESSION_KEY || process.env.OPENCLAW_DELIVERY_SESSION_KEY || null;
  const sessionId = cliArgs["session-id"] || process.env.OPENCLAW_SESSION_ID || process.env.OPENCLAW_DELIVERY_SESSION_ID || null;
  const stateDir = resolveStateDir(cliArgs["state-dir"]);
  const entries = loadSessionEntries(stateDir, cliArgs);

  const selected = selectSessions(entries, {
    "session-key": sessionKey,
    "session-id": sessionId
  });
  return dedupeCandidates(selected.map((entry) => {
    const context = entry.deliveryContext || {};
    return [{
      channel: context.channel || entry.lastChannel || null,
      target: context.to || entry.lastTo || null,
      accountId: context.accountId || entry.lastAccountId || null,
      threadId: context.threadId || entry.lastThreadId || null
    }];
  }).flat());
}

function resolveLatestSession(cliArgs) {
  const stateDir = resolveStateDir(cliArgs["state-dir"]);
  const entries = loadSessionEntries(stateDir, cliArgs).sort(compareSessionEntries);

  if (entries.length === 0) {
    return [];
  }

  const latest = entries[0];
  const context = latest.deliveryContext || {};
  return dedupeCandidates([{
    channel: context.channel || latest.lastChannel || null,
    target: context.to || latest.lastTo || null,
    accountId: context.accountId || latest.lastAccountId || null,
    threadId: context.threadId || latest.lastThreadId || null
  }]);
}

function resolveSessionCandidates(cliArgs) {
  const hasRequestedSession = Boolean(
    cliArgs["session-key"] ||
    cliArgs["session-id"] ||
    process.env.OPENCLAW_SESSION_KEY ||
    process.env.OPENCLAW_SESSION_ID ||
    process.env.OPENCLAW_DELIVERY_SESSION_KEY ||
    process.env.OPENCLAW_DELIVERY_SESSION_ID
  );

  if (hasRequestedSession) {
    const requested = resolveRequestedSession(cliArgs);
    if (requested.length > 0) {
      return requested;
    }
  }

  return resolveLatestSession(cliArgs);
}

function loadSessionEntries(stateDir, cliArgs) {
  const entries = [];
  for (const agentId of resolveAgentIds(stateDir, cliArgs)) {
    const sessionsPath = path.join(stateDir, "agents", agentId, "sessions", "sessions.json");
    if (!fs.existsSync(sessionsPath)) {
      continue;
    }

    const store = readJson(sessionsPath);
    const agentEntries = Object.entries(store)
      .filter(([, value]) => value && typeof value === "object" && value.deliveryContext)
      .map(([key, value]) => ({ key, agentId, ...value }));
    entries.push(...agentEntries);
  }
  return entries;
}

function resolveAgentIds(stateDir, cliArgs) {
  const explicitAgentId = cliArgs.agent || process.env.OPENCLAW_AGENT_ID || process.env.OPENCLAW_DELIVERY_AGENT || null;
  if (explicitAgentId) {
    return [explicitAgentId];
  }

  const inferredAgentId = inferAgentId({ fallback: "" });
  if (inferredAgentId) {
    return [inferredAgentId];
  }

  const agentsDir = path.join(stateDir, "agents");
  if (!fs.existsSync(agentsDir)) {
    return ["main"];
  }

  return fs.readdirSync(agentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function selectSessions(entries, cliArgs) {
  if (entries.length === 0) {
    return [];
  }

  if (cliArgs["session-key"]) {
    const hit = entries.find((entry) => entry.key === cliArgs["session-key"]);
    if (hit) {
      return [hit];
    }
  }
  if (cliArgs["session-id"]) {
    const hit = entries.find((entry) => entry.sessionId === cliArgs["session-id"]);
    if (hit) {
      return [hit];
    }
  }

  return [];
}

function compareSessionEntries(left, right) {
  const leftUpdated = Number.isFinite(left.updatedAt) ? left.updatedAt : 0;
  const rightUpdated = Number.isFinite(right.updatedAt) ? right.updatedAt : 0;
  if (leftUpdated !== rightUpdated) {
    return rightUpdated - leftUpdated;
  }

  const leftSession = String(left.sessionId || left.key || "");
  const rightSession = String(right.sessionId || right.key || "");
  return rightSession.localeCompare(leftSession);
}

function normalizeTarget(target, channel) {
  if (!target) {
    return target;
  }
  const prefix = `${channel}:`;
  if (target.startsWith(prefix)) {
    return target.slice(prefix.length);
  }
  return target;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const output = [];
  for (const candidate of candidates) {
    const key = [candidate.channel || "", candidate.target || "", candidate.accountId || ""].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function sendMessage({ channel, target, account, stagedFilePath, caption, args, threadId: candidateThreadId }) {
  const commandArgs = [
    "message",
    "send",
    "--channel", channel,
    "--target", target,
    "--media", stagedFilePath
  ];

  if (caption) {
    commandArgs.push("--message", caption);
  }
  if (account) {
    commandArgs.push("--account", account);
  }
  const replyTo = args["reply-to"] || process.env.OPENCLAW_DELIVERY_REPLY_TO || null;
  const threadId = args["thread-id"] || process.env.OPENCLAW_DELIVERY_THREAD_ID || candidateThreadId || null;
  if (replyTo) {
    commandArgs.push("--reply-to", replyTo);
  }
  if (threadId) {
    commandArgs.push("--thread-id", threadId);
  }
  if (args["dry-run"]) {
    commandArgs.push("--dry-run");
  }
  if (args.json) {
    commandArgs.push("--json");
  }

  return spawnSync("openclaw", commandArgs, {
    encoding: "utf8",
    cwd: process.cwd()
  });
}

function isRetryableContextError(detail) {
  const text = String(detail || "").toLowerCase();
  return (
    text.includes("group chat was deleted") ||
    text.includes("chat not found") ||
    text.includes("bot was kicked") ||
    text.includes("have no rights to send") ||
    text.includes("forbidden: bot was blocked")
  );
}

function stageMediaFile(originalPath, customStateDir) {
  const stateDir = resolveStateDir(customStateDir);
  const outboxDir = path.join(stateDir, "media", "review-outbox");
  fs.mkdirSync(outboxDir, { recursive: true });

  const ext = path.extname(originalPath) || ".html";
  const base = path.basename(originalPath, ext).replace(/[^a-zA-Z0-9._-]+/g, "-") || "review";
  const stagedPath = path.join(outboxDir, `${nowStamp()}-${base}${ext}`);

  fs.copyFileSync(originalPath, stagedPath);
  return stagedPath;
}

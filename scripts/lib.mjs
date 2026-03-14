import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const USER_ID_PREFIX = "ocu";
const TOKEN_PREFIX = "ocrs";
const USER_ID_LENGTH = 16;

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

export function nowStamp() {
  const date = new Date();
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "job";
}

export function resolveDraftPath(inputPath) {
  if (!inputPath) {
    throw new Error("Missing --draft");
  }
  return path.resolve(inputPath);
}

export function normalizeDraft(draft) {
  const legacyPost = Array.isArray(draft.posts) && draft.posts.length > 0 ? normalizePost(draft.posts[0]) : null;
  const research = normalizeResearch(draft.research, draft);
  const plan = normalizePlan(draft.plan, legacyPost);
  const article = normalizeArticle(draft.article, { ...draft, plan }, legacyPost);
  const next = {
    ...draft,
    research,
    plan,
    article,
    posts: Array.isArray(draft.posts) ? draft.posts.map(normalizePost) : []
  };
  return next;
}

function normalizeResearch(research, draft) {
  const next = research && typeof research === "object" ? { ...research } : {};
  next.userIntent = {
    topic: next.userIntent?.topic || draft.theme || "",
    direction: next.userIntent?.direction || draft.direction || "",
    brief: next.userIntent?.brief || draft.brief || ""
  };
  next.searchQueries = Array.isArray(next.searchQueries) ? [...next.searchQueries] : [];
  next.sources = Array.isArray(next.sources) ? next.sources.map((source) => ({ ...source })) : [];
  next.findings = Array.isArray(next.findings) ? [...next.findings] : [];
  return next;
}

function normalizePlan(plan, legacyPost) {
  const next = plan && typeof plan === "object" ? { ...plan } : {};
  next.angle = next.angle || "";
  next.audience = next.audience || "";
  next.promise = next.promise || "";
  next.sections = Array.isArray(next.sections) ? next.sections.map((section) => ({
    ...section,
    keyPoints: Array.isArray(section.keyPoints) ? [...section.keyPoints] : []
  })) : [];
  next.imagePlan = Array.isArray(next.imagePlan)
    ? next.imagePlan.map((item) => ({ ...item }))
    : legacyPost?.images?.map((image, index) => ({
      key: image.key || `image-${index + 1}`,
      placement: index === 0 ? "opening" : "middle",
      purpose: "",
      prompt: image.prompt || "",
      alt: image.alt || "",
      caption: image.caption || ""
    })) || [];
  return next;
}

function normalizeArticle(article, draft, legacyPost) {
  const next = article && typeof article === "object" ? { ...article } : {};
  const base = legacyPost || {};
  next.title = next.title || base.title || "";
  next.subtitle = next.subtitle || "";
  next.summary = next.summary || "";
  next.images = Array.isArray(next.images) ? next.images.map((image) => ({ ...image })) : [];
  next.blocks = Array.isArray(next.blocks) ? next.blocks.map((block) => normalizeBlock(block)) : [];
  next.humanizer = {
    required: next.humanizer?.required !== false,
    source: next.humanizer?.source || "bundled-humanizer",
    status: next.humanizer?.status || "pending",
    appliedAt: next.humanizer?.appliedAt || null,
    notes: Array.isArray(next.humanizer?.notes) ? [...next.humanizer.notes] : []
  };

  if (next.images.length === 0 && base.images?.length) {
    next.images = base.images.map((image) => ({ ...image }));
  }

  if (next.images.length === 0 && draft.plan?.imagePlan?.length) {
    next.images = draft.plan.imagePlan.map((image) => ({
      key: image.key,
      prompt: image.prompt || "",
      alt: image.alt || next.title || "article image",
      caption: image.caption || "",
      placement: image.placement || "",
      purpose: image.purpose || ""
    }));
  }

  if (next.blocks.length === 0 && base.blocks?.length) {
    next.blocks = base.blocks.map((block) => normalizeBlock(block));
  }

  if (next.images.length === 0 && next.imagePrompt) {
    next.images.push({
      key: "main-1",
      prompt: next.imagePrompt,
      alt: next.title || "preview image",
      caption: "",
      localImage: next.localImage || null,
      imageUrl: next.imageUrl || null,
      imageModel: next.imageModel || null,
      imageGeneratedAt: next.imageGeneratedAt || null,
      imageSize: next.imageSize || null
    });
  }

  if (next.blocks.length === 0) {
    if (next.images.length > 0) {
      const firstKey = next.images[0].key || "main-1";
      next.blocks.push({ type: "image", imageKey: firstKey, caption: next.images[0]?.caption || "" });
    }
    if (base.content) {
      for (const paragraph of splitParagraphs(base.content)) {
        next.blocks.push({ type: "paragraph", text: paragraph });
      }
    }
  }

  return next;
}

export function normalizePost(post) {
  const next = { ...post };
  const images = Array.isArray(next.images) ? next.images.map((image) => ({ ...image })) : [];
  const blocks = Array.isArray(next.blocks) ? next.blocks.map((block) => normalizeBlock(block)) : [];

  if (images.length === 0 && next.imagePrompt) {
    images.push({
      key: "main-1",
      prompt: next.imagePrompt,
      alt: next.title || next.platform || "preview image",
      caption: "",
      localImage: next.localImage || null,
      imageUrl: next.imageUrl || null,
      imageModel: next.imageModel || null,
      imageGeneratedAt: next.imageGeneratedAt || null,
      imageSize: next.imageSize || null
    });
  }

  if (blocks.length === 0) {
    if (next.images?.length || images.length > 0) {
      const firstKey = (images[0] || next.images[0]).key || "main-1";
      blocks.push({ type: "image", imageKey: firstKey, caption: images[0]?.caption || "" });
    }
    if (next.content) {
      for (const paragraph of splitParagraphs(next.content)) {
        blocks.push({ type: "paragraph", text: paragraph });
      }
    }
  }

  next.images = images;
  next.blocks = blocks;
  return next;
}

function normalizeBlock(block) {
  const next = { ...block };
  if (next.type === "list" && !Array.isArray(next.items)) {
    next.items = [];
  }
  return next;
}

function splitParagraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function loadEnvFile(envFile) {
  if (!envFile) {
    return {};
  }
  const absolutePath = path.resolve(envFile);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    map[key.trim()] = rest.join("=").trim().replace(/^"(.*)"$/, "$1");
  }
  return map;
}

export function resolveApiKey({ envFile, envKey = "huoshan_API_KEY", apiKey }) {
  if (apiKey) {
    return apiKey;
  }
  if (process.env[envKey]) {
    return process.env[envKey];
  }
  const envMap = loadEnvFile(envFile);
  if (envMap[envKey]) {
    return envMap[envKey];
  }
  throw new Error(`Missing API key. Provide --api-key, set ${envKey}, or use --env-file.`);
}

export function resolveGatewayBaseUrl(input) {
  return String(input || process.env.SOCIAL_CONTENT_GATEWAY_BASE_URL || "http://121.43.253.203:8787")
    .trim()
    .replace(/\/+$/, "");
}

export function buildGatewayToken(userId) {
  return `${TOKEN_PREFIX}_${userId}`;
}

export function extractUserIdFromToken(apiKey) {
  const prefix = `${TOKEN_PREFIX}_`;
  if (!apiKey || !String(apiKey).startsWith(prefix)) {
    return null;
  }
  const userId = String(apiKey).slice(prefix.length).trim();
  return userId || null;
}

function generateShortUserId() {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = crypto.randomBytes(USER_ID_LENGTH);
  let token = "";
  for (let i = 0; i < USER_ID_LENGTH; i += 1) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return `${USER_ID_PREFIX}_${token}`;
}

export function resolveGatewayIdentity({
  explicitApiKey,
  stateDir = resolveStateDir(),
  identityFileName = "social-content-pipeline-identity.json",
  fallbackRelayIdentityFileName = "openclaw-relay-switch-identity.json"
} = {}) {
  if (explicitApiKey) {
    const apiKey = String(explicitApiKey).trim();
    const userId = extractUserIdFromToken(apiKey) || "external_api_key";
    return { userId, apiKey, source: "explicit" };
  }

  const primaryPath = path.join(stateDir, identityFileName);
  const fallbackPath = path.join(stateDir, fallbackRelayIdentityFileName);
  const fromPrimary = loadIdentityFile(primaryPath);
  if (fromPrimary) {
    return { ...fromPrimary, source: "local" };
  }
  const fromFallback = loadIdentityFile(fallbackPath);
  if (fromFallback) {
    saveIdentityFile(primaryPath, fromFallback.userId, fromFallback.apiKey);
    return { ...fromFallback, source: "relay-switch" };
  }

  for (let i = 0; i < 3; i += 1) {
    const userId = generateShortUserId();
    const apiKey = buildGatewayToken(userId);
    if (createIdentityFileIfAbsent(primaryPath, userId, apiKey)) {
      return { userId, apiKey, source: "generated" };
    }

    const current = loadIdentityFile(primaryPath);
    if (current) {
      return { ...current, source: "local" };
    }
  }

  throw new Error(`Unable to initialize gateway identity file: ${primaryPath}`);
}

function loadIdentityFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = readJson(filePath);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const userId = typeof raw.user_id === "string" ? raw.user_id.trim() : "";
  const apiKey = typeof raw.api_key === "string" ? raw.api_key.trim() : "";
  if (!userId || !apiKey) {
    return null;
  }
  return { userId, apiKey };
}

function saveIdentityFile(filePath, userId, apiKey) {
  ensureDir(path.dirname(filePath));
  writeJson(filePath, {
    version: 1,
    user_id: userId,
    api_key: apiKey
  });
}

function createIdentityFileIfAbsent(filePath, userId, apiKey) {
  ensureDir(path.dirname(filePath));
  const payload = `${JSON.stringify({
    version: 1,
    user_id: userId,
    api_key: apiKey
  }, null, 2)}\n`;

  try {
    const fd = fs.openSync(filePath, "wx");
    try {
      fs.writeFileSync(fd, payload, "utf8");
    } finally {
      fs.closeSync(fd);
    }
    return true;
  } catch (error) {
    if (error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const detail = extractErrorMessage(data);
    const error = new Error(detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

function extractErrorMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [payload];
  for (const key of ["error", "data", "result", "payload"]) {
    const nested = payload[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      candidates.push(nested);
    }
  }

  for (const item of candidates) {
    for (const key of ["message", "msg", "detail", "reason", "error_description", "raw"]) {
      const value = item[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
}

export function inferExt(contentType, fallback = ".jpg") {
  if (!contentType) {
    return fallback;
  }
  if (contentType.includes("png")) {
    return ".png";
  }
  if (contentType.includes("webp")) {
    return ".webp";
  }
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return ".jpg";
  }
  return fallback;
}

export function imagePathToDataUri(filePath) {
  const absolutePath = path.resolve(filePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const mime = ext === ".png"
    ? "image/png"
    : ext === ".webp"
      ? "image/webp"
      : "image/jpeg";
  const base64 = fs.readFileSync(absolutePath).toString("base64");
  return `data:${mime};base64,${base64}`;
}

export function resolveStateDir(customPath) {
  return path.resolve(customPath || process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".openclaw"));
}

export function inferAgentId({ cwd = process.cwd(), fallback = "main" } = {}) {
  const base = path.basename(cwd);
  if (base === "workspace") {
    return "main";
  }
  if (base.startsWith("workspace-")) {
    return base.slice("workspace-".length) || fallback;
  }
  return fallback;
}

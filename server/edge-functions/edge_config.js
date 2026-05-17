export const EDGE_CONFIG = {
  OSS_BUCKET: globalThis.OSS_BUCKET || "learnapp-user-data",
  OSS_REGION: globalThis.OSS_REGION || "oss-cn-hangzhou",
  OSS_ENDPOINT: globalThis.OSS_ENDPOINT || "",
  OSS_ACCESS_KEY_ID: globalThis.OSS_ACCESS_KEY_ID || "",
  OSS_ACCESS_KEY_SECRET: globalThis.OSS_ACCESS_KEY_SECRET || "",
  MODEL_API_ENABLED: String(globalThis.MODEL_API_ENABLED || "false") === "true",
  MODEL_API_URL: globalThis.MODEL_API_URL || "https://api.openai.com/v1/chat/completions",
  MODEL_NAME: globalThis.MODEL_NAME || "gpt-4o-mini",
  MODEL_API_KEY: globalThis.MODEL_API_KEY || "",
  LOG_LEVEL: globalThis.LOG_LEVEL || "info",
  CORS_ALLOWED_ORIGINS: (globalThis.CORS_ALLOWED_ORIGINS || "*").split(",").map((item) => item.trim())
};

console.log("[learnapp:init] Edge Function environment", {
  OSS_BUCKET: EDGE_CONFIG.OSS_BUCKET,
  OSS_REGION: EDGE_CONFIG.OSS_REGION,
  OSS_ACCESS_KEY_ID_EXISTS: Boolean(EDGE_CONFIG.OSS_ACCESS_KEY_ID),
  OSS_ACCESS_KEY_SECRET_EXISTS: Boolean(EDGE_CONFIG.OSS_ACCESS_KEY_SECRET),
  MODEL_API_KEY_EXISTS: Boolean(EDGE_CONFIG.MODEL_API_KEY)
});

const inMemoryStore = globalThis.__LEARN_APP_STORE__ || new Map();
globalThis.__LEARN_APP_STORE__ = inMemoryStore;

export function jsonResponse(data, status = 200, request) {
  const ok = status >= 200 && status < 400;
  const payload = ok
    ? { status: "success", info: data?.info || "OK", ...data }
    : { status: "error", message: data?.message || data?.error || "服务器错误", ...data };
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}

export function corsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "*";
  const allowed = EDGE_CONFIG.CORS_ALLOWED_ORIGINS.includes("*") || EDGE_CONFIG.CORS_ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : EDGE_CONFIG.CORS_ALLOWED_ORIGINS[0] || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  };
}

export function handleOptions(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw httpError(400, "请求体必须是合法 JSON");
  }
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function sanitizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw httpError(400, "邮箱格式不合法");
  return normalized;
}

export function createToken(email) {
  return btoa(`${email}:${Date.now()}:${cryptoRandom()}`);
}

export function getEmailFromAuth(request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) throw httpError(401, "缺少登录 token");
  try {
    return atob(token).split(":")[0];
  } catch {
    throw httpError(401, "登录 token 无效");
  }
}

export function emptyUser(email) {
  return {
    email,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: { answered: 0, correct: 0, byQuestion: {} },
    wrongAnswers: [],
    examHistory: [],
    analysisCache: {}
  };
}

export async function getUser(email) {
  const key = userKey(email);
  const remote = await readUserJson(key);
  if (remote?.email) {
    inMemoryStore.set(key, remote);
    return structuredClone(remote);
  }
  if (!inMemoryStore.has(key)) inMemoryStore.set(key, emptyUser(email));
  return structuredClone(inMemoryStore.get(key));
}

export async function saveUser(user) {
  user.updatedAt = new Date().toISOString();
  const key = userKey(user.email);
  inMemoryStore.set(key, structuredClone(user));
  await writeUserJson(key, user);
  return user;
}

export function userKey(email) {
  return `users/${encodeURIComponent(email)}.json`;
}

export function errorResponse(err, request) {
  console.error("[learnapp:error]", {
    message: err.message || "服务器错误",
    stack: err.stack,
    status: err.status || 500
  });
  return jsonResponse({ message: err.message || "服务器错误", error: err.message || "服务器错误" }, err.status || 500, request);
}

export function logInfo(message, details = {}) {
  console.log(`[learnapp] ${message}`, details);
}

export function logError(message, err, details = {}) {
  console.error(`[learnapp] ${message}`, {
    ...details,
    message: err?.message || String(err),
    stack: err?.stack
  });
}

function cryptoRandom() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readUserJson(key) {
  if (globalThis.OSS?.get) {
    const value = await globalThis.OSS.get(key);
    if (!value) return null;
    return typeof value.json === "function" ? value.json() : JSON.parse(String(value));
  }

  if (!EDGE_CONFIG.OSS_ENDPOINT) return null;
  const response = await fetch(`${EDGE_CONFIG.OSS_ENDPOINT.replace(/\/$/, "")}/${key}`, {
    method: "GET",
    headers: ossHeaders()
  });
  if (response.status === 404) return null;
  if (!response.ok) throw httpError(502, `OSS 读取失败：${response.status}`);
  return response.json();
}

async function writeUserJson(key, user) {
  const body = JSON.stringify(user);
  if (globalThis.OSS?.put) {
    await globalThis.OSS.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    logInfo("OSS user JSON write success", { key, size: body.length, provider: "binding" });
    return;
  }

  if (!EDGE_CONFIG.OSS_ENDPOINT) return;
  const response = await fetch(`${EDGE_CONFIG.OSS_ENDPOINT.replace(/\/$/, "")}/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...ossHeaders()
    },
    body
  });
  if (!response.ok) throw httpError(502, `OSS 写入失败：${response.status}`);
  logInfo("OSS user JSON write success", { key, size: body.length, provider: "http" });
}

function ossHeaders() {
  const headers = {};
  if (EDGE_CONFIG.OSS_ACCESS_KEY_ID) headers["x-oss-access-key-id"] = EDGE_CONFIG.OSS_ACCESS_KEY_ID;
  if (EDGE_CONFIG.OSS_ACCESS_KEY_SECRET) headers["x-oss-access-key-secret"] = EDGE_CONFIG.OSS_ACCESS_KEY_SECRET;
  return headers;
}

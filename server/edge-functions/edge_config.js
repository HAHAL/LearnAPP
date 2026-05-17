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
const requestLogs = globalThis.__LEARN_APP_REQUEST_LOGS__ || new WeakMap();
globalThis.__LEARN_APP_REQUEST_LOGS__ = requestLogs;

export function jsonResponse(data, status = 200, request) {
  const ok = status >= 200 && status < 400;
  const message = data?.message || data?.info || (ok ? "OK" : "服务器错误");
  const logs = request ? getRequestLogs(request) : [];
  const payload = ok
    ? { status: "success", message, info: data?.info || message, data: data?.data ?? data, logs, ...data }
    : { status: "error", message, data: data?.data ?? null, logs, ...data };
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

export function beginRequestLog(request, functionName) {
  const logs = [];
  requestLogs.set(request, logs);
  globalThis.__LEARN_APP_CURRENT_REQUEST__ = request;
  logInfo("function triggered", {
    functionName,
    triggeredAt: new Date().toISOString(),
    method: request.method,
    url: request.url,
    env: getEnvironmentStatus()
  }, request);
  return logs;
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
  logError("request failed", err, { status: err.status || 500 }, request);
  return jsonResponse({ message: err.message || "服务器错误", error: err.message || "服务器错误" }, err.status || 500, request);
}

export function logInfo(message, details = {}, request) {
  const entry = {
    level: "info",
    message,
    details,
    timestamp: new Date().toISOString()
  };
  console.log(`[learnapp] ${message}`, details);
  pushRequestLog(request, entry);
  return entry;
}

export function logError(message, err, details = {}, request) {
  const entry = {
    level: "error",
    message,
    details: {
      ...details,
      message: err?.message || String(err)
    },
    timestamp: new Date().toISOString()
  };
  console.error(`[learnapp] ${message}`, {
    ...details,
    message: err.message || "服务器错误",
    stack: err.stack,
    status: err.status || 500
  });
  pushRequestLog(request, entry);
  return entry;
}

export function getEnvironmentStatus() {
  return {
    OSS_BUCKET: EDGE_CONFIG.OSS_BUCKET,
    OSS_REGION: EDGE_CONFIG.OSS_REGION,
    OSS_ACCESS_KEY_ID_EXISTS: Boolean(EDGE_CONFIG.OSS_ACCESS_KEY_ID),
    OSS_ACCESS_KEY_SECRET_EXISTS: Boolean(EDGE_CONFIG.OSS_ACCESS_KEY_SECRET),
    MODEL_API_KEY_EXISTS: Boolean(EDGE_CONFIG.MODEL_API_KEY)
  };
}

function getRequestLogs(request) {
  return requestLogs.get(request) || [];
}

function pushRequestLog(request, entry) {
  if (!request) return;
  const logs = requestLogs.get(request);
  if (logs) logs.push(entry);
}

function cryptoRandom() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readUserJson(key) {
  logInfo("OSS GET start", { key, bucket: EDGE_CONFIG.OSS_BUCKET, provider: globalThis.OSS?.get ? "binding" : "http" }, currentRequest());
  if (globalThis.OSS?.get) {
    try {
      const value = await globalThis.OSS.get(key);
      logInfo("OSS GET success", { key, bucket: EDGE_CONFIG.OSS_BUCKET, found: Boolean(value), provider: "binding" }, currentRequest());
      if (!value) return null;
      return typeof value.json === "function" ? value.json() : JSON.parse(String(value));
    } catch (err) {
      logError("OSS GET failed", err, { key, bucket: EDGE_CONFIG.OSS_BUCKET, provider: "binding" }, currentRequest());
      throw err;
    }
  }

  if (!EDGE_CONFIG.OSS_ENDPOINT) {
    logInfo("OSS GET skipped", { key, bucket: EDGE_CONFIG.OSS_BUCKET, reason: "OSS_ENDPOINT not configured" }, currentRequest());
    return null;
  }
  try {
    const response = await fetch(`${EDGE_CONFIG.OSS_ENDPOINT.replace(/\/$/, "")}/${key}`, {
      method: "GET",
      headers: ossHeaders()
    });
    if (response.status === 404) {
      logInfo("OSS GET success", { key, bucket: EDGE_CONFIG.OSS_BUCKET, found: false, provider: "http" }, currentRequest());
      return null;
    }
    if (!response.ok) throw httpError(502, `OSS 读取失败：${response.status}`);
    logInfo("OSS GET success", { key, bucket: EDGE_CONFIG.OSS_BUCKET, found: true, provider: "http" }, currentRequest());
    return response.json();
  } catch (err) {
    logError("OSS GET failed", err, { key, bucket: EDGE_CONFIG.OSS_BUCKET, provider: "http" }, currentRequest());
    throw err;
  }
}

async function writeUserJson(key, user) {
  const body = JSON.stringify(user);
  logInfo("OSS PUT start", { key, bucket: EDGE_CONFIG.OSS_BUCKET, size: body.length, provider: globalThis.OSS?.put ? "binding" : "http" }, currentRequest());
  if (globalThis.OSS?.put) {
    try {
      await globalThis.OSS.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
      logInfo("OSS PUT success", { key, bucket: EDGE_CONFIG.OSS_BUCKET, size: body.length, provider: "binding" }, currentRequest());
    } catch (err) {
      logError("OSS PUT failed", err, { key, bucket: EDGE_CONFIG.OSS_BUCKET, size: body.length, provider: "binding" }, currentRequest());
      throw err;
    }
    return;
  }

  if (!EDGE_CONFIG.OSS_ENDPOINT) {
    logInfo("OSS PUT skipped", { key, bucket: EDGE_CONFIG.OSS_BUCKET, reason: "OSS_ENDPOINT not configured" }, currentRequest());
    return;
  }
  try {
    const response = await fetch(`${EDGE_CONFIG.OSS_ENDPOINT.replace(/\/$/, "")}/${key}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...ossHeaders()
      },
      body
    });
    if (!response.ok) throw httpError(502, `OSS 写入失败：${response.status}`);
    logInfo("OSS PUT success", { key, bucket: EDGE_CONFIG.OSS_BUCKET, size: body.length, provider: "http" }, currentRequest());
  } catch (err) {
    logError("OSS PUT failed", err, { key, bucket: EDGE_CONFIG.OSS_BUCKET, size: body.length, provider: "http" }, currentRequest());
    throw err;
  }
}

export async function deleteUserQuestionBank(email, bankId, request) {
  const user = await getUser(email);
  const before = Array.isArray(user.questionBanks) ? user.questionBanks.length : 0;
  user.questionBanks = (user.questionBanks || []).filter((bank) => String(bank.id) !== String(bankId));
  if (user.questionBanks.length === before) throw httpError(404, "题库记录不存在");
  logInfo("question bank delete from user JSON", { userId: email, bankId, ossKey: userKey(email) }, request);
  await saveUser(user);
  return user;
}

export async function getUserQuestionBank(email, bankId, request) {
  const user = await getUser(email);
  const bank = (user.questionBanks || []).find((item) => String(item.id) === String(bankId));
  if (!bank) throw httpError(404, "题库记录不存在");
  logInfo("question bank read from user JSON", { userId: email, bankId, ossKey: userKey(email), count: bank.count || bank.questions?.length || 0 }, request);
  return bank;
}

function ossHeaders() {
  const headers = {};
  if (EDGE_CONFIG.OSS_ACCESS_KEY_ID) headers["x-oss-access-key-id"] = EDGE_CONFIG.OSS_ACCESS_KEY_ID;
  if (EDGE_CONFIG.OSS_ACCESS_KEY_SECRET) headers["x-oss-access-key-secret"] = EDGE_CONFIG.OSS_ACCESS_KEY_SECRET;
  return headers;
}

function currentRequest() {
  return globalThis.__LEARN_APP_CURRENT_REQUEST__;
}

export function withCurrentRequest(request, fn) {
  const previous = globalThis.__LEARN_APP_CURRENT_REQUEST__;
  globalThis.__LEARN_APP_CURRENT_REQUEST__ = request;
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.finally(() => {
        globalThis.__LEARN_APP_CURRENT_REQUEST__ = previous;
      });
    }
    globalThis.__LEARN_APP_CURRENT_REQUEST__ = previous;
    return result;
  } catch (err) {
    globalThis.__LEARN_APP_CURRENT_REQUEST__ = previous;
    throw err;
  }
}

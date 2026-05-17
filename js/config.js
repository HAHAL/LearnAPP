export const CONFIG = {
  API_BASE_URL: globalThis.LEARN_APP_API_BASE_URL || "/api",
  OSS_BUCKET: globalThis.LEARN_APP_OSS_BUCKET || "learnapp-user-data",
  QUESTION_JSON_PATH: "questions/current.json",
  USER_JSON_PREFIX: "users",
  SESSION_TOKEN_KEY: "learnapp_session_token",
  USER_KEY: "learnapp_user",
  LOCAL_QUESTION_KEY: "learnapp_questions_cache",
  MODEL_ANALYSIS_ENABLED: false,
  THEME: {
    primary: "#168a4a",
    primaryDark: "#0d5f34",
    surface: "#f5fbf7"
  }
};

export function getToken() {
  return localStorage.getItem(CONFIG.SESSION_TOKEN_KEY) || "";
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function requireSession() {
  const token = getToken();
  if (!token) {
    location.href = "./index.html";
    throw new Error("未登录");
  }
  return token;
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `请求失败：${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export function normalizeQuestion(raw, index = 0) {
  if (!raw || typeof raw !== "object") throw new Error(`第 ${index + 1} 题格式错误`);
  const id = String(raw.id || raw.questionId || `q-${index + 1}`);
  const text = String(raw.question || raw.text || raw.title || "").trim();
  const optionsSource = raw.options || raw.choices || [];
  const answer = raw.answer ?? raw.correctAnswer;
  if (!text) throw new Error(`第 ${index + 1} 题缺少题干`);
  if (!Array.isArray(optionsSource) || optionsSource.length < 2) throw new Error(`第 ${index + 1} 题至少需要两个选项`);

  const options = optionsSource.map((option, optionIndex) => {
    if (typeof option === "object") {
      return {
        key: String(option.key ?? option.label ?? String.fromCharCode(65 + optionIndex)),
        text: String(option.text ?? option.value ?? "")
      };
    }
    return {
      key: String.fromCharCode(65 + optionIndex),
      text: String(option)
    };
  });

  const normalizedAnswer = typeof answer === "number" ? options[answer]?.key : String(answer ?? "").trim();
  if (!normalizedAnswer) throw new Error(`第 ${index + 1} 题缺少答案`);

  return {
    id,
    question: text,
    options,
    answer: normalizedAnswer,
    explanation: String(raw.explanation || raw.analysis || ""),
    tags: Array.isArray(raw.tags) ? raw.tags : []
  };
}

export function normalizeQuestionList(raw) {
  const list = Array.isArray(raw) ? raw : raw?.questions;
  if (!Array.isArray(list) || list.length === 0) throw new Error("题库 JSON 必须包含非空 questions 数组或题目数组");
  return list.map(normalizeQuestion);
}

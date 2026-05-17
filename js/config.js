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
  const type = String(raw.type || "").trim().toLowerCase();
  const text = String(raw.question || raw.text || raw.title || "").trim();
  const optionsSource = raw.options ?? raw.choices ?? [];
  const answer = raw.answer ?? raw.correctAnswer;
  if (!["single", "multiple"].includes(type)) throw new Error(`第 ${index + 1} 题 type 必须是 single 或 multiple`);
  if (!text) throw new Error(`第 ${index + 1} 题缺少题干`);
  if (answer === undefined || answer === null || answer === "") throw new Error(`第 ${index + 1} 题缺少答案`);

  const options = normalizeOptions(optionsSource, index);
  if (options.length < 1) throw new Error(`第 ${index + 1} 题至少需要一个选项`);

  const answerKeys = normalizeAnswerKeys(answer, options);
  if (!answerKeys.length) throw new Error(`第 ${index + 1} 题缺少答案`);

  return {
    id,
    type,
    question: text,
    options,
    answer: type === "single" ? answerKeys[0] : answerKeys,
    answerKeys,
    explanation: String(raw.explanation || raw.analysis || ""),
    tags: Array.isArray(raw.tags) ? raw.tags : []
  };
}

export function normalizeQuestionList(raw) {
  const list = Array.isArray(raw) ? raw : raw?.questions;
  if (!Array.isArray(list) || list.length === 0) throw new Error("题库 JSON 必须包含非空 questions 数组或题目数组");
  return list.map(normalizeQuestion);
}

export function areAnswersEqual(userAnswer, correctAnswer) {
  const left = normalizeComparableAnswer(userAnswer);
  const right = normalizeComparableAnswer(correctAnswer);
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function formatAnswer(answer) {
  const values = normalizeComparableAnswer(answer);
  return values.length ? values.join(", ") : "-";
}

function normalizeOptions(optionsSource, index) {
  if (Array.isArray(optionsSource)) {
    return optionsSource.map((option, optionIndex) => {
      if (option && typeof option === "object") {
        return {
          key: String(option.key ?? option.label ?? String.fromCharCode(65 + optionIndex)).trim(),
          text: String(option.text ?? option.value ?? "")
        };
      }
      return {
        key: String.fromCharCode(65 + optionIndex),
        text: String(option)
      };
    }).filter((option) => option.key && option.text);
  }

  if (optionsSource && typeof optionsSource === "object") {
    return Object.entries(optionsSource).map(([key, value]) => ({
      key: String(key).trim(),
      text: String(value)
    })).filter((option) => option.key && option.text);
  }

  throw new Error(`第 ${index + 1} 题 options 必须是数组或对象`);
}

function normalizeAnswerKeys(answer, options) {
  const values = Array.isArray(answer) ? answer : [answer];
  return values.map((value) => {
    if (typeof value === "number") return options[value]?.key || "";
    return String(value ?? "").trim();
  }).filter(Boolean);
}

function normalizeComparableAnswer(answer) {
  if (answer === undefined || answer === null || answer === "") return [];
  return (Array.isArray(answer) ? answer : [answer])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .sort();
}

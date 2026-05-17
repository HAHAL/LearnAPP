import { CONFIG, normalizeQuestionList } from "./config.js";

export async function readJsonFile(file) {
  if (!file) throw new Error("请选择 JSON 文件");
  if (!file.name.toLowerCase().endsWith(".json")) throw new Error("仅支持 .json 文件");
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON 解析失败，请检查文件格式");
  }
}

export async function loadQuestionsFromFile(file) {
  const raw = await readJsonFile(file);
  const questions = normalizeQuestionList(raw);
  localStorage.setItem(CONFIG.LOCAL_QUESTION_KEY, JSON.stringify(questions));
  return questions;
}

export function loadCachedQuestions() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG.LOCAL_QUESTION_KEY) || "[]");
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
}

export async function uploadUserJson(path, data) {
  const response = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`OSS 上传失败：${response.status}`);
  return true;
}

export async function downloadUserJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`OSS 下载失败：${response.status}`);
  return response.json();
}

export function mergeUserData(localData, remoteData) {
  if (!remoteData) return localData;
  return {
    ...remoteData,
    ...localData,
    progress: { ...(remoteData.progress || {}), ...(localData.progress || {}) },
    analysisCache: { ...(remoteData.analysisCache || {}), ...(localData.analysisCache || {}) },
    wrongAnswers: dedupeByQuestionId([...(remoteData.wrongAnswers || []), ...(localData.wrongAnswers || [])]),
    examHistory: [...(remoteData.examHistory || []), ...(localData.examHistory || [])]
  };
}

function dedupeByQuestionId(items) {
  const map = new Map();
  for (const item of items) {
    if (item?.questionId) map.set(item.questionId, item);
  }
  return [...map.values()];
}

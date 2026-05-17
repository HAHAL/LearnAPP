import { CONFIG, apiFetch, getCurrentUser, normalizeQuestionList } from "./config.js";

const UPLOAD_RECORDS_KEY = "learnapp_upload_records";

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

export async function uploadQuestionsFromFile(file) {
  const raw = await readJsonFile(file);
  const questions = normalizeQuestionList(raw);
  const user = getCurrentUser();
  const uploadedBy = user?.email || "当前用户";
  const uploadedAt = new Date().toISOString();
  const bankId = `bank-${Date.now()}`;
  const result = await apiFetch("/uploadQuestions", {
    method: "POST",
    body: JSON.stringify({
      bankId,
      name: file.name,
      fileName: file.name,
      uploadedAt,
      uploadedBy,
      questions
    })
  });

  const bank = result?.bank || {};
  const record = {
    id: String(bank.id || bankId),
    fileName: String(bank.name || file.name),
    uploadedAt: String(bank.uploadedAt || uploadedAt),
    uploadedBy,
    count: Number(bank.count || questions.length),
    questions
  };
  saveUploadRecord(record);
  localStorage.setItem(CONFIG.LOCAL_QUESTION_KEY, JSON.stringify(questions));
  return { questions, record };
}

export function loadCachedQuestions() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG.LOCAL_QUESTION_KEY) || "[]");
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
}

export function getUploadRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(UPLOAD_RECORDS_KEY) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export function saveUploadRecord(record) {
  const records = [record, ...getUploadRecords().filter((item) => item.id !== record.id)].slice(0, 30);
  localStorage.setItem(UPLOAD_RECORDS_KEY, JSON.stringify(records));
  return records;
}

export function downloadQuestionBank(record) {
  if (!record?.questions?.length) throw new Error("该上传记录缺少题库内容，无法下载");
  const blob = new Blob([JSON.stringify({ questions: record.questions }, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = record.fileName || "questions.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function syncProgress(payload) {
  try {
    return await apiFetch("/updateProgress", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch (err) {
    if (!/不存在|404|not found/i.test(err.message || "")) throw err;
    return apiFetch("/submitAnswer", {
      method: "POST",
      body: JSON.stringify(payload)
    });
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

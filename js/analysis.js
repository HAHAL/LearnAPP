import { CONFIG, apiFetch } from "./config.js";

const memoryCache = new Map();

export async function getAnalysis(question, userAnswer, correct) {
  if (!question) return "暂无解析。";
  if (question.explanation) return question.explanation;
  if (!CONFIG.MODEL_ANALYSIS_ENABLED) return correct ? "回答正确。" : "暂无本地解析，可在配置中启用大模型解析。";

  const cacheKey = `${question.id}:${userAnswer || ""}`;
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);

  const result = await apiFetch("/callAnalysis", {
    method: "POST",
    body: JSON.stringify({ question, userAnswer })
  });
  const analysis = result?.analysis || "未返回解析。";
  memoryCache.set(cacheKey, analysis);
  return analysis;
}

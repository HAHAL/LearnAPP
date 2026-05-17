import login from "./login.js";
import submitAnswer from "./submitAnswer.js";
import getProgress from "./getProgress.js";
import getWrongQuestions from "./getWrongQuestions.js";
import callAnalysis from "./callAnalysis.js";
import { errorResponse, getEmailFromAuth, getUser, handleOptions, jsonResponse, readJsonBody, saveUser } from "./edge_config.js";

const routes = new Map([
  ["/api/login", login],
  ["/login", login],
  ["/api/submitAnswer", submitAnswer],
  ["/submitAnswer", submitAnswer],
  ["/api/getProgress", getProgress],
  ["/getProgress", getProgress],
  ["/api/getWrongQuestions", getWrongQuestions],
  ["/getWrongQuestions", getWrongQuestions],
  ["/api/callAnalysis", callAnalysis],
  ["/callAnalysis", callAnalysis]
]);

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/api") {
      return jsonResponse({
        ok: true,
        service: "learnapp-edge-api",
        endpoints: ["/api/login", "/api/uploadQuestions", "/api/submitAnswer", "/api/getProgress", "/api/getWrongQuestions", "/api/callAnalysis"]
      }, 200, request);
    }

    if (url.pathname === "/api/uploadQuestions" || url.pathname === "/uploadQuestions") {
      return uploadQuestions(request);
    }

    const route = routes.get(url.pathname);
    if (!route) return jsonResponse({ error: "API 路由不存在" }, 404, request);
    return route.fetch(request);
  }
};

async function uploadQuestions(request) {
  if (request.method !== "POST") return jsonResponse({ error: "仅支持 POST" }, 405, request);
  try {
    const email = getEmailFromAuth(request);
    const body = await readJsonBody(request);
    const questions = Array.isArray(body.questions) ? body.questions : [];
    if (questions.length === 0) return jsonResponse({ error: "questions 必须是非空数组" }, 400, request);
    if (questions.length > 5000) return jsonResponse({ error: "单次上传题目数量不能超过 5000" }, 400, request);

    const user = await getUser(email);
    user.questionBanks = Array.isArray(user.questionBanks) ? user.questionBanks : [];
    const bank = {
      id: String(body.bankId || `bank-${Date.now()}`),
      name: String(body.name || "默认题库").slice(0, 80),
      count: questions.length,
      questions,
      uploadedAt: new Date().toISOString()
    };
    user.questionBanks = [bank, ...user.questionBanks.filter((item) => item.id !== bank.id)].slice(0, 20);
    await saveUser(user);

    return jsonResponse({ ok: true, bank: { id: bank.id, name: bank.name, count: bank.count, uploadedAt: bank.uploadedAt } }, 200, request);
  } catch (err) {
    return errorResponse(err, request);
  }
}

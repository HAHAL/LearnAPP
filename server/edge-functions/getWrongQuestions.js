import { beginRequestLog, errorResponse, getEmailFromAuth, getUser, handleOptions, jsonResponse, logInfo } from "./edge_config.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    beginRequestLog(request, "getWrongQuestions");
    if (request.method !== "GET") return jsonResponse({ message: "仅支持 GET" }, 405, request);
    try {
      const email = getEmailFromAuth(request);
      const user = await getUser(email);
      logInfo("wrong questions read success", { userId: email, wrongCount: user.wrongAnswers?.length || 0 }, request);
      return jsonResponse({ info: "错题读取成功", wrongAnswers: user.wrongAnswers }, 200, request);
    } catch (err) {
      return errorResponse(err, request);
    }
  }
};

import { beginRequestLog, errorResponse, getEmailFromAuth, getUser, handleOptions, jsonResponse, logInfo } from "./edge_config.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    beginRequestLog(request, "getProgress");
    if (request.method !== "GET") return jsonResponse({ message: "仅支持 GET" }, 405, request);
    try {
      const email = getEmailFromAuth(request);
      const user = await getUser(email);
      logInfo("progress read success", { userId: email, answered: user.progress?.answered || 0 }, request);
      return jsonResponse({ info: "学习进度读取成功", progress: user.progress, examHistory: user.examHistory }, 200, request);
    } catch (err) {
      return errorResponse(err, request);
    }
  }
};

import login from "./login.js";
import submitAnswer from "./submitAnswer.js";
import updateProgress from "./updateProgress.js";
import getProgress from "./getProgress.js";
import getWrongQuestions from "./getWrongQuestions.js";
import callAnalysis from "./callAnalysis.js";
import uploadQuestions from "./uploadQuestions.js";
import { beginRequestLog, handleOptions, jsonResponse } from "./edge_config.js";

const routes = new Map([
  ["/api/login", login],
  ["/login", login],
  ["/api/submitAnswer", submitAnswer],
  ["/submitAnswer", submitAnswer],
  ["/api/updateProgress", updateProgress],
  ["/updateProgress", updateProgress],
  ["/api/getProgress", getProgress],
  ["/getProgress", getProgress],
  ["/api/getWrongQuestions", getWrongQuestions],
  ["/getWrongQuestions", getWrongQuestions],
  ["/api/callAnalysis", callAnalysis],
  ["/callAnalysis", callAnalysis],
  ["/api/uploadQuestions", uploadQuestions],
  ["/uploadQuestions", uploadQuestions]
]);

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    const url = new URL(request.url);
    beginRequestLog(request, "index");
    if (url.pathname === "/" || url.pathname === "/api") {
      return jsonResponse({
        ok: true,
        service: "learnapp-edge-api",
        endpoints: ["/api/login", "/api/uploadQuestions", "/api/updateProgress", "/api/submitAnswer", "/api/getProgress", "/api/getWrongQuestions", "/api/callAnalysis"]
      }, 200, request);
    }

    const route = routes.get(url.pathname);
    if (!route) return jsonResponse({ message: "API 路由不存在" }, 404, request);
    return route.fetch(request);
  }
};

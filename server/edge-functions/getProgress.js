import { errorResponse, getEmailFromAuth, getUser, handleOptions, jsonResponse } from "./edge_config.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    if (request.method !== "GET") return jsonResponse({ error: "仅支持 GET" }, 405, request);
    try {
      const email = getEmailFromAuth(request);
      const user = await getUser(email);
      return jsonResponse({ progress: user.progress, examHistory: user.examHistory }, 200, request);
    } catch (err) {
      return errorResponse(err, request);
    }
  }
};

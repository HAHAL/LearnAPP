import { createToken, emptyUser, errorResponse, getUser, handleOptions, jsonResponse, readJsonBody, sanitizeEmail, saveUser } from "./edge_config.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    if (request.method !== "POST") return jsonResponse({ error: "仅支持 POST" }, 405, request);
    try {
      const body = await readJsonBody(request);
      const email = sanitizeEmail(body.email);
      const password = String(body.password || "");
      if (password.length < 6 || password.length > 128) throw Object.assign(new Error("密码长度必须为 6 到 128 位"), { status: 400 });

      let user = await getUser(email);
      if (!user?.email) user = emptyUser(email);
      user.lastLoginAt = new Date().toISOString();
      await saveUser(user);

      return jsonResponse({ token: createToken(email), user }, 200, request);
    } catch (err) {
      return errorResponse(err, request);
    }
  }
};

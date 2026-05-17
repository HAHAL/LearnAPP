import { beginRequestLog, errorResponse, getEmailFromAuth, getUser, handleOptions, jsonResponse, logError, logInfo, readJsonBody, saveUser, userKey } from "./edge_config.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    beginRequestLog(request, "uploadQuestions");
    if (request.method !== "POST") return jsonResponse({ message: "仅支持 POST" }, 405, request);
    try {
      const email = getEmailFromAuth(request);
      const body = await readJsonBody(request);
      const questions = Array.isArray(body.questions) ? body.questions : [];
      const fileName = String(body.fileName || body.name || "默认题库").slice(0, 120);
      const payloadSize = JSON.stringify(body).length;
      logInfo("question upload before write", {
        userId: email,
        fileName,
        size: payloadSize,
        questionCount: questions.length
      }, request);

      if (questions.length === 0) return jsonResponse({ message: "questions 必须是非空数组" }, 400, request);
      if (questions.length > 5000) return jsonResponse({ message: "单次上传题目数量不能超过 5000" }, 400, request);

      const user = await getUser(email);
      user.questionBanks = Array.isArray(user.questionBanks) ? user.questionBanks : [];
      const bank = {
        id: String(body.bankId || `bank-${Date.now()}`),
        name: fileName,
        fileName,
        count: questions.length,
        questions,
        uploadedBy: String(body.uploadedBy || email),
        uploadedAt: body.uploadedAt || new Date().toISOString()
      };
      user.questionBanks = [bank, ...user.questionBanks.filter((item) => item.id !== bank.id)].slice(0, 20);
      await saveUser(user);

      const ossKey = userKey(email);
      logInfo("question upload success", {
        userId: email,
        fileName,
        ossKey,
        bankId: bank.id,
        questionCount: bank.count
      }, request);

      return jsonResponse({
        info: "题库上传成功",
        ok: true,
        ossKey,
        bank: {
          id: bank.id,
          name: bank.name,
          fileName: bank.fileName,
          count: bank.count,
          uploadedBy: bank.uploadedBy,
          uploadedAt: bank.uploadedAt
        }
      }, 200, request);
    } catch (err) {
      logError("question upload failed", err, {}, request);
      return errorResponse(err, request);
    }
  }
};

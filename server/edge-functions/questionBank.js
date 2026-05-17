import { beginRequestLog, deleteUserQuestionBank, errorResponse, getEmailFromAuth, getUser, getUserQuestionBank, handleOptions, jsonResponse, logError, logInfo, ossDelete, ossGetJson, questionBankKey, readJsonBody, userKey } from "./edge_config.js";

export async function downloadQuestionBank(request) {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (!["GET", "POST"].includes(request.method)) return jsonResponse({ message: "仅支持 GET 或 POST" }, 405, request);
  beginRequestLog(request, "downloadQuestionBank");
  try {
    const email = getEmailFromAuth(request);
    const bankId = await getBankId(request);
    const ossKey = questionBankKey(email, bankId);
    const bank = await ossGetJson(ossKey) || await getUserQuestionBank(email, bankId, request);
    logInfo("OSS GET question bank success", {
      userId: email,
      bankId,
      ossKey,
      bucket: "user-json",
      fileName: bank.fileName || bank.name,
      count: bank.count || bank.questions?.length || 0
    }, request);
    return jsonResponse({
      info: "题库下载成功",
      ossKey,
      bank
    }, 200, request);
  } catch (err) {
    logError("question bank download failed", err, {}, request);
    return errorResponse(err, request);
  }
}

export async function deleteQuestionBank(request) {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (!["DELETE", "POST"].includes(request.method)) return jsonResponse({ message: "仅支持 DELETE 或 POST" }, 405, request);
  beginRequestLog(request, "deleteQuestionBank");
  try {
    const email = getEmailFromAuth(request);
    const bankId = await getBankId(request);
    const ossKey = questionBankKey(email, bankId);
    await ossDelete(ossKey);
    const user = await deleteUserQuestionBank(email, bankId, request);
    logInfo("question bank delete success", { userId: email, bankId, key: ossKey, remaining: user.questionBanks.length }, request);
    return jsonResponse({
      info: "题库删除成功",
      ossKey,
      bankId,
      questionBanks: user.questionBanks
    }, 200, request);
  } catch (err) {
    logError("OSS DELETE failed", err, {}, request);
    logError("question bank delete failed", err, {}, request);
    return errorResponse(err, request);
  }
}

export async function listQuestionBanks(request) {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "GET") return jsonResponse({ message: "仅支持 GET" }, 405, request);
  beginRequestLog(request, "getQuestionsList");
  try {
    const email = getEmailFromAuth(request);
    const user = await getUser(email);
    const banks = (user.questionBanks || []).map(({ questions, ...bank }) => bank);
    logInfo("question bank list read success", { userId: email, ossKey: userKey(email), count: banks.length }, request);
    return jsonResponse({
      info: "题库列表读取成功",
      questionBanks: banks
    }, 200, request);
  } catch (err) {
    logError("question bank list failed", err, {}, request);
    return errorResponse(err, request);
  }
}

async function getBankId(request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("bankId") || url.searchParams.get("id");
  if (fromQuery) return fromQuery;
  const body = await readJsonBody(request);
  if (!body.bankId && !body.id) throw Object.assign(new Error("缺少 bankId"), { status: 400 });
  return body.bankId || body.id;
}

import { EDGE_CONFIG, beginRequestLog, errorResponse, getEmailFromAuth, getUser, handleOptions, jsonResponse, logInfo, readJsonBody, saveUser } from "./edge_config.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    beginRequestLog(request, "callAnalysis");
    if (request.method !== "POST") return jsonResponse({ message: "仅支持 POST" }, 405, request);
    try {
      const email = getEmailFromAuth(request);
      const body = await readJsonBody(request);
      logInfo("analysis requested", { userId: email, questionId: body.question?.id || "" }, request);
      if (!EDGE_CONFIG.MODEL_API_ENABLED) return jsonResponse({ message: "大模型解析未启用" }, 403, request);
      if (!EDGE_CONFIG.MODEL_API_KEY) return jsonResponse({ message: "缺少 MODEL_API_KEY" }, 500, request);
      if (!body.question?.id) return jsonResponse({ message: "缺少 question.id" }, 400, request);

      const user = await getUser(email);
      const cacheKey = `${body.question.id}:${body.userAnswer || ""}`;
      if (user.analysisCache[cacheKey]) return jsonResponse({ info: "解析缓存命中", analysis: user.analysisCache[cacheKey], cached: true }, 200, request);

      const analysis = await callModel(body.question, body.userAnswer);
      user.analysisCache[cacheKey] = analysis;
      await saveUser(user);
      return jsonResponse({ info: "解析生成成功", analysis, cached: false }, 200, request);
    } catch (err) {
      return errorResponse(err, request);
    }
  }
};

async function callModel(question, userAnswer) {
  const response = await fetch(EDGE_CONFIG.MODEL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EDGE_CONFIG.MODEL_API_KEY}`
    },
    body: JSON.stringify({
      model: EDGE_CONFIG.MODEL_NAME,
      messages: [
        { role: "system", content: "你是学习题库解析助手，请用简洁中文解释正确答案和易错点。" },
        { role: "user", content: JSON.stringify({ question, userAnswer }) }
      ],
      temperature: 0.2
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || "大模型接口调用失败"), { status: 502 });
  return payload.choices?.[0]?.message?.content || "未生成解析。";
}

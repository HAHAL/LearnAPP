import { errorResponse, getEmailFromAuth, getUser, handleOptions, jsonResponse, readJsonBody, saveUser } from "./edge_config.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions(request);
    if (request.method !== "POST") return jsonResponse({ error: "仅支持 POST" }, 405, request);
    try {
      const email = getEmailFromAuth(request);
      const body = await readJsonBody(request);
      const user = await getUser(email);

      if (body.mode === "exam") {
        updateExam(user, body.exam);
      } else {
        updatePractice(user, body);
      }

      await saveUser(user);
      return jsonResponse({ user, progress: user.progress, wrongAnswers: user.wrongAnswers }, 200, request);
    } catch (err) {
      return errorResponse(err, request);
    }
  }
};

function updatePractice(user, body) {
  if (!body.questionId || !body.question) throw Object.assign(new Error("缺少 questionId 或 question"), { status: 400 });
  const correct = Boolean(body.correct);
  user.progress.answered += 1;
  if (correct) user.progress.correct += 1;
  user.progress.byQuestion[body.questionId] = {
    answer: String(body.answer || ""),
    correct,
    updatedAt: new Date().toISOString()
  };

  if (correct) {
    user.wrongAnswers = user.wrongAnswers.filter((item) => item.questionId !== body.questionId);
  } else {
    const record = {
      questionId: body.questionId,
      question: body.question,
      answer: String(body.answer || ""),
      analysis: String(body.analysis || body.question.explanation || ""),
      updatedAt: new Date().toISOString()
    };
    user.wrongAnswers = [record, ...user.wrongAnswers.filter((item) => item.questionId !== body.questionId)];
  }
}

function updateExam(user, exam) {
  if (!exam || !Array.isArray(exam.details)) throw Object.assign(new Error("考试数据缺少 details"), { status: 400 });
  const total = Number(exam.total || exam.details.length);
  const score = Number(exam.score || 0);
  user.examHistory.unshift({
    total,
    score,
    submittedAt: exam.submittedAt || new Date().toISOString(),
    details: exam.details
  });
  user.examHistory = user.examHistory.slice(0, 50);

  for (const detail of exam.details) {
    if (!detail?.questionId) continue;
    user.progress.answered += 1;
    if (detail.correct) user.progress.correct += 1;
    user.progress.byQuestion[detail.questionId] = {
      answer: String(detail.answer || ""),
      correct: Boolean(detail.correct),
      updatedAt: new Date().toISOString()
    };
    if (!detail.correct) {
      user.wrongAnswers = [{
        questionId: detail.questionId,
        question: detail.question,
        answer: String(detail.answer || ""),
        analysis: String(detail.analysis || detail.question?.explanation || ""),
        updatedAt: new Date().toISOString()
      }, ...user.wrongAnswers.filter((item) => item.questionId !== detail.questionId)];
    }
  }
}

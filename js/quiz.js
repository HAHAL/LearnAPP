import { apiFetch, requireSession } from "./config.js";
import { getAnalysis } from "./analysis.js";
import { loadCachedQuestions, loadQuestionsFromFile } from "./oss_api.js";

requireSession();

let questions = loadCachedQuestions();
let currentIndex = 0;

const fileInput = document.querySelector("#questionFile");
const statusBox = document.querySelector("#status");
const progressText = document.querySelector("#progressText");
const questionMeta = document.querySelector("#questionMeta");
const questionText = document.querySelector("#questionText");
const answerForm = document.querySelector("#answerForm");
const analysisBox = document.querySelector("#analysisBox");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const submitBtn = document.querySelector("#submitBtn");

function setStatus(text, type = "") {
  statusBox.textContent = text;
  statusBox.className = `message ${type}`.trim();
}

function render() {
  progressText.textContent = questions.length ? `${currentIndex + 1} / ${questions.length}` : "未载入";
  answerForm.innerHTML = "";
  analysisBox.textContent = "提交答案后显示解析。";

  if (!questions.length) {
    questionMeta.textContent = "请先上传题库 JSON";
    questionText.textContent = "题目会显示在这里";
    submitBtn.disabled = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const question = questions[currentIndex];
  questionMeta.textContent = `题号 ${currentIndex + 1}${question.tags.length ? ` · ${question.tags.join(" / ")}` : ""}`;
  questionText.textContent = question.question;
  for (const option of question.options) {
    const label = document.createElement("label");
    label.className = "option";
    label.innerHTML = `<input type="radio" name="answer" value="${escapeHtml(option.key)}" /> <strong>${escapeHtml(option.key)}.</strong> ${escapeHtml(option.text)}`;
    answerForm.append(label);
  }
  submitBtn.disabled = false;
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === questions.length - 1;
}

function getSelectedAnswer() {
  return new FormData(answerForm).get("answer");
}

async function submitAnswer() {
  const question = questions[currentIndex];
  if (!question) return setStatus("当前没有可提交的题目", "error");
  const selected = getSelectedAnswer();
  if (!selected) return setStatus("请选择一个答案", "error");

  const correct = selected === question.answer;
  submitBtn.disabled = true;
  try {
    const analysis = await getAnalysis(question, selected, correct);
    await apiFetch("/submitAnswer", {
      method: "POST",
      body: JSON.stringify({
        mode: "practice",
        questionId: question.id,
        question,
        answer: selected,
        correct,
        analysis
      })
    });
    analysisBox.textContent = `${correct ? "回答正确" : `回答错误，正确答案：${question.answer}`}\n\n${analysis}`;
    setStatus("已同步进度", "success");
  } catch (err) {
    setStatus(err.message || "提交失败", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

fileInput.addEventListener("change", async () => {
  try {
    questions = await loadQuestionsFromFile(fileInput.files[0]);
    currentIndex = 0;
    setStatus(`已载入 ${questions.length} 道题`, "success");
    render();
  } catch (err) {
    setStatus(err.message, "error");
  }
});

prevBtn.addEventListener("click", () => {
  currentIndex = Math.max(0, currentIndex - 1);
  render();
});

nextBtn.addEventListener("click", () => {
  currentIndex = Math.min(questions.length - 1, currentIndex + 1);
  render();
});

submitBtn.addEventListener("click", submitAnswer);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

render();

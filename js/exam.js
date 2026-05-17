import { apiFetch, requireSession } from "./config.js";
import { loadQuestionsFromFile } from "./oss_api.js";

requireSession();

let allQuestions = [];
let examQuestions = [];
let currentIndex = 0;
let answers = new Map();
let timerId = null;
let deadline = 0;

const fileInput = document.querySelector("#questionFile");
const examCount = document.querySelector("#examCount");
const examMinutes = document.querySelector("#examMinutes");
const startBtn = document.querySelector("#startBtn");
const finishBtn = document.querySelector("#finishBtn");
const timer = document.querySelector("#timer");
const statusBox = document.querySelector("#status");
const questionMeta = document.querySelector("#questionMeta");
const questionText = document.querySelector("#questionText");
const answerForm = document.querySelector("#answerForm");
const resultBox = document.querySelector("#resultBox");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");

function setStatus(text, type = "") {
  statusBox.textContent = text;
  statusBox.className = `message ${type}`.trim();
}

function renderQuestion() {
  answerForm.innerHTML = "";
  if (!examQuestions.length) {
    questionMeta.textContent = "请上传题库并开始考试";
    questionText.textContent = "题目会显示在这里";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }
  const question = examQuestions[currentIndex];
  questionMeta.textContent = `第 ${currentIndex + 1} / ${examQuestions.length} 题`;
  questionText.textContent = question.question;
  for (const option of question.options) {
    const label = document.createElement("label");
    label.className = "option";
    const checked = answers.get(question.id) === option.key ? "checked" : "";
    label.innerHTML = `<input type="radio" name="answer" value="${escapeHtml(option.key)}" ${checked} /> <strong>${escapeHtml(option.key)}.</strong> ${escapeHtml(option.text)}`;
    answerForm.append(label);
  }
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === examQuestions.length - 1;
}

function saveCurrentAnswer() {
  const question = examQuestions[currentIndex];
  if (!question) return;
  const selected = new FormData(answerForm).get("answer");
  if (selected) answers.set(question.id, selected);
}

function startExam() {
  if (!allQuestions.length) return setStatus("请先上传题库 JSON", "error");
  const count = Math.min(Math.max(Number(examCount.value) || 1, 1), allQuestions.length);
  const minutes = Math.max(Number(examMinutes.value) || 1, 1);
  examQuestions = shuffle([...allQuestions]).slice(0, count);
  answers = new Map();
  currentIndex = 0;
  deadline = Date.now() + minutes * 60 * 1000;
  clearInterval(timerId);
  timerId = setInterval(updateTimer, 1000);
  updateTimer();
  renderQuestion();
  resultBox.textContent = "考试进行中。";
  setStatus(`已开始，抽取 ${count} 题`, "success");
}

function updateTimer() {
  const remaining = Math.max(0, deadline - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (remaining <= 0 && examQuestions.length) finishExam();
}

async function finishExam() {
  if (!examQuestions.length) return setStatus("尚未开始考试", "error");
  saveCurrentAnswer();
  clearInterval(timerId);
  const details = examQuestions.map((question) => {
    const answer = answers.get(question.id) || "";
    return {
      questionId: question.id,
      question,
      answer,
      correct: answer === question.answer,
      analysis: question.explanation || ""
    };
  });
  const score = details.filter((item) => item.correct).length;
  const wrong = details.filter((item) => !item.correct);

  try {
    await apiFetch("/submitAnswer", {
      method: "POST",
      body: JSON.stringify({
        mode: "exam",
        exam: {
          total: details.length,
          score,
          details,
          submittedAt: new Date().toISOString()
        }
      })
    });
    resultBox.innerHTML = `<h3>得分：${score} / ${details.length}</h3>${wrong.map((item) => `<p>${escapeHtml(item.question.question)}<br />你的答案：${escapeHtml(item.answer || "未答")}，正确答案：${escapeHtml(item.question.answer)}</p>`).join("") || "<p>全部答对。</p>"}`;
    setStatus("考试结果已同步", "success");
  } catch (err) {
    setStatus(err.message || "交卷失败", "error");
  }
}

fileInput.addEventListener("change", async () => {
  try {
    allQuestions = await loadQuestionsFromFile(fileInput.files[0]);
    setStatus(`已载入 ${allQuestions.length} 道题`, "success");
  } catch (err) {
    setStatus(err.message, "error");
  }
});

answerForm.addEventListener("change", saveCurrentAnswer);
startBtn.addEventListener("click", startExam);
finishBtn.addEventListener("click", finishExam);
prevBtn.addEventListener("click", () => {
  saveCurrentAnswer();
  currentIndex = Math.max(0, currentIndex - 1);
  renderQuestion();
});
nextBtn.addEventListener("click", () => {
  saveCurrentAnswer();
  currentIndex = Math.min(examQuestions.length - 1, currentIndex + 1);
  renderQuestion();
});

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

renderQuestion();

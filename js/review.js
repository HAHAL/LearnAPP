import { apiFetch, requireSession } from "./config.js";

requireSession();

let wrongAnswers = [];
let filtered = [];
let page = 1;
const pageSize = 8;

const list = document.querySelector("#wrongList");
const statusBox = document.querySelector("#status");
const detailBox = document.querySelector("#detailBox");
const countText = document.querySelector("#countText");
const filterInput = document.querySelector("#filterInput");
const pageText = document.querySelector("#pageText");
const prevPage = document.querySelector("#prevPage");
const nextPage = document.querySelector("#nextPage");

function setStatus(text, type = "") {
  statusBox.textContent = text;
  statusBox.className = `message ${type}`.trim();
}

async function loadWrongQuestions() {
  try {
    const result = await apiFetch("/getWrongQuestions");
    wrongAnswers = Array.isArray(result?.wrongAnswers) ? result.wrongAnswers : [];
    applyFilter();
    setStatus("错题已同步", "success");
  } catch (err) {
    setStatus(err.message || "读取错题失败", "error");
  }
}

function applyFilter() {
  const keyword = filterInput.value.trim().toLowerCase();
  filtered = wrongAnswers.filter((item) => {
    const question = item.question || {};
    const haystack = `${question.question || ""} ${(question.tags || []).join(" ")}`.toLowerCase();
    return !keyword || haystack.includes(keyword);
  });
  page = 1;
  renderList();
}

function renderList() {
  list.innerHTML = "";
  countText.textContent = `${filtered.length} 题`;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  page = Math.min(page, totalPages);
  pageText.textContent = `${page} / ${totalPages}`;
  prevPage.disabled = page <= 1;
  nextPage.disabled = page >= totalPages;

  if (!filtered.length) {
    list.innerHTML = '<div class="empty">暂无错题</div>';
    return;
  }

  for (const item of filtered.slice((page - 1) * pageSize, page * pageSize)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wrong-item";
    button.textContent = item.question?.question || item.questionId;
    button.addEventListener("click", () => renderDetail(item));
    list.append(button);
  }
}

function renderDetail(item) {
  const question = item.question || {};
  detailBox.innerHTML = `
    <h3>${escapeHtml(question.question || item.questionId)}</h3>
    <p><strong>你的答案：</strong>${escapeHtml(item.answer || "-")}</p>
    <p><strong>正确答案：</strong>${escapeHtml(question.answer || "-")}</p>
    <p>${escapeHtml(item.analysis || question.explanation || "暂无解析")}</p>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

filterInput.addEventListener("input", applyFilter);
prevPage.addEventListener("click", () => {
  page -= 1;
  renderList();
});
nextPage.addEventListener("click", () => {
  page += 1;
  renderList();
});

loadWrongQuestions();

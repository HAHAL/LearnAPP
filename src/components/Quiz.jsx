import { useEffect, useMemo, useState } from "react";
import { apiFetch, areAnswersEqual, formatAnswer } from "../../js/config.js";
import { getAnalysis } from "../../js/analysis.js";
import { loadCachedQuestions, syncProgress } from "../../js/oss_api.js";
import UploadRecords from "./UploadRecords.jsx";

export default function Quiz() {
  const [questions, setQuestions] = useState(() => loadCachedQuestions());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [analysis, setAnalysis] = useState("提交答案后显示解析。");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const question = questions[currentIndex];

  useEffect(() => {
    let active = true;
    apiFetch("/getProgress")
      .then((result) => {
        if (active) setProgress(result?.progress || null);
      })
      .catch(() => {
        if (active) setProgress(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const meta = useMemo(() => {
    if (!question) return "请先上传题库 JSON";
    return `题号 ${currentIndex + 1}${question.tags.length ? ` · ${question.tags.join(" / ")}` : ""}`;
  }, [currentIndex, question]);

  async function submitAnswer() {
    if (!question) return showStatus("当前没有可提交的题目", "error");
    if (!hasSelection(question, selected)) return showStatus("请选择一个答案", "error");
    const submittedAnswer = normalizeSelection(question, selected);
    const correct = areAnswersEqual(submittedAnswer, question.answerKeys);
    setLoading(true);
    try {
      const explanation = await getAnalysis(question, submittedAnswer, correct);
      const result = await syncProgress({
        mode: "practice",
        questionId: question.id,
        question,
        answer: submittedAnswer,
        correct,
        analysis: explanation
      });
      if (result?.progress) setProgress(result.progress);
      setAnalysis(`${correct ? "回答正确" : `回答错误，正确答案：${formatAnswer(question.answerKeys)}`}\n\n${explanation}`);
      showStatus("已同步进度", "success");
    } catch (err) {
      showStatus(err.message || "提交失败", "error");
    } finally {
      setLoading(false);
    }
  }

  function move(delta) {
    const nextIndex = Math.min(questions.length - 1, Math.max(0, currentIndex + delta));
    setCurrentIndex(nextIndex);
    setSelected(initialSelection(questions[nextIndex]));
    setAnalysis("提交答案后显示解析。");
  }

  function toggleOption(optionKey) {
    if (!question) return;
    if (question.type === "multiple") {
      setSelected((value) => {
        const current = Array.isArray(value) ? value : [];
        return current.includes(optionKey) ? current.filter((item) => item !== optionKey) : [...current, optionKey];
      });
      return;
    }
    setSelected(optionKey);
  }

  function showStatus(text, type = "") {
    setStatus(text);
    setStatusType(type);
  }

  async function refreshProgress() {
    try {
      const result = await apiFetch("/getProgress");
      setProgress(result?.progress || null);
      showStatus("进度已刷新", "success");
    } catch (err) {
      showStatus(err.message || "读取进度失败", "error");
    }
  }

  function handleQuestionsLoaded(loaded) {
    setQuestions(loaded);
    setCurrentIndex(0);
    setSelected(initialSelection(loaded[0]));
    setAnalysis("提交答案后显示解析。");
    showStatus(`已载入 ${loaded.length} 道题`, "success");
  }

  return (
    <main className="page-grid">
      <section className="panel">
        <div className="section-title">
          <h1>题库练习</h1>
          <span>{questions.length ? `${currentIndex + 1} / ${questions.length}` : "未载入"}</span>
        </div>
        <div className="glass-card progress-card">
          <div>
            <strong>{progress?.answered ?? 0}</strong>
            <span>已答</span>
          </div>
          <div>
            <strong>{progress?.correct ?? 0}</strong>
            <span>正确</span>
          </div>
          <button className="secondary compact-button" type="button" onClick={refreshProgress}>刷新进度</button>
        </div>
        <div className={`message ${statusType}`}>{status}</div>
        <UploadRecords onQuestionsLoaded={handleQuestionsLoaded} />
      </section>

      <section className="panel question-panel">
        <div className="muted">{meta}</div>
        <h2>{question?.question || "题目会显示在这里"}</h2>
        <form className="options">
          {(question?.options || []).map((option) => (
            <label className="option" key={option.key}>
              <input
                type={question.type === "multiple" ? "checkbox" : "radio"}
                name="answer"
                value={option.key}
                checked={isSelected(question, selected, option.key)}
                onChange={() => toggleOption(option.key)}
              />
              <strong>{option.key}.</strong>
              <span>{option.text}</span>
            </label>
          ))}
        </form>
        <div className="actions">
          <button type="button" className="secondary" disabled={currentIndex === 0} onClick={() => move(-1)}>上一题</button>
          <button type="button" disabled={!question || loading} onClick={submitAnswer}>{loading ? "提交中..." : "提交答案"}</button>
          <button type="button" className="secondary" disabled={!questions.length || currentIndex === questions.length - 1} onClick={() => move(1)}>下一题</button>
        </div>
      </section>

      <section className="panel">
        <h2>解析</h2>
        <div className="analysis-box">{analysis}</div>
      </section>
    </main>
  );
}

function initialSelection(question) {
  return question?.type === "multiple" ? [] : "";
}

function isSelected(question, selected, optionKey) {
  if (question?.type === "multiple") return Array.isArray(selected) && selected.includes(optionKey);
  return selected === optionKey;
}

function hasSelection(question, selected) {
  return question?.type === "multiple" ? Array.isArray(selected) && selected.length > 0 : Boolean(selected);
}

function normalizeSelection(question, selected) {
  return question?.type === "multiple" ? [...selected].sort() : selected;
}

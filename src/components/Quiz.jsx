import { useMemo, useState } from "react";
import { apiFetch } from "../../js/config.js";
import { getAnalysis } from "../../js/analysis.js";
import { loadCachedQuestions, loadQuestionsFromFile } from "../../js/oss_api.js";

export default function Quiz() {
  const [questions, setQuestions] = useState(() => loadCachedQuestions());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [analysis, setAnalysis] = useState("提交答案后显示解析。");
  const [loading, setLoading] = useState(false);
  const question = questions[currentIndex];

  const meta = useMemo(() => {
    if (!question) return "请先上传题库 JSON";
    return `题号 ${currentIndex + 1}${question.tags.length ? ` · ${question.tags.join(" / ")}` : ""}`;
  }, [currentIndex, question]);

  async function handleFile(event) {
    try {
      const loaded = await loadQuestionsFromFile(event.target.files[0]);
      setQuestions(loaded);
      setCurrentIndex(0);
      setSelected("");
      setAnalysis("提交答案后显示解析。");
      showStatus(`已载入 ${loaded.length} 道题`, "success");
    } catch (err) {
      showStatus(err.message, "error");
    }
  }

  async function submitAnswer() {
    if (!question) return showStatus("当前没有可提交的题目", "error");
    if (!selected) return showStatus("请选择一个答案", "error");
    const correct = selected === question.answer;
    setLoading(true);
    try {
      const explanation = await getAnalysis(question, selected, correct);
      await apiFetch("/submitAnswer", {
        method: "POST",
        body: JSON.stringify({
          mode: "practice",
          questionId: question.id,
          question,
          answer: selected,
          correct,
          analysis: explanation
        })
      });
      setAnalysis(`${correct ? "回答正确" : `回答错误，正确答案：${question.answer}`}\n\n${explanation}`);
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
    setSelected("");
    setAnalysis("提交答案后显示解析。");
  }

  function showStatus(text, type = "") {
    setStatus(text);
    setStatusType(type);
  }

  return (
    <main className="page-grid">
      <section className="panel">
        <div className="section-title">
          <h1>题库练习</h1>
          <span>{questions.length ? `${currentIndex + 1} / ${questions.length}` : "未载入"}</span>
        </div>
        <label className="upload-box">
          上传题库 JSON
          <input type="file" accept="application/json,.json" onChange={handleFile} />
        </label>
        <div className={`message ${statusType}`}>{status}</div>
      </section>

      <section className="panel question-panel">
        <div className="muted">{meta}</div>
        <h2>{question?.question || "题目会显示在这里"}</h2>
        <form className="options">
          {(question?.options || []).map((option) => (
            <label className="option" key={option.key}>
              <input type="radio" name="answer" value={option.key} checked={selected === option.key} onChange={() => setSelected(option.key)} />
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

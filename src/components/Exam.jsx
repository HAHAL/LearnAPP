import { useEffect, useMemo, useState } from "react";
import { apiFetch, areAnswersEqual, formatAnswer } from "../../js/config.js";
import { loadQuestionsFromFile } from "../../js/oss_api.js";

export default function Exam() {
  const [allQuestions, setAllQuestions] = useState([]);
  const [examQuestions, setExamQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [examCount, setExamCount] = useState(10);
  const [examMinutes, setExamMinutes] = useState(20);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [result, setResult] = useState("交卷后显示成绩。");
  const question = examQuestions[currentIndex];

  useEffect(() => {
    if (!deadline || !examQuestions.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline, examQuestions.length]);

  const remaining = Math.max(0, deadline - now);
  const timer = useMemo(() => {
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [remaining]);

  useEffect(() => {
    if (deadline && examQuestions.length && remaining === 0) {
      finishExam();
    }
  }, [remaining]);

  async function handleFile(event) {
    try {
      const loaded = await loadQuestionsFromFile(event.target.files[0]);
      setAllQuestions(loaded);
      showStatus(`已载入 ${loaded.length} 道题`, "success");
    } catch (err) {
      showStatus(err.message, "error");
    }
  }

  function startExam() {
    if (!allQuestions.length) return showStatus("请先上传题库 JSON", "error");
    const count = Math.min(Math.max(Number(examCount) || 1, 1), allQuestions.length);
    const minutes = Math.max(Number(examMinutes) || 1, 1);
    setExamQuestions(shuffle([...allQuestions]).slice(0, count));
    setAnswers({});
    setCurrentIndex(0);
    setDeadline(Date.now() + minutes * 60 * 1000);
    setNow(Date.now());
    setResult("考试进行中。");
    showStatus(`已开始，抽取 ${count} 题`, "success");
  }

  async function finishExam() {
    if (!examQuestions.length) return showStatus("尚未开始考试", "error");
    const details = examQuestions.map((item) => {
      const answer = normalizeStoredAnswer(item, answers[item.id]);
      return {
        questionId: item.id,
        question: item,
        answer,
        correct: areAnswersEqual(answer, item.answerKeys),
        analysis: item.explanation || ""
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
      setDeadline(0);
      setResult({ score, total: details.length, wrong });
      showStatus("考试结果已同步", "success");
    } catch (err) {
      showStatus(err.message || "交卷失败", "error");
    }
  }

  function choose(optionKey) {
    if (!question) return;
    if (question.type === "multiple") {
      setAnswers((value) => {
        const current = Array.isArray(value[question.id]) ? value[question.id] : [];
        const next = current.includes(optionKey) ? current.filter((item) => item !== optionKey) : [...current, optionKey];
        return { ...value, [question.id]: next };
      });
      return;
    }
    setAnswers((value) => ({ ...value, [question.id]: optionKey }));
  }

  function move(delta) {
    setCurrentIndex((value) => Math.min(examQuestions.length - 1, Math.max(0, value + delta)));
  }

  function showStatus(text, type = "") {
    setStatus(text);
    setStatusType(type);
  }

  return (
    <main className="page-grid">
      <section className="panel">
        <div className="section-title">
          <h1>模拟考试</h1>
          <strong>{timer}</strong>
        </div>
        <label className="upload-box">
          上传题库 JSON
          <input type="file" accept="application/json,.json" onChange={handleFile} />
        </label>
        <div className="exam-controls">
          <label>抽题数 <input type="number" min="1" max="100" value={examCount} onChange={(event) => setExamCount(event.target.value)} /></label>
          <label>分钟 <input type="number" min="1" max="240" value={examMinutes} onChange={(event) => setExamMinutes(event.target.value)} /></label>
        </div>
        <div className="actions">
          <button type="button" onClick={startExam}>开始考试</button>
          <button type="button" className="danger" onClick={finishExam}>交卷</button>
        </div>
        <div className={`message ${statusType}`}>{status}</div>
      </section>

      <section className="panel question-panel">
        <div className="muted">{question ? `第 ${currentIndex + 1} / ${examQuestions.length} 题` : "请上传题库并开始考试"}</div>
        <h2>{question?.question || "题目会显示在这里"}</h2>
        <form className="options">
          {(question?.options || []).map((option) => (
            <label className="option" key={option.key}>
              <input
                type={question.type === "multiple" ? "checkbox" : "radio"}
                name="answer"
                value={option.key}
                checked={isSelected(question, answers[question.id], option.key)}
                onChange={() => choose(option.key)}
              />
              <strong>{option.key}.</strong>
              <span>{option.text}</span>
            </label>
          ))}
        </form>
        <div className="actions">
          <button type="button" className="secondary" disabled={currentIndex === 0} onClick={() => move(-1)}>上一题</button>
          <button type="button" className="secondary" disabled={!examQuestions.length || currentIndex === examQuestions.length - 1} onClick={() => move(1)}>下一题</button>
        </div>
      </section>

      <section className="panel">
        <h2>成绩与反馈</h2>
        <div className="analysis-box">
          {typeof result === "string" ? result : (
            <>
              <h3>得分：{result.score} / {result.total}</h3>
              {result.wrong.length ? result.wrong.map((item) => (
                <p key={item.questionId}>{item.question.question}<br />你的答案：{formatAnswer(item.answer)}，正确答案：{formatAnswer(item.question.answerKeys || item.question.answer)}</p>
              )) : <p>全部答对。</p>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function isSelected(question, answer, optionKey) {
  if (question?.type === "multiple") return Array.isArray(answer) && answer.includes(optionKey);
  return answer === optionKey;
}

function normalizeStoredAnswer(question, answer) {
  if (question?.type === "multiple") return Array.isArray(answer) ? [...answer].sort() : [];
  return answer || "";
}

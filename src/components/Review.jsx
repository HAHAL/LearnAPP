import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../js/config.js";

const pageSize = 8;

export default function Review() {
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/getWrongQuestions")
      .then((result) => {
        if (!active) return;
        setWrongAnswers(Array.isArray(result?.wrongAnswers) ? result.wrongAnswers : []);
        setStatus("错题已同步");
        setStatusType("success");
      })
      .catch((err) => {
        if (!active) return;
        setStatus(err.message || "读取错题失败");
        setStatusType("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    return wrongAnswers.filter((item) => {
      const question = item.question || {};
      const haystack = `${question.question || ""} ${(question.tags || []).join(" ")}`.toLowerCase();
      return !value || haystack.includes(value);
    });
  }, [keyword, wrongAnswers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleKeyword(value) {
    setKeyword(value);
    setPage(1);
  }

  return (
    <main className="page-grid">
      <section className="panel">
        <div className="section-title">
          <h1>错题复习</h1>
          <span>{filtered.length} 题</span>
        </div>
        <input className="search" type="search" value={keyword} onChange={(event) => handleKeyword(event.target.value)} placeholder="筛选题干或标签" />
        <div className={`message ${statusType}`}>{status}</div>
      </section>

      <section className="panel list-panel">
        <div className="wrong-list">
          {visible.length ? visible.map((item) => (
            <button className="wrong-item" type="button" key={item.questionId} onClick={() => setSelected(item)}>
              {item.question?.question || item.questionId}
            </button>
          )) : <div className="empty">暂无错题</div>}
        </div>
        <div className="actions">
          <button type="button" className="secondary" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
          <span className="muted">{currentPage} / {totalPages}</span>
          <button type="button" className="secondary" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button>
        </div>
      </section>

      <section className="panel">
        <h2>解析详情</h2>
        <div className="analysis-box">
          {selected ? (
            <>
              <h3>{selected.question?.question || selected.questionId}</h3>
              <p><strong>你的答案：</strong>{selected.answer || "-"}</p>
              <p><strong>正确答案：</strong>{selected.question?.answer || "-"}</p>
              <p>{selected.analysis || selected.question?.explanation || "暂无解析"}</p>
            </>
          ) : "点击错题查看解析。"}
        </div>
      </section>
    </main>
  );
}

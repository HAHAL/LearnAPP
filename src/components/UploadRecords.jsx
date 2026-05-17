import { useEffect, useState } from "react";
import { deleteQuestionBankRecord, downloadQuestionBank, getUploadRecords, uploadQuestionsFromFile } from "../../js/oss_api.js";

export default function UploadRecords({ onQuestionsLoaded, title = "题库上传" }) {
  const [records, setRecords] = useState(() => getUploadRecords());
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setRecords(getUploadRecords());
  }, []);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("正在上传题库...");
    setMessageType("");
    try {
      const { questions } = await uploadQuestionsFromFile(file);
      setRecords(getUploadRecords());
      onQuestionsLoaded?.(questions);
      setMessage(`已上传并载入 ${questions.length} 道题`);
      setMessageType("success");
    } catch (err) {
      setMessage(err.message || "上传失败");
      setMessageType("error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function loadRecord(record) {
    if (!record.questions?.length) {
      setMessage("该上传记录缺少题库内容，无法载入");
      setMessageType("error");
      return;
    }
    onQuestionsLoaded?.(record.questions);
    setMessage(`已载入 ${record.count || record.questions.length} 道题`);
    setMessageType("success");
  }

  async function download(record) {
    try {
      await downloadQuestionBank(record);
      setMessage("题库下载成功");
      setMessageType("success");
    } catch (err) {
      setMessage(err.message || "下载失败");
      setMessageType("error");
    }
  }

  async function remove(record) {
    try {
      const nextRecords = await deleteQuestionBankRecord(record);
      setRecords(nextRecords);
      setMessage("题库记录已删除");
      setMessageType("success");
    } catch (err) {
      setMessage(err.message || "删除失败");
      setMessageType("error");
    }
  }

  return (
    <section className="glass-card upload-records">
      <div className="section-title">
        <h2>{title}</h2>
        <label className="file-button">
          {uploading ? "上传中..." : "上传 JSON"}
          <input type="file" accept="application/json,.json" disabled={uploading} onChange={handleUpload} />
        </label>
      </div>
      <div className={`message ${messageType}`}>{message}</div>
      <div className="record-table" role="table" aria-label="上传记录">
        <div className="record-row record-head" role="row">
          <span>文件名</span>
          <span>上传时间</span>
          <span>上传者</span>
          <span>操作</span>
        </div>
        {records.length ? records.map((record) => (
          <div className="record-row" role="row" key={record.id}>
            <span>{record.fileName}</span>
            <span>{formatDate(record.uploadedAt)}</span>
            <span>{record.uploadedBy || "-"}</span>
            <span className="record-actions">
              <button className="secondary compact-button" type="button" onClick={() => loadRecord(record)}>载入</button>
              <button className="secondary compact-button" type="button" onClick={() => download(record)}>下载</button>
              <button className="danger compact-button" type="button" onClick={() => remove(record)}>删除</button>
            </span>
          </div>
        )) : <div className="empty">暂无上传记录</div>}
      </div>
    </section>
  );
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

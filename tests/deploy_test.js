const DEFAULT_BASE = process.env.API_BASE_URL || "http://127.0.0.1:8787/api";
const MODEL_TEST_ENABLED = String(process.env.MODEL_TEST_ENABLED || "false") === "true";

let token = "";

function log(ok, name, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`;
  console.log(line);
  if (!ok) process.exitCode = 1;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${DEFAULT_BASE}${path}`, { ...options, headers });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    const err = new Error(data.error || data.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

const sampleQuestions = [
  {
    id: "deploy-q1",
    question: "1 + 1 = ?",
    options: [
      { key: "A", text: "1" },
      { key: "B", text: "2" },
      { key: "C", text: "3" }
    ],
    answer: "B",
    explanation: "1 + 1 等于 2。",
    tags: ["math"]
  },
  {
    id: "deploy-q2",
    question: "HTTP 200 表示什么？",
    options: [
      { key: "A", text: "成功" },
      { key: "B", text: "未找到" },
      { key: "C", text: "服务器错误" }
    ],
    answer: "A",
    explanation: "HTTP 200 表示请求成功。",
    tags: ["web"]
  }
];

async function run() {
  console.log(`Testing API: ${DEFAULT_BASE}`);

  try {
    const login = await request("/login", {
      method: "POST",
      body: JSON.stringify({
        email: `deploy-test-${Date.now()}@example.com`,
        password: "123456"
      })
    });
    token = login.token;
    log(Boolean(login.token && login.user?.email), "login/register");
  } catch (err) {
    log(false, "login/register", err.message);
    return;
  }

  try {
    const upload = await request("/uploadQuestions", {
      method: "POST",
      body: JSON.stringify({
        bankId: "deploy-test-bank",
        name: "部署测试题库",
        questions: sampleQuestions
      })
    });
    log(upload.ok && upload.bank?.count === sampleQuestions.length, "question upload");
  } catch (err) {
    log(false, "question upload", err.message);
  }

  try {
    const submit = await request("/submitAnswer", {
      method: "POST",
      body: JSON.stringify({
        mode: "practice",
        questionId: sampleQuestions[0].id,
        question: sampleQuestions[0],
        answer: "A",
        correct: false,
        analysis: sampleQuestions[0].explanation
      })
    });
    log(submit.progress?.answered >= 1 && submit.wrongAnswers?.length >= 1, "submit answer and wrong record");
  } catch (err) {
    log(false, "submit answer and wrong record", err.message);
  }

  try {
    const exam = await request("/submitAnswer", {
      method: "POST",
      body: JSON.stringify({
        mode: "exam",
        exam: {
          total: 2,
          score: 1,
          submittedAt: new Date().toISOString(),
          details: [
            { questionId: sampleQuestions[0].id, question: sampleQuestions[0], answer: "B", correct: true, analysis: sampleQuestions[0].explanation },
            { questionId: sampleQuestions[1].id, question: sampleQuestions[1], answer: "B", correct: false, analysis: sampleQuestions[1].explanation }
          ]
        }
      })
    });
    log(exam.progress?.answered >= 3, "exam submit flow");
  } catch (err) {
    log(false, "exam submit flow", err.message);
  }

  try {
    const progress = await request("/getProgress");
    log(progress.progress?.answered >= 1, "get progress");
  } catch (err) {
    log(false, "get progress", err.message);
  }

  try {
    const wrong = await request("/getWrongQuestions");
    log(Array.isArray(wrong.wrongAnswers) && wrong.wrongAnswers.length >= 1, "get wrong questions");
  } catch (err) {
    log(false, "get wrong questions", err.message);
  }

  if (MODEL_TEST_ENABLED) {
    try {
      const analysis = await request("/callAnalysis", {
        method: "POST",
        body: JSON.stringify({ question: sampleQuestions[0], userAnswer: "A" })
      });
      log(Boolean(analysis.analysis), "optional model analysis");
    } catch (err) {
      log(false, "optional model analysis", err.message);
    }
  } else {
    console.log("SKIP optional model analysis - set MODEL_TEST_ENABLED=true to enable");
  }
}

run().catch((err) => {
  log(false, "deploy test runner", err.message);
});

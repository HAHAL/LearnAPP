const http = require("http");

const store = new Map();
const PORT = Number(process.env.PORT || 8787);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function emptyUser(email) {
  return {
    email,
    progress: { answered: 0, correct: 0, byQuestion: {} },
    wrongAnswers: [],
    examHistory: [],
    analysisCache: {}
  };
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid json"));
      }
    });
  });
}

function emailFromToken(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("missing token");
  return Buffer.from(token, "base64").toString("utf8").split(":")[0];
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/login") {
      const body = await readBody(req);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) return json(res, 400, { error: "邮箱格式不合法" });
      if (String(body.password || "").length < 6) return json(res, 400, { error: "密码长度必须为 6 到 128 位" });
      const user = store.get(body.email) || emptyUser(body.email);
      store.set(body.email, user);
      return json(res, 200, { token: Buffer.from(`${body.email}:${Date.now()}`).toString("base64"), user });
    }

    const email = emailFromToken(req);
    const user = store.get(email) || emptyUser(email);
    store.set(email, user);

    if (req.method === "POST" && req.url === "/submitAnswer") {
      const body = await readBody(req);
      if (body.mode === "exam") {
        user.examHistory.unshift(body.exam);
      } else {
        user.progress.answered += 1;
        if (body.correct) user.progress.correct += 1;
        user.progress.byQuestion[body.questionId] = { answer: body.answer, correct: Boolean(body.correct) };
        if (!body.correct) user.wrongAnswers.unshift(body);
      }
      return json(res, 200, { progress: user.progress, wrongAnswers: user.wrongAnswers });
    }

    if (req.method === "GET" && req.url === "/getProgress") return json(res, 200, { progress: user.progress });
    if (req.method === "GET" && req.url === "/getWrongQuestions") return json(res, 200, { wrongAnswers: user.wrongAnswers });
    return json(res, 404, { error: "not found" });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
});

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `${response.status}`);
  return data;
}

async function run() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  const results = [];
  try {
    const login = await request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "123456" })
    });
    results.push(["login", Boolean(login.token && login.user)]);

    const auth = { Authorization: `Bearer ${login.token}`, "Content-Type": "application/json" };
    await request("/submitAnswer", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        mode: "practice",
        questionId: "q1",
        question: { id: "q1", question: "1+1=?", answer: "B" },
        answer: "A",
        correct: false,
        analysis: "1+1 等于 2。"
      })
    });

    const progress = await request("/getProgress", { headers: { Authorization: `Bearer ${login.token}` } });
    results.push(["submitAnswer/getProgress", progress.progress.answered === 1 && progress.progress.correct === 0]);

    const wrong = await request("/getWrongQuestions", { headers: { Authorization: `Bearer ${login.token}` } });
    results.push(["getWrongQuestions", wrong.wrongAnswers.length === 1 && wrong.wrongAnswers[0].questionId === "q1"]);
  } finally {
    server.close();
  }

  for (const [name, ok] of results) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
    if (!ok) process.exitCode = 1;
  }
}

run().catch((err) => {
  server.close();
  console.error(`FAIL ${err.message}`);
  process.exitCode = 1;
});

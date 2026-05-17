import { CONFIG, apiFetch } from "./config.js";

const form = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const messageBox = document.querySelector("#message");
const button = document.querySelector("#loginButton");

function setMessage(text, type = "") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`.trim();
}

function validate(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "请输入合法邮箱";
  if (password.length < 6) return "密码至少需要 6 位";
  if (password.length > 128) return "密码过长";
  return "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const error = validate(email, password);
  if (error) {
    setMessage(error, "error");
    return;
  }

  button.disabled = true;
  setMessage("正在登录...");
  try {
    const result = await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (!result?.token || !result?.user) throw new Error("服务端返回缺少 token 或用户信息");
    localStorage.setItem(CONFIG.SESSION_TOKEN_KEY, result.token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(result.user));
    setMessage("登录成功，正在进入练习页", "success");
    location.href = "./quiz.html";
  } catch (err) {
    setMessage(err.message || "登录失败", "error");
  } finally {
    button.disabled = false;
  }
});

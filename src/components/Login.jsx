import { useState } from "react";
import { CONFIG, apiFetch } from "../../js/config.js";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const validation = validate(normalizedEmail, password);
    if (validation) {
      setMessage(validation);
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("正在登录...");
    setMessageType("");
    try {
      const result = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      if (!result?.token || !result?.user) throw new Error("服务端返回缺少 token 或用户信息");
      localStorage.setItem(CONFIG.SESSION_TOKEN_KEY, result.token);
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(result.user));
      setMessage("登录成功");
      setMessageType("success");
      onLogin?.();
    } catch (err) {
      setMessage(err.message || "登录失败");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand">
          <span className="brand-mark">学</span>
          <div>
            <h1>学习题库</h1>
            <p>登录后同步练习进度、错题和考试记录</p>
          </div>
        </div>

        <form className="form-card" onSubmit={handleSubmit} noValidate>
          <label>
            邮箱
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="name@example.com" required />
          </label>
          <label>
            密码
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" minLength="6" placeholder="至少 6 位" required />
          </label>
          <div className={`message ${messageType}`} role="status" aria-live="polite">{message}</div>
          <button type="submit" disabled={loading}>{loading ? "处理中..." : "登录 / 注册"}</button>
        </form>
      </section>
    </main>
  );
}

function validate(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "请输入合法邮箱";
  if (password.length < 6) return "密码至少需要 6 位";
  if (password.length > 128) return "密码过长";
  return "";
}

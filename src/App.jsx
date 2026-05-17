import { useEffect, useMemo, useState } from "react";
import Login from "./components/Login.jsx";
import Quiz from "./components/Quiz.jsx";
import Review from "./components/Review.jsx";
import Exam from "./components/Exam.jsx";
import { getToken } from "../js/config.js";

const routes = {
  login: Login,
  quiz: Quiz,
  review: Review,
  exam: Exam
};

function getHashRoute() {
  return window.location.hash.replace(/^#\/?/, "") || (getToken() ? "quiz" : "login");
}

export default function App() {
  const [route, setRoute] = useState(getHashRoute);
  const [sessionVersion, setSessionVersion] = useState(0);
  const isAuthed = Boolean(getToken());

  useEffect(() => {
    const onHashChange = () => setRoute(getHashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!isAuthed && route !== "login") {
      window.location.hash = "/login";
    }
  }, [isAuthed, route]);

  const Page = useMemo(() => routes[route] || Login, [route]);

  function handleLogin() {
    setSessionVersion((value) => value + 1);
    window.location.hash = "/quiz";
  }

  function handleLogout() {
    localStorage.removeItem("learnapp_session_token");
    localStorage.removeItem("learnapp_user");
    setSessionVersion((value) => value + 1);
    window.location.hash = "/login";
  }

  if (route === "login" || !isAuthed) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div key={sessionVersion}>
      <header className="topbar">
        <a className="logo" href="#/quiz">学习题库</a>
        <nav>
          <a className={route === "quiz" ? "active" : ""} href="#/quiz">练习</a>
          <a className={route === "review" ? "active" : ""} href="#/review">错题</a>
          <a className={route === "exam" ? "active" : ""} href="#/exam">考试</a>
        </nav>
        <button className="secondary compact-button" type="button" onClick={handleLogout}>退出</button>
      </header>
      <Page />
    </div>
  );
}

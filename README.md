# 学习题库 LearnAPP

基于 React + Vite 的学习题库前端，配套阿里云 ESA Edge Functions 后端接口，支持题库导入、练习答题、错题复习、模拟考试、进度同步和可选大模型解析。

## 功能

- 登录 / 注册：通过 Edge Function 创建或读取用户学习数据。
- 题库练习：上传本地 JSON 题库后进行单选 / 多选练习。
- 错题复习：同步读取错题记录，支持关键词筛选和分页查看。
- 模拟考试：随机抽题、倒计时、交卷评分和错题反馈。
- 旧题库兼容：支持 `options` 为数组或对象，单选 / 多选题允许至少一个选项。
- 部署支持：可部署到阿里云 ESA Pages + ESA Edge Functions。

## 技术栈

- React 18
- Vite
- ESA Pages
- ESA Edge Functions
- OSS JSON 用户数据存储

## 目录结构

```text
src/
  App.jsx
  main.jsx
  components/
    Login.jsx
    Quiz.jsx
    Review.jsx
    Exam.jsx
js/
  config.js
  oss_api.js
  analysis.js
css/
  style.css
server/edge-functions/
scripts/
tests/
```

## 本地开发

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

构建生产版本：

```bash
npm run build
```

预览构建产物：

```bash
npm run serve
```

## 本地接口调试

启动 ESA Functions 本地调试：

```bash
bash scripts/local-debug.sh
```

Vite 已将 `/api` 代理到默认本地 Edge Function 地址：

```text
http://127.0.0.1:8787
```

## 题库 JSON 格式

支持题目数组，或包含 `questions` 字段的对象。

```json
[
  {
    "id": 1,
    "type": "multiple",
    "question": "以下哪些选项正确？",
    "options": {
      "A": "选项 A",
      "B": "选项 B"
    },
    "answer": ["A", "B"],
    "explanation": "解析内容"
  }
]
```

字段说明：

- `type`：必填，取值为 `single` 或 `multiple`。
- `question`：必填，题干。
- `options`：必填，支持对象 `{ "A": "..." }` 或数组格式，至少一个选项。
- `answer`：必填，支持字符串、数字索引或数组。
- `explanation`：可选，题目解析。
- `tags`：可选，标签数组。

## 测试

运行核心 sanity 测试：

```bash
node tests/sanity_test.js
```

运行部署联调测试：

```bash
API_BASE_URL=http://127.0.0.1:8787/api node tests/deploy_test.js
```

## 部署

部署到阿里云 ESA Pages + ESA Edge Functions 的完整说明见：

```text
README_DEPLOYMENT.md
```

生产环境请通过环境变量或 GitHub Secrets 注入 OSS Key、大模型 API Key 和 CORS 白名单，不要把密钥写入前端代码。

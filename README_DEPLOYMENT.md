# 学习题库项目部署与测试指南

本文档用于将当前项目部署到阿里云 ESA Pages + ESA Edge Functions，并通过 GitHub 自动拉取部署。

## 1. GitHub Secrets 配置

在 GitHub 仓库进入 `Settings -> Secrets and variables -> Actions`，新增以下 Secrets：

| Secret | 说明 |
| --- | --- |
| `ALICLOUD_ACCESS_KEY_ID` | 阿里云 RAM 用户 AccessKey ID |
| `ALICLOUD_ACCESS_KEY_SECRET` | 阿里云 RAM 用户 AccessKey Secret |
| `OSS_BUCKET` | 用户数据存储 Bucket |
| `OSS_REGION` | OSS 区域，例如 `oss-cn-hangzhou` |
| `MODEL_API_KEY` | 大模型 API Key，可为空但不能写入前端 |
| `CORS_ALLOWED_ORIGINS` | 允许访问 API 的前端域名，例如 `https://learn.example.com` |

建议同时在 `Variables` 中配置：

| Variable | 默认值 |
| --- | --- |
| `ESA_PROJECT_NAME` | `learnapp-question-bank` |
| `MODEL_API_ENABLED` | `false` |
| `MODEL_API_URL` | `https://api.openai.com/v1/chat/completions` |
| `MODEL_NAME` | `gpt-4o-mini` |

安全建议：使用最小权限 RAM 用户，只授予 ESA Functions and Pages 部署权限以及必要 OSS 权限。

## 2. ESA Pages + Edge Functions 部署流程

项目已经迁移为 React + Vite。项目根目录包含 `esa.jsonc`：

- `entry`: `./server/edge-functions/index.js`
- `installCommand`: `npm install`
- `buildCommand`: `npm run build`
- `assets.directory`: `dist`
- API 路由：`/api/*`
- 前端静态资源：Vite 构建产物 `dist/`

部署命令：

```bash
export ALICLOUD_ACCESS_KEY_ID="your-ak"
export ALICLOUD_ACCESS_KEY_SECRET="your-sk"
export OSS_BUCKET="your-bucket"
export OSS_REGION="oss-cn-hangzhou"
export CORS_ALLOWED_ORIGINS="https://your-esa-pages-domain.example.com"
export MODEL_API_ENABLED="false"

bash scripts/deploy.sh
```

脚本会执行：

1. 检查 Node.js 和 npm。
2. 安装 `esa-cli`。
3. 登录或读取环境中的阿里云凭证。
4. 校验必要环境变量。
5. 执行 `npm install`。
6. 执行 `npm run build` 生成 `dist/`。
7. 执行 `esa-cli commit`。
8. 执行 `esa-cli deploy`。

## 3. GitHub 自动部署

工作流文件位于 `.github/workflows/esa-deploy.yml`。

触发方式：

- push 到 `main`
- push 到 `master`
- 手动 `workflow_dispatch`

工作流会：

1. 拉取仓库代码。
2. 安装 Node.js 20。
3. 安装 ESA CLI。
4. 安装前端依赖。
5. 构建 React + Vite 前端。
6. 校验 GitHub Secrets。
7. 调用 `scripts/deploy.sh` 部署 Pages + Edge Functions。

## 4. 本地调试

启动 ESA 本地调试：

```bash
bash scripts/local-debug.sh
```

默认端口为 `8787`，API 地址：

```text
http://127.0.0.1:8787/api
```

指定端口：

```bash
PORT=8899 bash scripts/local-debug.sh
```

运行本地联调测试：

```bash
API_BASE_URL=http://127.0.0.1:8787/api node tests/deploy_test.js
```

启动 Vite 前端开发服务器：

```bash
npm install
npm run dev
```

默认前端地址为：

```text
http://127.0.0.1:5173
```

Vite 已在 `vite.config.js` 中将 `/api` 代理到 `http://127.0.0.1:8787`。

## 5. 线上部署验证

部署完成后运行：

```bash
API_BASE_URL=https://your-domain.example.com/api node tests/deploy_test.js
```

如果已启用大模型解析：

```bash
MODEL_TEST_ENABLED=true API_BASE_URL=https://your-domain.example.com/api node tests/deploy_test.js
```

测试覆盖：

- 登录 / 注册接口。
- 题库上传接口。
- 答题提交与错题记录。
- 模拟考试提交流程。
- 学习进度读取。
- 错题读取。
- 可选大模型解析。

## 6. 密钥和安全

必须遵守：

- 不要把 OSS Key 或大模型 API Key 写入 `js/config.js` 或任何前端文件。
- React 前端只保留公开配置，不保存任何 OSS Key 或大模型 API Key。
- 前端只调用 `/api/*` Edge Function。
- OSS 和大模型 API 只允许 Edge Function 通过环境变量访问。
- `CORS_ALLOWED_ORIGINS` 只填写真实前端域名，生产环境不要使用 `*`。
- `MODEL_API_ENABLED=false` 时，`/api/callAnalysis` 会拒绝调用。

## 7. 部署前检查清单

- `esa.jsonc` 已提交到仓库根目录。
- `npm run build` 能成功生成 `dist/`。
- GitHub Secrets 已配置完整。
- ESA 项目名称与控制台一致。
- 前端页面域名已加入 `CORS_ALLOWED_ORIGINS`。
- OSS Bucket 已创建，并允许 Edge Function 使用对应凭证读写。
- `node tests/deploy_test.js` 已对本地或线上 API 通过。

## 8. 参考

- 阿里云 ESA Pages 支持在仓库根目录使用 `esa.jsonc` 配置入口、构建命令和静态资源目录。
- 阿里云 ESA CLI 支持 `esa-cli dev` 本地调试，以及 `esa-cli commit` / `esa-cli deploy` 提交和部署版本。

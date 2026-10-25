# Android Interview Lab

Android 资深工程师面试知识库，采用 React、TypeScript、Vite 和 Markdown，部署到 GitHub Pages。默认自由阅读，进度和练习可单独开启。

仓库：[CodeReverse/android-lab](https://github.com/CodeReverse/android-lab)。Pages 配置成功后的默认地址为 `https://codereverse.github.io/android-lab/`，实际发布状态以 Actions 和 Settings → Pages 为准。

## 内容与功能

- 69 篇学习正文，其中 64 篇按面试官视角逐层追问，每问直接附答案。
- 12 个可见分类：Android、计网、跨端、Java/Kotlin、Compose、算法、AI，以及技术决策、诊断、性能、架构与项目证据。
- AI 专题含 18 篇正文：通用模型、RAG、Agent、端侧引擎、量化、部署、评测与多模态。
- 7 份面经的 75 项解答，含四份 AI 面经的 26 项节选；原题、原创答案和编辑追问分别标注。
- Compose、AI、运行时与并发三条专题路径；9 道有出处的 LeetCode 中国原题。
- Compose 十一阶段对应 16 篇正文，56 组知识点标注文章与问题编号；涵盖基础开发、状态、运行时、编译、交互、测试及迁移。
- 全文搜索、专题筛选、收藏、笔记、Markdown 导出、JSON 备份与恢复、可选学习进度和练习。

内容是原创综合讲解，原理依据与面经证据分别标注。文中的实验建议不代表已经实际执行；实现细节需按讨论版本核验。正文维护目录见 [内容索引](content/CONTENT_INDEX.md)，写作方式见 [逐层追问规范](content/ARTICLE_TEMPLATE.md)。

## 本地运行

使用 Node.js 24 或更高版本，推荐与 `.nvmrc` 和 CI 保持一致。

```sh
npm ci
npm run dev
```

默认访问 `http://127.0.0.1:5173/`。端口已被占用时以终端输出为准。

```sh
npm run content:sync
npm test
npm run typecheck
npm run build
npm run check:dist
npm run preview
```

以上构建默认以根路径部署。模拟当前 GitHub 仓库子目录：

```sh
PAGES_BASE_PATH=/android-lab/ npm run build
PAGES_BASE_PATH=/android-lab/ npm run check:dist
PAGES_BASE_PATH=/android-lab/ npm run preview
```

预览访问 `http://127.0.0.1:4173/android-lab/`。路由使用 hash，例如 `#/paths/ai`、`#/paths/runtime`、`#/article/jvm-runtime`，无需服务器路由重写。

## GitHub Pages 发布

1. 在仓库 Settings → Pages → Build and deployment 中，将 Source 设置为 **GitHub Actions**。
2. 推送到 `main`，或在 Actions 手动运行 **Build and deploy Android Lab**。
3. 工作流安装锁定依赖、同步内容、运行测试与类型检查，构建静态资源后发布 `dist/`。
4. 在 Actions 的 `github-pages` 环境或仓库 Pages 设置中查看最终链接。

工作流使用 GitHub 自动提供的 `GITHUB_TOKEN` 和 OIDC，不需要在仓库填写个人 Token。PR 运行构建检查，但不会发布。部署路径由 `configure-pages` 输出，因此可以适配仓库子目录或后来配置的独立域名。

只上传 `dist/` 作为网站产物；它不含服务端运行时。这个 GitHub 版本不依赖原托管平台的认证、数据库或 Worker 配置。

## 内容更新

1. 修改 `content/source/lessons/` 下的 Markdown。
2. 新增文章时登记 `content/articles.json`；保持稳定 ID，更新 `version` 和 `updated`。
3. 路径在 `content/learning-paths.json` 中维护，分类在 `content/categories.json` 中维护。AI 原帖与节选范围在 `content/ai-research.json`。
4. 运行内容同步、测试和类型检查，提交并推送到 `main`，网站自动更新。

`content/generated.json` 由脚本生成，不手工编辑。正文的 `## 第 1 问：...` 自动生成目录和问数；构建检查编号、答案正文和内部链接。结构检查不能替代技术内容核验。

网站是静态知识库，目前没有后台自动采集或模型调用。

## 个人数据

笔记、收藏、设置、进度和练习保存在浏览器 IndexedDB，不会写回 GitHub。内容公开不代表个人学习记录会上传。

本地地址与 Pages 域名是不同的存储来源：迁移前在旧站设置中导出 JSON，再到新站导入。更换浏览器、清除网站数据或使用其他设备不会自动同步。导入备份会提示确认后替换相应个人数据。

## 检查边界

测试覆盖分类隔离、路径和正文链接、面经节选对应、连续问答、全文检索、备份和功能开关。构建产物检查验证子目录资源链接和文件存在性。浏览器视觉与端到端交互仍需人工验收，命令行检查不等同于浏览器验收。

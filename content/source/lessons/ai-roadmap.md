## 本轮扩展如何使用

面向已有 12 年经验、准备资深岗位的工程师，AI 应覆盖通用模型机制、应用系统、端侧运行和工程决策，而不只学习 Android SDK。本专题现在有 18 篇学习正文（含本篇与原有两篇），另外提供四份公开面经的 26 道 AI 专项节选答案。阅读、收藏和搜索可以独立使用，进度与练习仍由你自行开启。

建议从下面任一主线进入。每篇都包含原理、工程限制、可回答的追问和验证方法；没有做过的实验只写成建议方案，不包装成个人成果。正文的 primary category 都是 AI；网络、语言与性能相关文章只做延伸链接，不改变所属分类。

## 先补通用底座，再按方向下钻

|层次|阅读顺序|学完应能解释|
|---|---|---|
|基础机制|[Transformer](#/article/ai-transformer) → [训练与适配](#/article/ai-training) → [推理与 KV](#/article/ai-inference)|为什么训练可并行而生成迭代，微调与检索各解决什么，缓存内存怎么算|
|AI 应用|[RAG 全链路](#/article/ai-rag-pipeline) → [检索底层](#/article/ai-retrieval) → [Agent](#/article/ai-agent-runtime) → [工具与上下文](#/article/ai-tools-context)|资料、召回、生成分别如何出错；动作由谁授权、提交和恢复|
|质量与研发|[质量工程](#/article/ai-quality) → [AI Coding](#/article/ai-coding) → [服务系统](#/article/ai-serving)|用什么证据证明更好，如何压测、控制成本和回滚|
|端侧专项|[端云架构](#/article/ai-edge-architecture) → [引擎选型](#/article/ai-edge-runtime) → [量化](#/article/ai-quantization) → [性能与发布](#/article/ai-edge-performance) → [多模态](#/article/ai-multimodal)|为什么能运行却不好用，CPU/GPU/NPU 怎样适配，内存、热和质量如何权衡|
|客户端连接|[流式交互](#/article/ai-client) → [原有 RAG 与评测入门](#/article/ai-evaluation)|取消、重连、旧结果丢弃与应用质量怎样闭环|

面向通用资深移动岗位，优先 AI 应用、端侧专项与质量工程；面向 AI Infra，再深入服务调度、量化内核与硬件；面向算法研发，本文训练章节只是入口，还需独立训练、数学推导与数据实践。这是基于岗位责任的编辑建议，不是某公司的统一职级标准。

## 近期面经取样与可核验范围

检索窗口以近一两年为目标，核验时间为 **2026-10-06**。只用国内公司、中文网络的第一人称公开面经作题目证据；技术答案另查论文与官方资料。以下四篇是定向检索的便利样本，偏向应用／后端和校招，不代表 P7 题目分布，也不足以计算全行业高频排行榜。

|原始来源|日期依据|本次解答范围|
|---|---|---|
|[字节 AI Infra](https://www.nowcoder.com/feed/main/detail/45814e935b894c4fb13d5a72c81e23a6)|原页显示 03-03；正文元数据 createdAt=1772537400000，对应北京时间 2026-03-03；面试日期未明|第 2–7 项，[6 问详解](#/article/interview-ai-infra-byte)|
|[腾讯 AI 平台](https://www.nowcoder.com/feed/main/detail/a2ca69a0a94441a3a0324385670d7f97)|2025-12-29 发布；正文称 9/16 面试，未单独写面试年份|八股前 4 项，[4 问详解](#/article/interview-ai-tencent)|
|[字节 Agent 开发](https://www.nowcoder.com/discuss/929406267141914624?sourceSSR=dynamic)|页面显示 09-15，正文称 9.15；年份未明确核验，保留该限制|第 4–6、12–13、16–18 项，[8 问详解](#/article/interview-ai-agent-byte)|
|[千问 AI 研发](https://www.nowcoder.com/feed/main/detail/ebf0ec03e5ee4fa8a140cc8d247b1e20?sourceSSR=dynamic)|正文元数据 createdAt=1789977653000，对应北京时间 2026-09-21；正文称 9/16 面试|第 1–3、5–6、8–10 项，[8 问详解](#/article/interview-ai-qwen)|

日期是发布、编辑或面试时间时分别标注。题目是简短语义转述，答案为知识库原创，并非候选人原回答或公司官方答案。选出的 AI 条目之外，普通后端八股、个人项目与算法未在这些节选中冒充已解答；原有力扣题单不因这批 AI 文章自动扩张。

## 哪些问题值得优先准备

**跨样本重复出现的方向**：Agent 控制与工具边界、RAG 的流程与存储。题目可串成“什么时候用 Agent → 工具参数如何校验 → 超时是否重复执行 → 如何验证任务成功”，以及“知识怎么进库 → 如何切块和召回 → 引用是否支持答案”。先能回答完整链路，再记框架名。

**样本中出现但不能据此称全行业高频**：KV、分页／前缀缓存与量化见字节 Infra；AI 代码审查见字节 Agent；Skill、Harness 与循环终止见千问。它们有具体选题依据，可以沿对应正文深入，但不凭一帖判断所有岗位都会考。

**按资深能力主动补充**：Transformer、训练方法、端侧引擎、CPU/GPU/NPU 回退、持续温升、模型分发、多模态时序。这批面经没有直接覆盖全部这些内容；之所以收录，是因为技术负责人需要解释选型和失败边界，尤其用户希望补齐端侧 AI。

## 我作为面试官会怎样深入

假设你说“在手机上做了离线助手”，我会先问目标用户与质量基线，再问模型和引擎为什么这样选；继续算权重／KV／工作区内存，追问不支持的算子在哪里跑；然后加入后台切换、发热、模型下载一半断网、账号切换和云端失败；最后看机型矩阵、任务成功率、能耗、灰度与回滚证据。

如果你说“用 RAG 提升准确率”，我会要求拆出缺资料、漏召回、上下文丢失和生成错误；再追问评测集是否泄漏、权限是否过滤、检索与生成各自提升多少；最终看配对样本变化和线上成本。术语越多不会抵消证据不足，深入到底层的目的仍是解释设计和故障。

## 后续怎样持续扩展

新来源先核验原帖、公司、日期类型、原题与可访问范围；聚合题库只当检索线索，不能凭“千万次面试统计”之类营销数字赋予热度。优先收集独立作者、不同公司和社招样本，再更新主题判断。暂时无法访问的正文不标为已核验。

知识正文维护在 Markdown，来源与路径维护在元数据；新增文章不依赖个人进度。模型／引擎文档变动时更新适用范围，保留稳定文章 ID 和版本提示。本站目前采用人工核验后更新，没有后台自动抓取或隐含的模型调用。

## 原理依据与适用边界

本文是结合机制与工程约束的原创讲解。官方资料用于核对机制，工程方案是可讨论的设计建议；文中的推演与实验步骤不是已运行的测试结果。实现细节应以项目锁定的依赖版本为准。

- [Transformer 原论文](https://arxiv.org/abs/1706.03762)
- [Google LiteRT 官方入口](https://developers.google.com/edge/litert)
- [ExecuTorch 执行与编译机制](https://docs.pytorch.org/executorch/stable/intro-how-it-works.html)
- [Anthropic：Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)

## 面经如何映射到本篇

下列原帖只证明曾考察相应主题，不证明本文答案，也不代表该公司所有团队或资深岗位的统一要求。样本不足以计算行业频率。

- [字节校招 AI infra 后端面经](https://www.nowcoder.com/feed/main/detail/45814e935b894c4fb13d5a72c81e23a6)：用于推理与量化选题，不推断行业频率。
- [腾讯 AI 平台部一面凉经](https://www.nowcoder.com/feed/main/detail/a2ca69a0a94441a3a0324385670d7f97)：用于 Agent 与 RAG 选题。
- [字节跳动 Agent 开发一面凉经](https://www.nowcoder.com/discuss/929406267141914624?sourceSSR=dynamic)：用于 RAG、工具与研发质量选题。
- [千问 AI 研发一面凉经](https://www.nowcoder.com/feed/main/detail/ebf0ec03e5ee4fa8a140cc8d247b1e20?sourceSSR=dynamic)：用于 Agent 运行可靠性与 Harness 选题。

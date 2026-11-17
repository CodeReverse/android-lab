# 非 Compose 教程重写与事实核对记录

日期：2026-11-17。本轮重写原有 53 篇非 Compose 学习文章，新增 AI 基础、Agent 实验两篇。16 篇 Compose 学习正文、7 篇明确面经及另 3 篇独立学习指南保持原文；Compose 路线文档仅更新日期与版本。全站现有 71 篇学习文章，其中 AI 20 篇。

## 阅读方式与逐篇范围

正文以具体情境起步，让最小实现暴露问题，再解释机制、设计理由、替代方案与边界；文末提炼 3–5 个问题。以下表格是复核入口，不以篇幅、字数或自动评分证明内容已经“讲透”。原文章 ID、分类和面经证据关联保持不变。

AI 默认读者具备软件开发经验，但不预设机器学习基础。新增入口依次解释模型、训练与推理、向量和矩阵、神经网络、token 与概率、上下文和记忆，再用一个完整的只读 Agent 宿主建立应用闭环。其余 AI 正文在首次出现术语时补充含义，并链接相关前置章节；模型机制、RAG、Agent、评测和端侧工程仍可分别选择阅读。

| 文章 | 本文教学主线 |
| --- | --- |
| [binder](source/lessons/binder.md) | 沿播放器远程调用追踪 Proxy、Parcel、Stub，解释同步等待、重入、身份与死亡恢复。 |
| [state-restoration](source/lessons/state-restoration.md) | 围绕搜索页推导轻量状态、重建输入、Fragment 视图寿命及进程回收后的业务恢复。 |
| [view-rendering](source/lessons/view-rendering.md) | 从进度条更新手算测量约束，串起失效、布局、绘制、缓冲合成与帧诊断。 |
| [dns-routing](source/lessons/dns-routing.md) | 沿一次请求区分 DNS、地址竞速、连接复用与 TLS 身份；用 TTL 和分阶段时序推导定位方法。 |
| [tcp-tls](source/lessons/tcp-tls.md) | 从丢失的响应追到 TCP 字节流、TLS 身份、HTTP/2/3 队头阻塞及业务提交边界。 |
| [http-cache](source/lessons/http-cache.md) | 从一份文章响应演算年龄、条件验证与 304，再扩展到语言、账号隔离和离线陈旧数据。 |
| [okhttp-chain](source/lessons/okhttp-chain.md) | 按 OkHttp 4.12.0 追踪请求链，演算调度上限，解释响应体、连接复用与取消所有权。 |
| [network-reliability](source/lessons/network-reliability.md) | 从付款超时推导结果未知、总截止时间、稳定操作 ID、并发去重和故障恢复。 |
| [coroutines](source/lessons/coroutines.md) | 把两次加载改写成恢复状态机，解释直接返回、调度、父子失败和取消时的资源交付。 |
| [flow-state](source/lessons/flow-state.md) | 演算冷流重复执行、背压与缓冲时序，再解释 flowOn、共享寿命、equals 和监听器清理。 |
| [collections](source/lessons/collections.md) | 用桶索引扩容与可变 key 演算 HashMap，再区分只读、浅拷贝及并发容器的事务边界。 |
| [flutter-runtime](source/lessons/flutter-runtime.md) | 沿列表插入解释 Widget/Element/State 身份，再推导布局绘制、Channel、isolate 与混合栈成本。 |
| [rn-architecture](source/lessons/rn-architecture.md) | 沿收藏更新走过 JSI、Fabric 的 Render/Commit/Mount，区分模块契约、线程瓶颈与迁移证据。 |
| [kmp-boundaries](source/lessons/kmp-boundaries.md) | 从两端优惠规则引出共享边界、接口与 expect/actual，再处理 Swift 异步和 Native 内存。 |
| [cross-boundaries](source/lessons/cross-boundaries.md) | 从分享回调串页设计请求表、会话身份、授权、背压和能力协商，推演迟到与重复结果。 |
| [anr-diagnosis](source/lessons/anr-diagnosis.md) | 从触发类型和时间窗画等待链，区分计算、阻塞与调度，验证后台化后的资源竞争。 |
| [performance-proof](source/lessons/performance-proof.md) | 用构造样本比较平均与中位数，说明控制变量、trace 因果、成本转移和结论边界。 |
| [startup-governance](source/lessons/startup-governance.md) | 手算启动依赖图的关键路径，区分 TTID/TTFD、并行、懒加载与两种 Profile。 |
| [technology-decisions](source/lessons/technology-decisions.md) | 以优惠规则共享为教学案例，比较基线、设计 spike、记录 ADR，并定义双跑与回退条件。 |
| [architecture-evolution](source/lessons/architecture-evolution.md) | 从两页收藏状态漂移推导所有权、依赖方向、适配器迁移、状态机与回退验收。 |
| [offline-data](source/lessons/offline-data.md) | 逐步推演本地事务、Outbox、响应丢失、旧结果覆盖、删除标记与账号隔离。 |
| [project-evidence](source/lessons/project-evidence.md) | 把成果声明拆成事实、假设、决策和验证，区分个人贡献、团队结果与可支持的结论。 |
| [testing-strategy](source/lessons/testing-strategy.md) | 用旧响应覆盖案例构造确定性反例，解释单元、数据库、契约、属性与平台测试的边界。 |
| [build-release](source/lessons/build-release.md) | 从构建失效追到输入声明和三种缓存，再用反射示例解释 R8、制品证据与数据回滚。 |
| [ai-client](source/lessons/ai-client.md) | 先解释流式与 SSE，再用拆包例子推导解析、会话状态、取消、续传和工具交付边界。 |
| [ai-evaluation](source/lessons/ai-evaluation.md) | 用答错版本的知识助手，从简单检索基线到证据替换实验，定位 RAG 与生成的失效层。 |
| [android-security](source/lessons/android-security.md) | 沿外部订单链接划分输入、身份和授权，解释组件、URI 分享、WebView 与密钥保护边界。 |
| [senior-capability-map](source/lessons/senior-capability-map.md) | 围绕重复提交与慢首屏，串起机制诊断、范围决策、持续治理和个人贡献证据。 |
| [ai-transformer](source/lessons/ai-transformer.md) | 从 token、向量形状和投影算起，手算 Attention，继续解释多头、RoPE 与逐步生成。 |
| [ai-training](source/lessons/ai-training.md) | 先区分知识与行为缺口，再手算 SFT 损失、LoRA 参数、DPO 偏好和 GRPO 组内优势。 |
| [ai-inference](source/lessons/ai-inference.md) | 区分参数与运行数据，逐步走过 Prefill/Decode 并算出 512 MiB KV，再解释分页与前缀复用。 |
| [ai-serving](source/lessons/ai-serving.md) | 从服务、batch 和延迟概念讲起，用请求时间线解释连续批处理、准入与投机解码。 |
| [ai-rag-pipeline](source/lessons/ai-rag-pipeline.md) | 从 RAG 和文档片段的定义讲起，沿政策 PDF 推导切块、权限、版本、召回、引用与更新。 |
| [ai-retrieval](source/lessons/ai-retrieval.md) | 从精确搜索与语义搜索出发，手算 BM25、向量相似度和 RRF，解释 HNSW 与重排取舍。 |
| [ai-agent-runtime](source/lessons/ai-agent-runtime.md) | 先区分模型与宿主，再沿报销任务建立行动循环、状态机、预算、恢复和多 Agent 边界。 |
| [ai-tools-context](source/lessons/ai-tools-context.md) | 从工具与参数 schema 讲起，解释 MCP 三角色、错误协议、Skill、Memory 和上下文管理。 |
| [ai-quality](source/lessons/ai-quality.md) | 从评测术语和任务判据讲起，演算 precision/recall，设计分层评测、Judge 校准与失败回归。 |
| [ai-coding](source/lessons/ai-coding.md) | 从建议代码与工具型 Agent 的区别讲起，用并发补丁解释上下文、独立验证器和执行证据。 |
| [ai-edge-architecture](source/lessons/ai-edge-architecture.md) | 先区分分类、向量与生成任务，再算端侧内存，推导端云路由、硬件回退和降级语义。 |
| [ai-edge-runtime](source/lessons/ai-edge-runtime.md) | 先讲模型图、算子、kernel 与后端，再比较六类引擎并推导转换、数值和资源所有权。 |
| [ai-quantization](source/lessons/ai-quantization.md) | 从 bit、整数与浮点讲起，手算量化误差，再解释离群值、PTQ/QAT、AWQ/GPTQ 和 KV。 |
| [ai-edge-performance](source/lessons/ai-edge-performance.md) | 从延迟、吞吐和内存口径讲起，分析冷热运行、模型切换峰值、带宽、温升与制品发布。 |
| [ai-multimodal](source/lessons/ai-multimodal.md) | 先定义 ASR/VAD/OCR/VLM，再沿票据助手解释分段、选帧、背压、时间戳和坐标映射。 |
| [ai-roadmap](source/lessons/ai-roadmap.md) | 先读 AI 基础和可运行 Agent 例子，再按文档助手需求进入模型、RAG、工具、评测与端侧。 |
| [jvm-runtime](source/lessons/jvm-runtime.md) | 手算 add 字节码，再追 new、类初始化、加载器身份、Metaspace 与 JIT，区分 JVM 与 ART。 |
| [java-threads](source/lessons/java-threads.md) | 从缩略图任务追到线程状态、线程池排队、拒绝、取消与等待环，按资源建立容量边界。 |
| [java-locks](source/lessons/java-locks.md) | 从最后一张票推导不变量、监视器、CAS、AQS 与 Condition，再用等待图分析死锁。 |
| [gc-runtime](source/lessons/gc-runtime.md) | 从页面保留链理解可达性，追到搬迁、跨代引用、写屏障、并发标记与 G1 的资源取舍。 |
| [handler](source/lessons/handler.md) | 按 Android 14 固定源码推演投递、排序、分派、等待唤醒、屏障和页面引用链。 |
| [memory-art](source/lessons/memory-art.md) | 从 DEX 执行讲到 JIT/AOT、进程内存、RSS/PSS、JNI 和 Bitmap，区分 OOM 与系统终止。 |
| [oom-diagnosis](source/lessons/oom-diagnosis.md) | 计算图片重叠峰值，辨认三种内存曲线，再追根路径、native/线程资源与预算验证。 |
| [jmm-concurrency](source/lessons/jmm-concurrency.md) | 从一次数据发布推导 happens-before，演算复合操作竞态并解释 final、快照与 DCL。 |
| [runtime-roadmap](source/lessons/runtime-roadmap.md) | 用退出页面后仍运行的任务，串起引用图、等待图、结果代次与 JVM/ART/OOM 学习入口。 |
| [ai-foundations](source/lessons/ai-foundations.md) | 手算一次参数更新和 token 概率，解释向量、神经网络、训练/推理、上下文与外部记忆，建立 AI 全景。 |
| [ai-agent-workshop](source/lessons/ai-agent-workshop.md) | 从固定函数链到三轮工具循环，用完整 Python 示例解释模型替身、宿主校验、观察、引用和生产边界。 |

## 来源与版本边界

- JVM/JMM 以 Java 21 的规范职责为边界，HashMap 对照 OpenJDK `jdk-21+35`；规范、HotSpot 实现与 Android ART 分开描述。
- Handler/MessageQueue 对照 AOSP `android-14.0.0_r1`，按入队、唤醒、取队、分发与回调引用解释。简化流程标为教学模型，不冒充完整源码。
- OkHttp 固定 `parent-4.12.0`，核对拦截器顺序、Dispatcher 同步/异步差异与 DNS 接口。复核时将错误的 Dns SAM 写法改为该版本实际支持的对象实现；没有声称 Kotlin 片段已经编译。
- 网络机制引用 RFC 与库官方文档；案例中的域名解析过程是明确假设，不是线上抓包结果。缓存验证命中与完整响应、连接失败与业务结果未知分别解释。
- Flutter/RN/KMP 的运行时边界与平台能力依据官方资料，不从技术宣传推断具体公司采用率。Compose Multiplatform 与 Android Jetpack Compose 的范围分开。
- AI 数学例子为明确的教学演算；模型结构、训练、推理优化与检索引用原论文及官方资料。Lucene 9.12.0 的 BM25 实现与常见公式在共同缩放因子上的差别已注明，未声称示例等于其实际分数。
- MCP 按 2025-11-25 规范、vLLM 前缀缓存按 0.8.4 文档限定讨论；框架、协议、模型与宿主权限不混为一层。
- 原面经研究日期与链接保留。没有把本次教程重写包装成新一轮面经检索，也没有编造面试频率、公司项目经历或跑分。
- 本轮 55 篇新增/重写学习正文的注册来源去重后共 129 个 URL，HTTP 可达性检查全部返回 200。可达性只说明链接能访问，不能替代对具体论点与来源内容的核对。

## 学习指南重复标题修复

原路线中的一个章节被提取为独立页面时，源章节标题及其编号仍留在正文；页面自身又显示一次相同标题。内容同步现在只去除与页面标题等价的首个 Markdown 标题，保留真正的内容小节。11 个 Compose 阶段页面从“本阶段重点”开始；没有小节目录时隐藏目录开关和空目录区域。其他被提取的同名章节也应用相同规则。

## 已执行的验证及其局限

- 内容同步：103 条内容记录；检查分类、文章 ID、站内章节链接及生成结果。
- 范围核对：53 篇原文全部发生修改、版本各增加 1；分类和原面经证据不变；新增 2 篇；16 篇 Compose 正文、7 篇面经和 3 篇独立指南的注册信息与原文保持不变。
- 网站：25 个测试通过，TypeScript 检查通过；更新脚本语法检查通过；以 `/android-lab/` 基路径构建及静态资源路径检查通过。
- Agent 实验：执行文章完整 Python 标准库代码的正常路径，并验证未知工具、非字符串工具名、额外参数、未读引用、越权文档引用、步数耗尽六类拒绝路径。测试使用确定性模型替身，不调用模型服务。
- 未执行 Android/JVM 示例工程编译、设备测试、真实模型推理/训练、线上性能实验或浏览器视觉验收；文章中的教学代码、伪代码、计算预期和已运行实验分别标注，不混用证据。

后续自动更新继续生成待审核草稿。生成规则已补充 AI 前置概念、数值含义、模型/宿主职责与完整调用链要求，并将两篇入门文章及真实章节链接加入 AI 生成上下文；来源可靠性、教学连续性与示例边界仍须人工复核。

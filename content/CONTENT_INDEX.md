# 知识正文与面经详解目录

更新：2026-10-27。69 篇学习正文采用连续讲解与文末面试提炼；明确面经保留逐题答案。

## Android 相关技术

- [Handler 原理：从线程通信到消息队列、唤醒与泄漏](source/lessons/handler.md) — 学习文章；文末复习 5 问
- [Binder IPC：代理、线程池、同步等待与死亡恢复](source/lessons/binder.md) — 学习文章；文末复习 5 问
- [生命周期与状态恢复：旋转、返回栈和进程死亡](source/lessons/state-restoration.md) — 学习文章；文末复习 5 问
- [View 渲染：从 requestLayout 到屏幕上的一帧](source/lessons/view-rendering.md) — 学习文章；文末复习 4 问
- [构建与发布工程：Gradle、R8、兼容性与灰度回滚](source/lessons/build-release.md) — 学习文章；文末复习 5 问
- [Android 安全边界：组件暴露、凭据、链接与数据归属](source/lessons/android-security.md) — 学习文章；文末复习 5 问
- [ART 内存原理：DEX 执行、对象、Native 与系统回收](source/lessons/memory-art.md) — 学习文章；文末复习 5 问
- [近期中文面经与来源边界](source/Android-P7-面试准备项目方案-v1.md) — 面经索引

## 计算机网络

- [DNS 与连接建立：域名解析慢，应该查哪一层](source/lessons/dns-routing.md) — 学习文章；文末复习 5 问
- [TCP、TLS 与 HTTP/2/3：可靠传输不等于业务成功](source/lessons/tcp-tls.md) — 学习文章；文末复习 5 问
- [HTTP 缓存：新鲜度、条件请求与账号隔离](source/lessons/http-cache.md) — 学习文章；文末复习 5 问
- [OkHttp：拦截器、调度、连接池和取消的边界](source/lessons/okhttp-chain.md) — 学习文章；文末复习 5 问
- [弱网可靠性：超时、重试、幂等与未知结果](source/lessons/network-reliability.md) — 学习文章；文末复习 5 问
- [网络学习主线：请求过程、客户端实现与失败恢复](source/guides/network-syllabus.md) — 学习指南；文末复习 3 问

## 跨端技术

- [JSBridge 与跨端协议：权限、版本、线程和生命周期](source/lessons/cross-boundaries.md) — 学习文章；文末复习 5 问
- [Flutter：Widget、Element、RenderObject 与混合栈成本](source/lessons/flutter-runtime.md) — 学习文章；文末复习 5 问
- [React Native：从旧 Bridge 到 JSI、Fabric 与 TurboModules](source/lessons/rn-architecture.md) — 学习文章；文末复习 5 问
- [KMP 与 Compose Multiplatform：共享逻辑还是共享界面](source/lessons/kmp-boundaries.md) — 学习文章；文末复习 5 问
- [跨端技术：全景、取舍与 App 实践](source/跨端技术对比与应用案例设计.md) — 对比与案例
- [先区分比较层次](source/跨端技术对比与应用案例设计.md) — 对比与案例
- [第一层比较：优点、代价和适用场景](source/跨端技术对比与应用案例设计.md) — 对比与案例
- [第二层比较：资深面试需要展开的维度](source/跨端技术对比与应用案例设计.md) — 对比与案例
- [场景选型：从约束推出候选方案](source/跨端技术对比与应用案例设计.md) — 对比与案例
- [大型 App 使用情况：截至核验日的公开证据](source/跨端技术对比与应用案例设计.md) — 应用案例
- [面试时如何形成更高层次的总结](source/跨端技术对比与应用案例设计.md) — 对比与案例

## Java / Kotlin

- [Kotlin 协程：状态机、结构化并发与取消传播](source/lessons/coroutines.md) — 学习文章；文末复习 5 问
- [Flow、StateFlow 与事件：生命周期、背压和丢失语义](source/lessons/flow-state.md) — 学习文章；文末复习 5 问
- [HashMap 与 Kotlin 集合：散列、扩容和不可变性的误区](source/lessons/collections.md) — 学习文章；文末复习 5 问
- [JVM 原理：内存分区、类加载与一段程序的执行](source/lessons/jvm-runtime.md) — 学习文章；文末复习 5 问
- [多线程原理：线程状态、线程池、取消与资源上限](source/lessons/java-threads.md) — 学习文章；文末复习 5 问
- [锁原理：synchronized、CAS、AQS、Condition 与死锁](source/lessons/java-locks.md) — 学习文章；文末复习 5 问
- [GC 原理：可达性、分代、写屏障、暂停与收集器](source/lessons/gc-runtime.md) — 学习文章；文末复习 5 问
- [JMM 原理：可见性、happens-before、安全发布与原子性](source/lessons/jmm-concurrency.md) — 学习文章；文末复习 5 问
- [运行时与并发学习地图：JVM → JMM → 线程与锁 → GC → Handler/OOM](source/lessons/runtime-roadmap.md) — 学习文章；文末复习 3 问

## Compose

- [Compose State：remember 记住什么，谁让界面更新](source/lessons/compose-state.md) — 学习文章；文末复习 5 问
- [Snapshot 原理：状态版本、读取观察与冲突合并](source/lessons/compose-snapshot.md) — 学习文章；文末复习 5 问
- [组合树与 SlotTable：位置身份怎样保存 remember](source/lessons/compose-slots.md) — 学习文章；文末复习 5 问
- [Compose 编译器：IR 变换、changed 标记与强跳过](source/lessons/compose-compiler.md) — 学习文章；文末复习 5 问
- [Compose 如何刷新：组合、测量、放置与绘制失效](source/lessons/compose-phases.md) — 学习文章；文末复习 5 问
- [Compose 副作用与互操作：key、取消、清理与旧闭包](source/lessons/compose-effects.md) — 学习文章；文末复习 5 问
- [Compose 起点：环境、三类结构与源码阅读](source/lessons/compose-foundations.md) — 学习文章；文末复习 5 问
- [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](source/lessons/compose-components.md) — 学习文章；文末复习 5 问
- [Compose 布局：Constraints、测量、放置与 Modifier.Node](source/lessons/compose-layout.md) — 学习文章；文末复习 5 问
- [Compose 绘制与动画：缓存、图层、帧与中断](source/lessons/compose-graphics-animation.md) — 学习文章；文末复习 5 问
- [Compose 输入：手势、嵌套滚动、焦点与 IME](source/lessons/compose-input.md) — 学习文章；文末复习 5 问
- [Compose 列表：Lazy、key、contentType 与分页](source/lessons/compose-lazy.md) — 学习文章；文末复习 5 问
- [Compose 性能诊断：从卡顿现场到基准与治理](source/lessons/compose-performance.md) — 学习文章；文末复习 5 问
- [Compose 测试：语义树、同步、动画与恢复](source/lessons/compose-testing.md) — 学习文章；文末复习 5 问
- [Compose 架构与导航：所有权、返回栈与自适应](source/lessons/compose-navigation.md) — 学习文章；文末复习 5 问
- [Compose 互操作与迁移：宿主、复用、回滚与证据](source/lessons/compose-interop.md) — 学习文章；文末复习 5 问
- [Compose 由浅到深学习路径](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 0：先建立准确的概念和版本边界](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 1：从正确写页面开始](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 2：状态使用、所有权和恢复](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 3：副作用、协程和数据接入](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 4：布局、绘制、输入和动画](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 5：组合身份、重组和“刷新”](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 6：State 的底层——Snapshot](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 7：SlotTable 如何建立和更新](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 8：编译过程到底做了什么](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 9：性能诊断、测试和正确性](source/Compose-由浅到深学习路径.md) — 学习指南
- [阶段 10：架构、互操作与迁移](source/Compose-由浅到深学习路径.md) — 学习指南
- [Compose 复习导航：状态、运行机制与性能证据](source/guides/compose-review.md) — 学习指南；文末复习 3 问

## 高频面试算法

- [面经对应的 LeetCode 中国题单](source/算法-LeetCodeCN面经题单.md) — 原题索引

## AI 相关

- [AI 客户端工程：流式协议、取消、重连与工具执行](source/lessons/ai-client.md) — 学习文章；文末复习 5 问
- [RAG 与 AI 辅助开发：检索、证据、评测和失效边界](source/lessons/ai-evaluation.md) — 学习文章；文末复习 5 问
- [大模型基础：Token、Attention、RoPE 与生成过程](source/lessons/ai-transformer.md) — 学习文章；文末复习 5 问
- [训练与适配：SFT、LoRA、QLoRA、DPO 和 GRPO 怎么选](source/lessons/ai-training.md) — 学习文章；文末复习 5 问
- [推理原理：Prefill、Decode、KV Cache 与显存估算](source/lessons/ai-inference.md) — 学习文章；文末复习 5 问
- [AI 服务系统：连续批处理、投机解码、排队与成本](source/lessons/ai-serving.md) — 学习文章；文末复习 5 问
- [RAG 全链路：文档解析、Chunk、权限、引用与失效定位](source/lessons/ai-rag-pipeline.md) — 学习文章；文末复习 5 问
- [检索底层：BM25、向量、HNSW、RRF 与 Reranker](source/lessons/ai-retrieval.md) — 学习文章；文末复习 5 问
- [Agent 运行机制：工作流、ReAct、状态机与多 Agent](source/lessons/ai-agent-runtime.md) — 学习文章；文末复习 5 问
- [工具与上下文：Function Calling、MCP、Skill、Memory 与 Harness](source/lessons/ai-tools-context.md) — 学习文章；文末复习 5 问
- [AI 质量工程：评测集、幻觉、LLM Judge、线上实验与安全](source/lessons/ai-quality.md) — 学习文章；文末复习 5 问
- [AI Coding 与代码审查：上下文、验证器、沙箱和结果证据](source/lessons/ai-coding.md) — 学习文章；文末复习 5 问
- [端侧 AI 架构：哪些任务留在设备，怎样设计端云协同](source/lessons/ai-edge-architecture.md) — 学习文章；文末复习 5 问
- [端侧推理引擎：LiteRT、ONNX Runtime、ExecuTorch、MNN、ncnn 与 llama.cpp](source/lessons/ai-edge-runtime.md) — 学习文章；文末复习 5 问
- [模型压缩与量化：INT8/INT4、PTQ/QAT、AWQ/GPTQ 与 KV 精度](source/lessons/ai-quantization.md) — 学习文章；文末复习 5 问
- [端侧性能治理：内存、带宽、温升、Benchmark 与模型发布](source/lessons/ai-edge-performance.md) — 学习文章；文末复习 5 问
- [端侧多模态：语音、OCR、视觉语言模型与实时流水线](source/lessons/ai-multimodal.md) — 学习文章；文末复习 5 问
- [AI 学习地图与近期面经：从通用原理到端侧工程](source/lessons/ai-roadmap.md) — 学习文章；文末复习 3 问

## 技术决策

- [技术决策：如何比较方案，并为不确定性设计退出路径](source/lessons/technology-decisions.md) — 学习文章；文末复习 3 问
- [资深 Android 能力地图：从机制到系统责任](source/lessons/senior-capability-map.md) — 学习文章；文末复习 3 问
- [从概念到原理：简洁学习文章的阅读方法](source/guides/content-depth.md) — 学习指南；文末复习 3 问

## 复杂问题定位

- [ANR 定位：从主线程栈走到完整等待链](source/lessons/anr-diagnosis.md) — 学习文章；文末复习 5 问
- [OOM 原理：资源失败、泄漏引用链与峰值治理](source/lessons/oom-diagnosis.md) — 学习文章；文末复习 5 问

## 性能治理

- [性能优化证据：从一次跑分到可复现的收益归因](source/lessons/performance-proof.md) — 学习文章；文末复习 5 问
- [启动治理：关键路径、初始化 DAG 与 Profile 优化](source/lessons/startup-governance.md) — 学习文章；文末复习 5 问

## 架构演进

- [架构演进：模块边界、单向数据流与渐进替换](source/lessons/architecture-evolution.md) — 学习文章；文末复习 5 问
- [离线数据架构：单一读源、Outbox、冲突与恢复](source/lessons/offline-data.md) — 学习文章；文末复习 5 问
- [资深 Android 测试策略：状态机、契约与关键用户旅程](source/lessons/testing-strategy.md) — 学习文章；文末复习 5 问
- [项目方案与内容维护约定](source/Android-P7-面试准备项目方案-v1.md) — 方案文档

## 项目成果与证据

- [项目成果表达：把技术选择、个人贡献与证据连成一条线](source/lessons/project-evidence.md) — 学习文章；文末复习 3 问

## 面经逐题详解

- [美团面经逐题详解：生命周期、HashMap、OkHttp 与 TCP](source/lessons/interview-meituan-2025.md) — 面经详解
- [MetaApp 面经逐题详解：数据流、MMKV 与 Compose](source/lessons/interview-metaapp-2026.md) — 面经详解
- [小米面经逐题详解：线程池、渲染、Binder 与并发](source/lessons/interview-xiaomi-2025.md) — 面经详解
- [字节 AI Infra：推理与量化 6 问详解（AI 节选）](source/lessons/interview-ai-infra-byte.md) — 面经详解
- [腾讯 AI 平台：Agent 与 RAG 存储 4 问详解（AI 节选）](source/lessons/interview-ai-tencent.md) — 面经详解
- [字节 Agent 开发：RAG、工具与 AI Coding 8 问详解（AI 节选）](source/lessons/interview-ai-agent-byte.md) — 面经详解
- [千问 AI 研发：Agent 可靠性 8 问详解（AI 节选）](source/lessons/interview-ai-qwen.md) — 面经详解

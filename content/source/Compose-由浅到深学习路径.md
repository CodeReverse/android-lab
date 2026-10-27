# Compose 由浅到深学习路径

更新：2026-10-27 · 版本：4

## 1. 阅读方法

先读页面与状态，再读 Runtime 和编译器，最后回到性能与工程治理。可按薄弱点跳读，无需开启进度或练习。每个知识点链接到学习正文的具体小节；正文简洁讲解，面试提炼放在文末。

阶段 0–4 建立开发基础，阶段 5–8 理解底层机制，阶段 9–10 形成验证与迁移能力。示例和实验为学习设计，结果需要在自己的依赖版本中验证。

## 2. 阶段 0：先建立准确的概念和版本边界

本阶段重点：声明式 UI 的输入与输出。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| Compose 职责；组合 / UI / Semantics 三类结构 | [Compose 起点：环境、三类结构与源码阅读](#/article/compose-foundations) | 第 1、2、3 节 |
| Kotlin/Compiler、BOM、Runtime 与环境清单 | [Compose 起点：环境、三类结构与源码阅读](#/article/compose-foundations) | 第 4 节 |
| 源码版本、阅读顺序、入门自检 | [Compose 起点：环境、三类结构与源码阅读](#/article/compose-foundations) | 第 5、6 节 |

**学习产出**：画出组合、布局、语义三类结构，并记录项目编译器与 Runtime 版本。

## 3. 阶段 1：从正确写页面开始

本阶段重点：可复用的纯 UI 组件。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| 声明式页面、组件拆分、加载/空/错误态 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 1、2 节 |
| Modifier 参数、顺序与作用域 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 3 节 |
| 主题、深浅色、字号、国际化、RTL、无障碍 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 4 节 |
| CompositionLocal 的依赖与更新范围 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 5 节 |
| Stateless/Stateful、Preview 与验证边界 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 1、6 节 |

**学习产出**：将搜索页拆成状态输入与事件输出，验证主题、字号和无障碍语义。

## 4. 阶段 2：状态使用、所有权和恢复

本阶段重点：状态所有权、可观察性与恢复。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| State/MutableState、属性委托、remember、普通集合 | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 1、2、3、4 节 |
| 状态提升、持有者与恢复矩阵 | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 5、6 节 |
| rememberSaveable、Saver、SaveableStateHolder、SavedStateHandle | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 6、7 节 |
| remember(key)、key(...) 与身份 | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 8 节 |
| Flow 收集生命周期与生产生命周期 | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 9 节 |

**学习产出**：为搜索词、结果、滚动位置与草稿选择所有者，推演页面重建。

## 5. 阶段 3：副作用、协程和数据接入

本阶段重点：副作用的启动、取消与释放。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| LaunchedEffect、key、取消与最新回调 | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 1、2、3 节 |
| DisposableEffect、SideEffect、rememberCoroutineScope | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 4、7、9 节 |
| produceState、snapshotFlow、derivedStateOf | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 5 节 |
| 防抖、去重、异常、过期结果与事件语义 | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 6、9 节 |

**学习产出**：把搜索防抖、过期结果和外部监听的生命周期串成一条执行链。

## 6. 阶段 4：布局、绘制、输入和动画

本阶段重点：从布局约束到绘制和交互。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| Constraints、Row/Column/Box、weight、基线、自定义布局 | [Compose 布局：Constraints、测量、放置与 Modifier.Node](#/article/compose-layout) | 第 1、2、3 节 |
| Intrinsic、SubcomposeLayout、测量与放置 | [Compose 布局：Constraints、测量、放置与 Modifier.Node](#/article/compose-layout) | 第 4、5 节 |
| Modifier.Node、失效与布局故障 | [Compose 布局：Constraints、测量、放置与 Modifier.Node](#/article/compose-layout) | 第 6、7 节 |
| Canvas、绘制修饰符、缓存、graphicsLayer | [Compose 绘制与动画：缓存、图层、帧与中断](#/article/compose-graphics-animation) | 第 1、2、3 节 |
| animate*AsState、Animatable、Transition、内容动画 | [Compose 绘制与动画：缓存、图层、帧与中断](#/article/compose-graphics-animation) | 第 4、5、6 节 |
| LazyColumn/Grid、key、contentType、恢复、分页 | [Compose 列表：Lazy、key、contentType 与分页](#/article/compose-lazy) | 第 1、2、3、4、5、6 节 |
| clickable、pointerInput、传播、消费、手势竞争、嵌套滚动 | [Compose 输入：手势、嵌套滚动、焦点与 IME](#/article/compose-input) | 第 1、2、3、4 节 |
| 文本编辑、焦点、键盘、IME/Insets、自适应 | [Compose 输入：手势、嵌套滚动、焦点与 IME](#/article/compose-input) | 第 5、6、7 节 |

**学习产出**：先读布局与 Lazy，再读绘制动画和输入；通过重排、滚动和 IME 场景比较行为。

## 7. 阶段 5：组合身份、重组和“刷新”

本阶段重点：组合身份与阶段失效。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| 调用位置、条件分支与列表身份 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 1、2、3、4、5、6 节 |
| 读取阶段、重组、测量、放置和绘制 | [Compose 如何刷新：组合、测量、放置与绘制失效](#/article/compose-phases) | 第 1、2、3、4、5、9 节 |
| 写入到调度、应用变更与显示 | [Compose 如何刷新：组合、测量、放置与绘制失效](#/article/compose-phases) | 第 6 节 |
| 重启、跳过、直接失效、内联边界 | [Compose 如何刷新：组合、测量、放置与绘制失效](#/article/compose-phases) | 第 7 节 |
| 组合/布局回写与反馈循环 | [Compose 如何刷新：组合、测量、放置与绘制失效](#/article/compose-phases) | 第 8 节 |

**学习产出**：跟踪一次 State 写入，分别标出组合、测量、放置与绘制的失效范围。

## 8. 阶段 6：State 的底层——Snapshot

本阶段重点：状态记录、版本与冲突。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| StateObject/StateRecord、读写与可见性 | [Snapshot 原理：状态版本、读取观察与冲突合并](#/article/compose-snapshot) | 第 1、2、3 节 |
| MutableSnapshot、apply、冲突、合并、mutation policy | [Snapshot 原理：状态版本、读取观察与冲突合并](#/article/compose-snapshot) | 第 4、5、6 节 |
| 观察者、动态依赖、derivedStateOf | [Snapshot 原理：状态版本、读取观察与冲突合并](#/article/compose-snapshot) | 第 4、7、9 节 |
| 隔离实验、dispose、线程与事务边界 | [Snapshot 原理：状态版本、读取观察与冲突合并](#/article/compose-snapshot) | 第 8、10 节 |
| snapshotFlow 与派生结果的差异 | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 5 节 |

**学习产出**：用两个可变快照推演等价写入和不兼容写入，并标出 apply 的结果。

## 9. 阶段 7：SlotTable 如何建立和更新

本阶段重点：Composer 到 UI 节点更新。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| Composer、首次组合、remember 与分组 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 1、2、3 节 |
| 条件切换、同位置重执行、移动、插入与删除 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 4、5、6 节 |
| 经典 SlotTable、gap buffer、anchor、LinkTable 边界 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 7、9 节 |
| Applier、节点变更、遗忘与放弃 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 8 节 |
| 最小复现与源码阅读验证 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 10 节 |

**学习产出**：画出首次组合、条件块移除和列表头插时的身份、槽位与节点变化。

## 10. 阶段 8：编译过程到底做了什么

本阶段重点：编译协议、稳定性与跳过。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| Composable 协议、参数变化、默认参数、分组与重启 | [Compose 编译器：IR 变换、changed 标记与强跳过](#/article/compose-compiler) | 第 1、2、3 节 |
| 稳定性推断、注解、集合与强跳过比较 | [Compose 编译器：IR 变换、changed 标记与强跳过](#/article/compose-compiler) | 第 4、5、6 节 |
| lambda 捕获与自动记忆化 | [Compose 编译器：IR 变换、changed 标记与强跳过](#/article/compose-compiler) | 第 7 节 |
| 插件升级、报告、metrics、IR 与产物对照 | [Compose 编译器：IR 变换、changed 标记与强跳过](#/article/compose-compiler) | 第 8、9、10 节 |

**学习产出**：固定版本，对照一个函数的转换示意、稳定性报告与实际重组行为。

## 11. 阶段 9：性能诊断、测试和正确性

本阶段重点：可验证的性能与正确性。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| 现场→trace→线程/阶段→热点→对照 | [Compose 性能诊断：从卡顿现场到基准与治理](#/article/compose-performance) | 第 1、2、3 节 |
| 稳定性反例、Release、Macrobenchmark、Baseline Profiles | [Compose 性能诊断：从卡顿现场到基准与治理](#/article/compose-performance) | 第 4、5 节 |
| 性能预算、报告、流式文本与成果边界 | [Compose 性能诊断：从卡顿现场到基准与治理](#/article/compose-performance) | 第 6 节 |
| 语义选择器、状态输入、事件输出、异步响应 | [Compose 测试：语义树、同步、动画与恢复](#/article/compose-testing) | 第 1、2、3 节 |
| 动画时钟、恢复、截图与无障碍 | [Compose 测试：语义树、同步、动画与恢复](#/article/compose-testing) | 第 4、5、6 节 |
| 测试分层、回归与发布门槛 | [Compose 测试：语义树、同步、动画与恢复](#/article/compose-testing) | 第 7 节 |

**学习产出**：先定义用户指标，再选择 trace、基准测试和语义测试，保留对照条件。

## 12. 阶段 10：架构、互操作与迁移

本阶段重点：页面架构与渐进迁移。表内小节按知识关联标注，可用文章目录定位。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| ViewModel、页面持有者、纯 UI 与领域层 | [Compose 架构与导航：所有权、返回栈与自适应](#/article/compose-navigation) | 第 1 节 |
| 导航参数、深链接、返回栈、恢复、事件 | [Compose 架构与导航：所有权、返回栈与自适应](#/article/compose-navigation) | 第 2、3、4 节 |
| 多窗口/大屏、模块化、设计系统与组件 API | [Compose 架构与导航：所有权、返回栈与自适应](#/article/compose-navigation) | 第 5、6 节 |
| ComposeView、AndroidView、宿主与释放策略 | [Compose 互操作与迁移：宿主、复用、回滚与证据](#/article/compose-interop) | 第 1、2、3 节 |
| 池化复用、onReset/onRelease 与资源归属 | [Compose 互操作与迁移：宿主、复用、回滚与证据](#/article/compose-interop) | 第 4 节 |
| 迁移策略、测试、灰度、回滚、兼容、构建与责任 | [Compose 互操作与迁移：宿主、复用、回滚与证据](#/article/compose-interop) | 第 5、6 节 |

**学习产出**：选一个 View/Compose 混合页面，明确状态边界、释放、复用与回滚条件。

## 13. 资料与面试提炼

官方入口：[声明式思维](https://developer.android.com/develop/ui/compose/mental-model)、[状态](https://developer.android.com/develop/ui/compose/state)、[阶段](https://developer.android.com/develop/ui/compose/phases)、[Runtime 发布记录](https://developer.android.com/jetpack/androidx/releases/compose-runtime)、[编译器迁移](https://kotlinlang.org/docs/compose-compiler-migration-guide.html)。具体原理来源见对应文章末尾，源码实现需匹配实际版本。

完成一条主线后，用这三个问题串联所学：

1. 从一次状态写入到屏幕变化，哪些组件协作，哪些阶段可以跳过？
2. 列表重排、页面重建和进程重建，各由什么机制维持状态身份？
3. 怎样用编译报告、trace 和测试区分性能问题与状态正确性问题？

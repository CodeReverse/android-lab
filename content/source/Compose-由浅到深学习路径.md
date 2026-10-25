# Compose 由浅到深学习路径

更新：2026-10-25。版本：2。适用：已有 Android 开发经验，系统复习 Compose，并准备资深工程师面试。十一阶段现在逐项链接到 16 篇学习正文；各表给出知识点对应的文章和问题编号。正文包含答案、案例推演与原理资料；Android 实验尚未执行，不把预期写成测量结果。

使用方式：可按薄弱点选择章节、跳读和查阅；前置关系只作建议。进度管理与交互练习分别由用户设置，默认关闭。下文“必修”“验收”“自测”表示系统复习时的建议深度与自检方法，不是访问门槛、默认任务或自动记录要求。阅读不自动计入掌握进度。

归属总目录：**05 Compose**。性能案例关联 09 复杂问题定位、10 性能治理；迁移案例关联 08 技术决策、11 架构演进；真实工作材料关联 12 项目成果与证据。

## 1. 总路线与完成标准

推荐先完成一次全链路阅读，再按薄弱点深入。不要一开始就逐行读整个 Runtime。

| 阶段 | 学习主题 | 必须交付的学习产物 |
| --- | --- | --- |
| 0 | 环境、术语、版本 | 版本清单、三类结构与三阶段示意图 |
| 1 | 声明式 UI 与常用开发能力 | 一个页面的组件、事件、状态边界设计 |
| 2 | 状态管理与生命周期 | 状态所有权和恢复矩阵 |
| 3 | 副作用、协程与外部数据 | 请求、订阅、取消和事件处理时序图 |
| 4 | 布局、绘制、输入与动画 | 自定义布局推演、Modifier 顺序对照 |
| 5 | 组合身份、重组与刷新 | 从状态写入到显示的分支链路图 |
| 6 | Snapshot 状态系统 | 读写追踪、隔离、应用冲突实验设计 |
| 7 | Composer、SlotTable 与节点更新 | 首次组合和条件分支变化的逐步推演 |
| 8 | Compose 编译器 | 最小样例转换对照、稳定性报告解释 |
| 9 | 性能、测试与故障诊断 | 一份可复核的诊断报告 |
| 10 | 架构、迁移与工程治理 | 一个真实业务的迁移决策及验证方案 |

学习强度建议：约 6–8 周，每周 6–8 小时，可嵌入主计划。阶段 1–4 已熟悉时，用验收任务快速通过，把时间投到阶段 5–9。时间是安排建议，不是完成全部源码研究的保证。

每个主题使用同一模板：**正确使用 → 执行机制 → 源码定位 → 反例实验 → 工程取舍 → 面试追问**。学习笔记区分“已确认结论”“待验证假设”“本版本实现”。

## 2. 阶段 0：先建立准确的概念和版本边界

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| Compose 职责；组合 / UI / Semantics 三类结构 | [Compose 起点：环境、三类结构与源码阅读](#/article/compose-foundations) | 第 1–3 问 |
| Kotlin/Compiler、BOM、Runtime 与环境清单 | [Compose 起点：环境、三类结构与源码阅读](#/article/compose-foundations) | 第 4 问 |
| 源码版本、阅读顺序、入门自检 | [Compose 起点：环境、三类结构与源码阅读](#/article/compose-foundations) | 第 5–6 问 |


### 2.1 三类结构不能混为一谈

| 结构 | 学习重点 | 避免的误解 |
| --- | --- | --- |
| Composition 的逻辑分组及其运行时记录 | 调用位置、身份、remember、分支和重启范围 | 不是每调用一次 Composable 就创建一个 View |
| UI 节点结构，例如 LayoutNode | 测量、放置、绘制、Modifier 节点和节点复用 | 不与所有 Composable 调用一一对应 |
| Semantics 结构 | 无障碍、合并语义、UI 测试可见性 | 测试看到的层次不一定就是布局层次 |

“Slot 树”可作为口语，但正文分别使用“组合分组结构”“SlotTable 存储结构”“UI 节点树”。理解组合先读 [Runtime 设计说明](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/design/how-compose-works.md)，布局看[官方布局文档](https://developer.android.com/develop/ui/compose/layouts/basics?hl=zh-cn)，语义与测试看[官方测试文档](https://developer.android.com/develop/ui/compose/testing?hl=zh-cn)。

### 2.2 每次源码学习固定环境

记录 Kotlin/Compose Compiler 插件、Compose Runtime/UI/Foundation/Material、AGP、JDK、设备/API、构建类型和编译器选项；源码固定到实际依赖对应的 tag 或 commit。不要把不同版本的截图拼成一条调用链。

三个已核验、会改变旧教程结论的点：

- Kotlin 2.0 起 Compose Compiler 已进入 Kotlin 仓库，学习编译插件配置与源码需使用相应位置。[迁移说明](https://kotlinlang.org/docs/compose-compiler-migration-guide.html)
- Strong skipping 从 Kotlin 2.0.20 起默认启用。“参数不稳定，所以一定不能跳过”不能作为无版本前提的结论。[Strong skipping](https://developer.android.com/develop/ui/compose/performance/stability/strongskipping)
- Runtime 发布说明已记录实验性的新 SlotTable/LinkTable 实现。旧设计文档的 gap buffer 是特定实现路线，不能当作 Compose 永久约定；新路线的启用条件、成熟度按所选版本查证。[Runtime 发布说明](https://developer.android.com/jetpack/androidx/releases/compose-runtime)

本轮不替你锁定未经构建验证的依赖组合。后续实验先复现现有项目版本，再增加独立升级对照。

## 3. 阶段 1：从正确写页面开始

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| 声明式页面、组件拆分、加载/空/错误态 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 1–2 问 |
| Modifier 参数、顺序与作用域 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 3 问 |
| 主题、深浅色、字号、国际化、RTL、无障碍 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 4 问 |
| CompositionLocal 的依赖与更新范围 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 5 问 |
| Stateless/Stateful、Preview 与验证边界 | [Compose 页面开发：组件、Modifier、主题与 CompositionLocal](#/article/compose-components) | 第 1、6 问 |


### 必修知识

- 声明式 UI：输入状态描述界面；UI 事件回传；Composable 的职责和可重执行性。
- 基础组件：Text、输入框、按钮、图片、对话框、Scaffold、列表与网格；加载、空态、错误态。
- Modifier 参数约定、顺序与作用范围；尺寸、padding、点击、裁剪、背景的组合。
- Material 主题、颜色、字体、深浅色、字号缩放、国际化、RTL、无障碍。
- Stateless/Stateful 组件分离；Preview 与真实运行的区别；组合优于巨型页面函数。
- CompositionLocal 的用途和依赖可见性：主题/环境数据与业务状态如何划分。

### 验收与追问

以“可搜索的收藏列表”为贯穿案例，画出页面、列表项、搜索框、加载组件和状态边界。要求不依赖 ViewModel 也能预览纯 UI 组件。

面试官继续问：如果 Composable 重复执行，埋点或请求会不会重复？为什么 Modifier 顺序能影响触摸范围？CompositionLocal 用得过多会给测试和复用带来什么问题？

阅读：[Modifier](https://developer.android.com/develop/ui/compose/modifiers?hl=zh-cn)、[布局基础](https://developer.android.com/develop/ui/compose/layouts/basics?hl=zh-cn)。

## 4. 阶段 2：状态使用、所有权和恢复

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| State/MutableState、属性委托、remember、普通集合 | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 1–4 问 |
| 状态提升、持有者与恢复矩阵 | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 5、7 问 |
| rememberSaveable、Saver、SaveableStateHolder、SavedStateHandle | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 7–8 问 |
| remember(key)、key(...) 与身份 | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 9 问 |
| Flow 收集生命周期与生产生命周期 | [Compose State：remember 记住什么，谁让界面更新](#/article/compose-state) | 第 10 问 |


### 必修知识

- State/MutableState、mutableStateOf、Kotlin 属性委托；普通变量为何不等于可观察状态。
- remember 的组合位置身份与 keys；remember 缓存不等于使缓存对象的所有字段可观察。
- 状态提升、单向数据流、不可变 UI 状态、事件入口；状态放组件、页面状态持有者还是 ViewModel。
- 可观察集合与普通 MutableList 的差异；对象引用不变而内部字段改变时的观察边界。
- rememberSaveable、Saver、SaveableStateHolder、SavedStateHandle；保存最小可恢复状态。
- 局部重组、离开组合、配置变化、导航出栈、进程重建的区别。
- StateFlow/Flow 的 UI 收集与生命周期；订阅生命周期和数据生产生命周期分别分析。

### 必须能解释的结论

remember 解决组合中的值复用，mutableStateOf 提供可观察状态；两者经常一起使用，但职责不同。普通集合的内部修改不会自动变成 Compose 能观察的状态变化。保存状态也不等于持久化整个业务数据库。[状态文档](https://developer.android.com/develop/ui/compose/state?hl=zh-cn)

### 验收与追问

制作恢复矩阵：搜索词、筛选项、滚动位置、网络结果、未提交表单、一次性提示，各自归谁持有，何时丢失，是否应保存，如何重建。

面试官继续问：remember(key) 与 key(...) 改变的分别是什么？为什么修改 data class 内部的普通 var 后界面可能不更新？把全部状态塞进一个大对象会产生哪些观察、比较与维护成本？进程恢复后重新请求如何避免把旧结果盖到新页面？

## 5. 阶段 3：副作用、协程和数据接入

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| LaunchedEffect、key、取消与最新回调 | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 1–3 问 |
| DisposableEffect、SideEffect、rememberCoroutineScope | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 4、9–10 问 |
| produceState、snapshotFlow、derivedStateOf | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 7 问 |
| 防抖、去重、异常、过期结果与事件语义 | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 8、10 问 |


### 必修知识

- LaunchedEffect：key、启动、取消、重新启动，关联组合生命周期。
- rememberCoroutineScope：用户交互触发的协程，作用域结束与业务任务边界。
- DisposableEffect：监听器注册、清理、key 变化与资源归属。
- rememberUpdatedState：让长生命周期逻辑读取最新回调或值；与重启 Effect 的取舍。
- SideEffect：成功提交组合后的外部同步；基础无 key 形式先学，新重载按版本补充。
- produceState、snapshotFlow、derivedStateOf：外部数据接入、状态观察转流、派生结果的不同目标。
- 请求去重、取消竞争、过期结果覆盖、异常传播；UI 状态与业务事件的建模。

以上 API 的生命周期与用途以[官方副作用文档](https://developer.android.com/develop/ui/compose/side-effects?hl=zh-cn)为主；新 SideEffect 重载等变化查[Runtime 发布说明](https://developer.android.com/jetpack/androidx/releases/compose-runtime)。

### 验收与追问

为“输入关键词→防抖搜索→显示结果→离开页面”画时序，标出谁取消谁、响应是否过期、配置变化后谁继续工作。设计回调更新但计时任务不重启的对照实验。

面试官继续问：LaunchedEffect(Unit) 是整个应用只运行一次吗？为什么 key 选错会重复请求？snapshotFlow 为什么不应被当作无损事件队列？derivedStateOf 为什么不适合机械包住所有计算？

## 6. 阶段 4：布局、绘制、输入和动画

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| Constraints、Row/Column/Box、weight、基线、自定义布局 | [Compose 布局：Constraints、测量、放置与 Modifier.Node](#/article/compose-layout) | 第 1–3 问 |
| Intrinsic、SubcomposeLayout、测量与放置 | [Compose 布局：Constraints、测量、放置与 Modifier.Node](#/article/compose-layout) | 第 4–5 问 |
| Modifier.Node、失效与布局故障 | [Compose 布局：Constraints、测量、放置与 Modifier.Node](#/article/compose-layout) | 第 6–7 问 |
| Canvas、绘制修饰符、缓存、graphicsLayer | [Compose 绘制与动画：缓存、图层、帧与中断](#/article/compose-graphics-animation) | 第 1–3 问 |
| animate*AsState、Animatable、Transition、内容动画 | [Compose 绘制与动画：缓存、图层、帧与中断](#/article/compose-graphics-animation) | 第 4–6 问 |
| LazyColumn/Grid、key、contentType、恢复、分页 | [Compose 列表：Lazy、key、contentType 与分页](#/article/compose-lazy) | 第 1–6 问 |
| clickable、pointerInput、传播、消费、手势竞争、嵌套滚动 | [Compose 输入：手势、嵌套滚动、焦点与 IME](#/article/compose-input) | 第 1–4 问 |
| 文本编辑、焦点、键盘、IME/Insets、自适应 | [Compose 输入：手势、嵌套滚动、焦点与 IME](#/article/compose-input) | 第 5–7 问 |


### 必修知识

- Constraints、measure、place；父约束传递、子尺寸选择、父节点放置。
- Row/Column/Box、weight、fill/wrap、对齐线；自定义 Layout 与测量策略。
- Intrinsic 测量与 SubcomposeLayout 的应用场景及成本；理解 Lazy 布局为何需要特殊机制。
- Canvas、drawBehind、drawWithContent、drawWithCache、graphicsLayer；绘制缓存和图层成本。
- Modifier 链及 Modifier.Node 的职责；尺寸变化、位置变化、绘制变化分别怎样传播。
- LazyColumn/Grid 的 key、contentType、状态恢复、复用和分页；区分身份与内容类型。
- clickable 与底层 pointerInput；命中测试、事件传播/消费、手势竞争、nested scroll。
- animate*AsState、Animatable、Transition、AnimatedContent/Visibility；动画中断、状态与帧驱动。
- 焦点、键盘、IME/Insets、文本编辑、自适应布局；不要只在固定尺寸 Preview 验证。

### 验收与追问

设计一个“标签自动换行布局”，手工推演三组约束。对比改变尺寸、改变位置、改变颜色三个场景的阶段工作。再分析同向嵌套滚动和列表插入导致的状态错位。

面试官继续问：为什么对子元素反复试测量不是通用布局方案？把动画读值移到绘制阶段能解决尺寸变化吗？graphicsLayer 的好处会付出哪些代价？自定义触摸实现为什么可能丢失无障碍语义？

阅读：[布局](https://developer.android.com/develop/ui/compose/layouts/basics?hl=zh-cn)、[阶段](https://developer.android.google.cn/develop/ui/compose/phases?hl=zh-cn)、[手势](https://developer.android.com/develop/ui/compose/touch-input/pointer-input/understand-gestures?hl=zh-cn)。

## 7. 阶段 5：组合身份、重组和“刷新”

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| 调用位置、条件分支与列表身份 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 1–4、7–8 问 |
| 读取阶段、重组、测量、放置和绘制 | [Compose 如何刷新：组合、测量、放置与绘制失效](#/article/compose-phases) | 第 1–6 问 |
| 写入到调度、应用变更与显示 | [Compose 如何刷新：组合、测量、放置与绘制失效](#/article/compose-phases) | 第 7 问 |
| 重启、跳过、直接失效、内联边界 | [Compose 如何刷新：组合、测量、放置与绘制失效](#/article/compose-phases) | 第 8 问 |
| 组合/布局回写与反馈循环 | [Compose 如何刷新：组合、测量、放置与绘制失效](#/article/compose-phases) | 第 9 问 |


### 核心路线

先掌握调用位置、调用顺序与显式 key 对身份的影响，再研究可重启范围、参数比较、跳过和失效。列表重排时，需要解释为什么某个 remember 值或 Effect 应跟着业务项移动。[Composable 生命周期](https://developer.android.com/develop/ui/compose/lifecycle?hl=zh-cn)

“刷新”按读取阶段分开分析：组合阶段的状态依赖可能使组合范围失效；布局或绘制阶段的读取可以触发对应阶段的工作。测量、放置也应区分。需要哪些后续工作取决于具体变化，不能背成“每次赋值都重组整棵树，再整体重绘”。[Compose 阶段](https://developer.android.google.cn/develop/ui/compose/phases?hl=zh-cn)

### 一条供学习推演的链路

```text
用户事件写入可观察状态
  → 按 mutation policy 与 Snapshot 规则处理变化
  → 通知相关观察者，使关联工作失效
  ├─ 组合阶段读取：调度重组 → 执行/跳过相关范围 → 应用变更
  ├─ 布局阶段读取：请求相关测量或放置工作
  └─ 绘制阶段读取：请求相关绘制工作
  → 在需要时完成后续布局、绘制与平台显示
```

这是机制导航图，不是逐函数调用栈；具体通知时机、合并调度和平台实现要在固定版本验证。一次重组也不等于一次显示帧，Composable 被执行不代表一定改变了最终像素。

### 验收与追问

同一状态分别在函数主体、布局 lambda、绘制 lambda 读取，先预测执行范围，再设计计数和 trace 观察。增加父组件重新执行、参数对象重新创建、直接状态失效三个条件，分别判断子组件能否跳过。

面试官继续问：参数没变为何仍可能重组？不读取状态的子组件为何可能执行？可重启与可跳过是否同一属性？为什么内联 Composable 的边界不能直接当成独立重组边界？列表 key 能否消除所有重组？

## 8. 阶段 6：State 的底层——Snapshot

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| StateObject/StateRecord、读写与可见性 | [Snapshot 原理：状态版本、读取观察与冲突合并](#/article/compose-snapshot) | 第 1–2、7 问 |
| MutableSnapshot、apply、冲突、合并、mutation policy | [Snapshot 原理：状态版本、读取观察与冲突合并](#/article/compose-snapshot) | 第 3–4、8 问 |
| 观察者、动态依赖、derivedStateOf | [Snapshot 原理：状态版本、读取观察与冲突合并](#/article/compose-snapshot) | 第 4–5、9 问 |
| 隔离实验、dispose、线程与事务边界 | [Snapshot 原理：状态版本、读取观察与冲突合并](#/article/compose-snapshot) | 第 6、10 问 |
| snapshotFlow 与派生结果的差异 | [Compose 副作用与互操作：key、取消、清理与旧闭包](#/article/compose-effects) | 第 7 问 |


### 学习顺序

1. 从 MutableState 的 value 读写进入：观察什么对象，变化策略如何判定等价。
2. 学 Snapshot、StateObject、StateRecord 等职责：同一状态的版本、可见性与生命周期。
3. 学读观察和写观察：状态系统如何供组合、布局、绘制等观察方追踪依赖。
4. 学 MutableSnapshot：隔离修改、apply、冲突检测与处理，不把它当数据库事务的完整替代品。
5. 学 derivedStateOf 的依赖和结果变化，再比较 snapshotFlow 的收集与重算。
6. 学线程边界：Snapshot 的并发机制，不自动保证任意业务对象和复合操作都线程安全。

官方 Snapshot API 说明了可变快照的隔离修改、应用与冲突行为，应以此校验实验结论。[Snapshot API](https://developer.android.com/reference/kotlin/androidx/compose/runtime/snapshots/Snapshot)

### 必做实验设计

| 场景 | 需要观察与回答 |
| --- | --- |
| 写入相等值、相同引用、内容相同的新对象 | 不同 mutation policy 下是否形成有效变化 |
| 改变普通对象内部字段 | 哪个写入真正经过了可观察状态系统 |
| 两个可变快照修改同一状态 | 应用次序、冲突结果、业务如何处理 |
| 同一快照批量修改多个状态 | 隔离阶段与应用后的可见性边界 |
| 派生布尔值依赖高频滚动状态 | 原始变化、派生计算、消费者执行分别计数 |

面试官继续问：为什么读依赖要随执行路径更新？条件分支不再读某个状态后会怎样？结构相等策略会不会掩盖错误的原地修改？Snapshot 能否替代所有锁？遇到 apply 冲突是重试、合并还是取消，依据什么业务约束？

源码阅读任务以实际版本定位相关类和读写路径；本轮没有声称已逐行核验所有当前内部类。

## 9. 阶段 7：SlotTable 如何建立和更新

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| Composer、首次组合、remember 与分组 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 1–2、7 问 |
| 条件切换、同位置重执行、移动、插入与删除 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 3–4、8 问 |
| 经典 SlotTable、gap buffer、anchor、LinkTable 边界 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 5、9 问 |
| Applier、节点变更、遗忘与放弃 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 10 问 |
| 最小复现与源码阅读验证 | [组合树与 SlotTable：位置身份怎样保存 remember](#/article/compose-slots) | 第 6 问 |


### 先回答职责

编译器生成运行时协议所需的信息与调用；运行时执行组合时建立、复用和调整组合记录。编译期并不知道所有动态条件和列表数据，因此不能把它描述成“编译器提前生成完整的运行时 Slot 树”。经典设计以调用位置参与记忆，并用分组记录结构关系；具体存储布局属于实现细节。[Runtime 设计说明](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/design/how-compose-works.md)

### 按五个场景阅读，避免漫无目的浏览源码

| 场景 | 跟踪对象 | 要画出的变化 |
| --- | --- | --- |
| 首次组合 | Composition、Composer、group、remember 记录 | 进入/退出分组，首次保存值 |
| 同位置再次执行 | group 身份、已保存值、参数信息 | 哪些值复用，哪些重新计算 |
| 条件分支切换 | 分支分组、被移除的内容、资源清理 | 插入/删除对后续位置的影响 |
| 列表头部插入或重排 | key、可移动内容、节点操作 | 位置身份与业务身份的差异 |
| 某范围失效 | Recomposer、重启范围、变更应用 | 从失效到局部执行及节点更新 |

额外学习 Applier：运行时的变更怎样作用到目标节点；解释为什么 Runtime 可以服务于不同目标树，而 Android UI 只是具体使用方。

### 经典实现与新实现分开学

- 经典路线研究分组、槽位、索引/地址、anchor、gap buffer、读写器，以及它们维护的不变量；这是实现分析任务，不是 API 承诺。
- 新路线研究 LinkTable 为什么出现、主要针对什么成本、启用条件、正确性和性能回归如何验证。不要直接把经典路线的数组细节套到新实现。
- 两条路线共同验收的是身份、值复用和变更语义；内部结构和成本模型分别记录。[新实现的官方记录](https://developer.android.com/jetpack/androidx/releases/compose-runtime)

### 验收与追问

手工追踪含条件分支、两个 remember、一个可重排列表的小页面，分别给出首次组合、切换分支、插入列表项后的逻辑分组图和 UI 节点图。允许省略内部数字编码，但必须说清对应关系。

面试官继续问：一个 group 就是一个 UI 节点吗？为什么 remember 不只用函数名作缓存 key？条件分支为什么不会让后面所有 remember 都取错值？移动内容与删除后重建有何语义差别？插入大量内容时经典存储方案的成本在哪里？

## 10. 阶段 8：编译过程到底做了什么

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| Composable 协议、参数变化、默认参数、分组与重启 | [Compose 编译器：IR 变换、changed 标记与强跳过](#/article/compose-compiler) | 第 1–2、7 问 |
| 稳定性推断、注解、集合与强跳过比较 | [Compose 编译器：IR 变换、changed 标记与强跳过](#/article/compose-compiler) | 第 3–4、8 问 |
| lambda 捕获与自动记忆化 | [Compose 编译器：IR 变换、changed 标记与强跳过](#/article/compose-compiler) | 第 9 问 |
| 插件升级、报告、metrics、IR 与产物对照 | [Compose 编译器：IR 变换、changed 标记与强跳过](#/article/compose-compiler) | 第 5–6、10 问 |


### 按概念顺序掌握转换

下面是学习组织顺序，并非对所有 Kotlin 版本 compiler pass 顺序的断言。

1. **语言约束与分析**：Composable 调用上下文、函数类型和诊断。
2. **调用协议**：隐式 Composer 参数，以及适用情况下用于参数变化和默认参数的信息。
3. **函数体转换**：分组边界、可重启范围、更新回调、跳过判断；不同函数不一定套同一个模板。
4. **参数变化传播**：调用方已知信息如何传递，何时比较，怎样避免重复工作。
5. **稳定性推断**：类型信息、跨模块信息、注解和配置的作用及承诺。
6. **Lambda 处理**：捕获、Composable lambda、记忆化和 strong skipping 的关系。
7. **可观测产物**：compiler reports/metrics、生成代码、工具信息及不同构建模式差别。

编译器学习入口：[Kotlin 官方 Compose Compiler 迁移说明](https://kotlinlang.org/docs/compose-compiler-migration-guide.html)、[官方编译器 lower 源码目录](https://github.com/JetBrains/kotlin/tree/master/plugins/compose/compiler-hosted/src/main/java/androidx/compose/compiler/plugins/kotlin/lower)。先定位函数体转换相关实现，再对照具体样例；阅读时切换到已锁定版本。

### 稳定性必须学到条件和反例

Strong skipping 下，符合条件的可重启函数可以因不稳定参数也具备跳过能力；稳定与不稳定参数的比较策略有区别。编译器还会对相关 lambda 做记忆化。跳过仍有条件，不能由“开启了 strong skipping”推导“状态失效也不执行”。[官方规则](https://developer.android.com/develop/ui/compose/performance/stability/strongskipping)

### 对照样例矩阵

| 变化项 | 对照内容 |
| --- | --- |
| 参数 | 无参数、基本类型、不可变数据、可变对象、集合 |
| 函数 | 普通可重启函数、内联场景、带返回值的场景 |
| 控制流 | if、循环、key、默认参数 |
| Lambda | 无捕获、稳定捕获、不稳定捕获、回调更新 |
| 设置 | 所选版本支持范围内的 strong skipping 开关对照 |

验收：给出至少四组“原始样例→生成协议的简化说明→运行观察→结论边界”。反编译输出只是一种观察工具，不等于完整编译 IR，也不能根据 Debug 一种构建解释所有 Release 行为。

面试官继续问：@Stable 是修复可变对象观察问题的开关吗？为什么每次 new 一个内容相同的对象有时能跳过、有时不能？@Immutable 的承诺被违反会怎样？changed 信息由谁产生和消费？为什么不是每个 Composable 都有独立 restart scope？

## 11. 阶段 9：性能诊断、测试和正确性

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| 现场→trace→线程/阶段→热点→对照 | [Compose 性能诊断：从卡顿现场到基准与治理](#/article/compose-performance) | 第 1–3 问 |
| 稳定性反例、Release、Macrobenchmark、Baseline Profiles | [Compose 性能诊断：从卡顿现场到基准与治理](#/article/compose-performance) | 第 4–5 问 |
| 性能预算、报告、流式文本与成果边界 | [Compose 性能诊断：从卡顿现场到基准与治理](#/article/compose-performance) | 第 6 问 |
| 语义选择器、状态输入、事件输出、异步响应 | [Compose 测试：语义树、同步、动画与恢复](#/article/compose-testing) | 第 1–3 问 |
| 动画时钟、恢复、截图与无障碍 | [Compose 测试：语义树、同步、动画与恢复](#/article/compose-testing) | 第 4–6 问 |
| 测试分层、回归与发布门槛 | [Compose 测试：语义树、同步、动画与恢复](#/article/compose-testing) | 第 7 问 |


### 诊断顺序

现象与复现条件 → 帧和线程证据 → 判断组合/布局/绘制/业务计算/图片或平台侧成本 → 提出最小改动 → 同条件比较 → 检查正确性与副作用。

工具学习覆盖 Layout Inspector、重组观察、系统 trace、Compose tracing、compiler reports、Macrobenchmark、Baseline Profiles。工具开销、Release/Debug 差异和设备条件纳入实验记录。

优化候选覆盖：延迟状态读取、合理派生状态、缓存昂贵计算、列表身份、不可变数据边界、避免组合中回写依赖状态；先证实热点再采用。[官方性能建议](https://developer.android.com/develop/ui/compose/performance/bestpractices?hl=zh-cn)

### 四个综合案例

| 案例 | 主要问题 | 验收证据 |
| --- | --- | --- |
| 长列表滑动卡顿 | 到底是重组、布局、图像还是其他工作 | 帧数据、trace、相同负载前后对比 |
| 列表重排后输入状态错位 | 身份、key、保存状态归属 | 最小复现和修复后的状态断言 |
| 页面退出仍请求/重复埋点 | Effect、协程、订阅与生命周期 | 请求/取消时序、资源清理证据 |
| 流式文本更新 | 状态更新粒度、批量处理与显示延迟 | 延迟、卡顿、内存与内容完整性 |

测试学习：语义树选择器与合并、状态输入和事件输出、动画时钟与同步、恢复测试、异步数据、无障碍。截图测试是补充，不能代替行为和状态断言。[Compose 测试](https://developer.android.com/develop/ui/compose/testing?hl=zh-cn)

面试官继续问：重组次数下降而卡顿不变，下一步查什么？基准测试为什么要区分冷启动、预热和缓存？稳定性注解“优化”后为何可能产生错误界面？怎样避免优化只是把代价转移到内存或输入延迟？

## 12. 阶段 10：架构、互操作与迁移

### 本阶段知识点与学习正文

按薄弱点点击文章，使用文内目录跳到对应问题；这些都是直接附答案的正文。

| 知识点 | 具体学习文章 | 定位 |
| --- | --- | --- |
| ViewModel、页面持有者、纯 UI 与领域层 | [Compose 架构与导航：所有权、返回栈与自适应](#/article/compose-navigation) | 第 1 问 |
| 导航参数、深链接、返回栈、恢复、事件 | [Compose 架构与导航：所有权、返回栈与自适应](#/article/compose-navigation) | 第 2–4 问 |
| 多窗口/大屏、模块化、设计系统与组件 API | [Compose 架构与导航：所有权、返回栈与自适应](#/article/compose-navigation) | 第 5–6 问 |
| ComposeView、AndroidView、宿主与释放策略 | [Compose 互操作与迁移：宿主、复用、回滚与证据](#/article/compose-interop) | 第 1–3 问 |
| 池化复用、onReset/onRelease 与资源归属 | [Compose 互操作与迁移：宿主、复用、回滚与证据](#/article/compose-interop) | 第 4 问 |
| 迁移策略、测试、灰度、回滚、兼容、构建与责任 | [Compose 互操作与迁移：宿主、复用、回滚与证据](#/article/compose-interop) | 第 5–6 问 |


### 必修知识

- ViewModel、领域逻辑、页面状态持有者和纯 UI 的边界；持久状态与 UI 恢复的协作。
- 导航、返回栈、参数与数据加载、深链接、多窗口/大屏；Navigation 具体方案按项目版本选定。
- ComposeView、AndroidView、Fragment/View 生命周期与 composition disposal 策略。
- 页面级迁移、组件级迁移、设计系统先行的取舍；同屏互操作成本、测试和回滚。
- 模块化、设计系统、公共组件 API、版本升级、二进制/源码兼容和构建成本。
- 性能预算、变更审查、灰度、异常监控；跨团队推广后的维护责任。

阅读：[View 中使用 Compose](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/compose-in-views?hl=zh-cn)、[导航官方入口](https://developer.android.com/guide/navigation?hl=zh-cn)。

### 与五个资深能力目录对应的最终产物

| 分类 | 最终产物 |
| --- | --- |
| 08 技术决策 | 为什么迁移这个页面，保留现有 View 的备选方案是什么 |
| 09 复杂问题定位 | 一个状态/生命周期/性能问题的完整证据链 |
| 10 性能治理 | 指标、基线、设备矩阵、回归门槛和负责人 |
| 11 架构演进 | 分阶段迁移、兼容边界、退出和回滚方案 |
| 12 项目成果与证据 | 个人实际贡献、测量口径和收益限制；学习实验与真实线上成果分开 |

## 13. 一次 45 分钟专项自测

1. 5 分钟：解释 remember、State、Effect 各自职责。
2. 8 分钟：画出一次状态写入可能触发的阶段工作。
3. 10 分钟：推演条件分支、remember 和列表 key 的身份变化。
4. 10 分钟：解释编译器协议、Snapshot、Composer、Recomposer 的协作。
5. 7 分钟：给出卡顿现场，提出证据驱动的排查顺序。
6. 5 分钟：说明一个真实迁移决策、代价和验证方式。

这些是教学设计的追问，不宣称国内公司都问过。达标看能否推理新场景、指出版本条件、设计验证；不按背出了多少内部类名评分。

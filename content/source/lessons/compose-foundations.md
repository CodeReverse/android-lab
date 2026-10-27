## 1. 声明式 UI 的职责

Compose 用可组合函数描述界面随输入状态变化的关系。它提供运行时、UI、布局、交互等库；不是新的操作系统，也不替代 Activity、窗口、线程或系统图形管线。Android 上最终仍需要宿主接入平台生命周期和显示调度。

对搜索页，传统写法容易分散为“收到结果改列表、请求开始显示 loading、失败再隐藏 loading”；声明式写法先定义页面状态，再从该状态描述界面。区别不在是否使用 XML，而在谁是 UI 真相来源。若同时手改 View、修改独立布尔值并维护另一份列表，换成 Compose 仍会产生状态不一致。

## 2. 组合、布局与语义结构

需要区分三个观察角度：组合分组记录调用身份和记忆值；LayoutNode 等 UI 节点承担测量、放置等工作；Semantics 向无障碍和测试暴露含义与动作。仅提供主题的函数可以没有自己的布局节点；一个按钮内部可以有多个布局节点，却对用户呈现一个可点击语义对象。

判断层次问题时先问“我要观察的是状态保存位置、像素位置，还是用户能操作的元素”。在测试中找不到按钮里的文字，不足以证明布局里没有 Text；语义可能已合并。见[组件与语义](#/article/compose-components)和[测试正文](#/article/compose-testing)。

## 3. 界面更新的三个阶段

组合决定有哪些内容以及参数；布局决定尺寸与位置；绘制产生绘制指令。一个 State 在哪一阶段被读取，会影响变化后需要重做哪类工作。它们不是“每帧必须全部执行”的流水账。

先用同一搜索页推演：结果条数改变可能改变内容结构；已有图片平移可能只改变位置或图层属性；进度圆环颜色改变可以只影响绘制。若连变化属于哪种工作都没分清，背诵 Composer 字段也不能解释为什么某次点击卡顿。详细链路见[重组与阶段](#/article/compose-phases)。

## 4. BOM、编译器与库版本

BOM 用于协调所覆盖的 Compose 库版本，并不会自动加入全部库；Kotlin 与 Compose Compiler 插件是编译侧配置。Kotlin 2.0 起编译器迁入 Kotlin 仓库，插件版本随 Kotlin 对齐。不能只更新 BOM 后就声称编译器已经升级。[官方 BOM 说明](https://developer.android.com/develop/ui/compose/bom)、[编译器迁移说明](https://kotlinlang.org/docs/compose-compiler-migration-guide.html)。

学习记录至少保存：Kotlin/Compiler、Runtime/UI/Foundation/Material、Lifecycle/Navigation、AGP/JDK、设备 API、构建类型与编译选项。不要把开发分支源码当作项目所用二进制的准确实现。下面文章的算法示意不依赖某个字段偏移；要验证字段和调用顺序，必须切换到对应发布 tag 或 commit。

## 5. 按执行链阅读源码

先选择一个问题，例如“切换筛选条件后为什么 remember 重建”。写出最小输入及预期，再定位 API 入口、状态持有者、失效通知和执行方。记录每一步是公共契约、源码观察还是自己的假设。阅读顺序可用：mutableStateOf → Snapshot 状态读写 → Composition 的依赖记录 → Recomposer 调度 → Composer 执行 → Applier 应用节点操作。

每一步只回答一个问题，并保留版本。经典 SlotTable 的数组和 gap buffer 只解释某条实现路线；发布说明中存在新的实验实现记录，不能把旧布局当永久规范。学习共同的身份与复用语义，再比较存储成本。[Runtime 发布记录](https://developer.android.com/jetpack/androidx/releases/compose-runtime)、[经典设计说明](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/design/how-compose-works.md)。

## 6. 最小页面验证

给自己三个任务：画出一个按钮的组合/布局/语义关系；解释“普通变量变化、可观察 State 变化、参数变化”的不同；把一次搜索结果返回写成状态到显示的时序。若只能说“Compose 自动刷新”，就回到[状态正文](#/article/compose-state)。

实验设计：同一页面分别记录函数执行、布局、绘制，改变列表结构和颜色，比较触发范围。日志计数不能直接当帧耗时，也不能把函数执行次数视作用户看到的刷新次数。实际运行结果由读者在自己的 Android 工程中采集，本网站只提供资料与推演。

## 继续阅读与源码入口

- [声明式思维](https://developer.android.com/develop/ui/compose/mental-model)：读重执行和副作用边界，解释为什么 UI 描述不能混入支付提交。
- [阶段](https://developer.android.com/develop/ui/compose/phases)：读阶段内状态读取，画出颜色、位置、结构三个分支。
- 下一篇：[组件、主题与依赖边界](#/article/compose-components)。

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. Compose 是什么，它替换了 Android 的哪一层？（回看第 1 节）
2. 一次 Composable 调用会产生一个 View 吗？（回看第 2 节）
3. BOM、Kotlin 插件与 Runtime 是同一个版本吗？（回看第 4 节）
4. 如何开始一个可解释的源码阅读，而不是从文件第一行往下看？（回看第 5 节）
5. 第一轮复习做到什么程度才算有基础？（回看第 6 节）

## 1. 组合、测量、放置与绘制

组合回答显示什么，布局回答尺寸与位置，绘制回答怎样生成像素内容。布局内部又包含测量与放置。Compose 跟踪不同阶段的状态读取，因此一个状态变化可以只触发必要阶段，而不是固定从根开始执行全部流程。

假设滚动偏移只影响一个装饰元素的位置。如果在组合阶段先读 offset，再构造 Modifier，变化会牵涉组合；若把读取延迟到支持的放置 lambda，可让位置变化主要在布局阶段处理。关键是“value 在哪里读取”，不是变量在哪里声明，也不是代码表面有没有 lambda。

## 2. 读取位置与阶段失效

组合中的读被关联到重启作用域，修改后产生失效并由 Recomposer 协调。布局/绘制阶段也有各自观察与失效路径。一次重组可能没有改变实际 UI 节点，因而不需要全部后续工作；反过来，一个动画只改变绘制属性时，也可能没有新的组合却持续有新帧。

因此日志中 Composable 执行次数、重组计数、布局次数和屏幕呈现帧数不是同一个指标。把整个页面重组计数降为零也可能只是状态没被正确观察，不能自动视作优化。

## 3. 约束与 Modifier 顺序

父节点给子节点 constraints，子节点测量后报告尺寸，再在放置阶段确定位置。自定义 Layout 通常遵守一次测量的约束；固有尺寸查询与 SubcomposeLayout 等机制有特定用途和额外成本，不应简单套用“所有布局始终只有一次工作”。

Modifier 顺序改变约束、命中区域与绘制边界。padding 放在 clickable 之前或之后，可能改变可点击区域；size、clip 与 background 顺序也影响结果。可组合函数名相同但修饰链不同，不代表运行成本和行为相同。

## 4. 派生状态与延迟读取

derivedStateOf 减少下游关心的派生值变化，例如滚动很多次但“是否越过阈值”只变化两次；延迟读取则把依赖放到真正需要的阶段。二者可以配合，但不能互相替代。没有昂贵或高频依赖时，增加派生状态的跟踪成本可能得不偿失。

Lazy 列表通过按需组合和复用降低全量工作，仍需稳定 key、合适 contentType 和轻量 item 逻辑。图片解码、文本布局、频繁 state 写入都可能让列表卡顿；用 LazyColumn 不等于性能问题已经结束。

## 5. 三种偏移读取方式

以下为概念片段，省略 imports、单位换算和宿主，仅比较读取位置；前提是没有其他地方读取该 State：

```kotlin
// 组合中提前读出 value，组合成为消费者
val x = offsetState.value
Box(Modifier.offset(x.dp))

// 在放置阶段的 lambda 内读取
Box(Modifier.offset { IntOffset(offsetState.value, 0) })

// 仅绘制装饰时读取；布局占位不随它改变
Box(Modifier.drawBehind {
    drawCircle(Color.Red, center = Offset(offsetState.value.toFloat(), 20f))
})
```

第一种以 dp 表示输入，后两种以 px 为例，实际对照实验应统一物理位移。第二种改变放置，第三种只画偏移圆点，业务语义不同，不能直接互换。即使改成 lambda，若外部已经读出 x 然后只在 lambda 使用 x，依赖仍留在组合阶段。

## 6. Recomposer 与帧调度

把责任拆为：Snapshot 处理状态变化和通知；Composition 根据观察关系识别失效范围；Recomposer 协调待处理组合；Composer 在执行中复用或更新记录；变更应用到目标树；需要时由 UI 宿主进行布局绘制并接入平台帧调度。它们是协作关系，不是一个 Setter 直接递归调用所有 Text。

同一调度窗口多次写入可以合并为后续工作，因此 0→1→2 的每个中间值不一定都被屏幕呈现。具体调度时机、可暂停/并发实现等要对照所用版本，不能由概念链路断言所有工作都固定在同一个函数或线程。源码入口：[Recomposer](https://github.com/androidx/androidx/blob/androidx-main/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/Recomposer.kt)。

## 7. 参数变化与局部重组

直接读取的 State 失效，与父传参是否改变是不同条件。自身订阅失效时，不能仅以参数相等宣告跳过；父因为别的状态重执行时，符合跳过条件的子又可以复用已有内容。普通内联包装也不必形成独立重启范围，所以不要按源码函数大括号机械切分重组边界。

原创推演：页头读取 query，列表读取 results，点击更新 query 时先影响页头；如果屏幕根节点提前读取并构建全部状态参数，影响范围可能扩大。是否拆组件应看真实读取边界和 UI 语义，而不是把每一行都包装为函数。状态正确之后，再查看报告与 trace 判断比较开销和执行成本。

## 8. 布局回写与跨帧反馈

假设 onSizeChanged 把高度写到 State，组合读这个高度再决定另一个尺寸。首轮先布局才能得知高度，写入又导致后续重新组合与布局；若两者相互依赖，可能反复震荡。可在一次布局中求解的父子关系优先用 Layout 或合理的子组合方案表达。

验证设计：记录每帧输入状态、约束、测量尺寸和回写值，找出从布局到状态再到布局的闭环。不要只用 distinct 或限频压住症状，却保留错误依赖。完整诊断见[布局](#/article/compose-layout)和[性能](#/article/compose-performance)。

## 9. 阶段工作量的验证

对同一动画分别使用组合期读取、放置期读取和纯绘制读取，记录重组与帧时间。然后用 Macrobenchmark 观察真实交互，确认更少工作是否转化为长尾帧改善。当前文章给出实验路线，不提供虚构跑分。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [Compose phases](https://developer.android.com/develop/ui/compose/phases)
- [Compose 性能最佳实践](https://developer.android.com/develop/ui/compose/performance/bestpractices)
- [自定义布局](https://developer.android.com/develop/ui/compose/layouts/custom)

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. 组合、测量、放置与绘制分别做什么？（回看第 1 节）
2. 状态读取怎样决定哪一个阶段失效？（回看第 2 节）
3. 同一个偏移值，三种读取写法为什么工作不同？（回看第 5 节）
4. 布局回写状态为什么会形成跨帧反馈？（回看第 8 节）
5. 怎样证明减少了阶段工作，而不只减少重组次数？（回看第 9 节）

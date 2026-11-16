拖动一个收藏图标时，图标内容没有变，尺寸也没有变，只有位置在变。为什么有的写法会让描述界面的代码持续重跑，有的写法却主要更新放置？我们从同一个偏移量的三种读取位置开始，追到状态失效、Recomposer 和帧调度。

前置：[State 的可观察读写](#/article/compose-state)。示例使用 Compose UI/Foundation；通用 imports 与宿主省略，输出和阶段变化是机制推演，未在设备实测。本文“只影响某阶段”都以不存在其他消费者和额外失效为前提。

## 1. 先把一帧要解决的问题分开

做一个包含标题和圆点的页面。标题由字符串决定，圆点需要 24dp 空间，当前位置由 offsetPx 决定。绘制之前，系统至少需要回答三类问题：

```text
组合：要标题和圆点，参数是什么
布局：各自多大，放在哪里
绘制：在已经确定的空间中画文字、圆形和颜色
```

布局又包含测量与放置。测量产生尺寸，放置决定位置。圆点横向移动 10px，未必需要重新决定“要不要圆点”，也未必需要再次计算它的 24dp 尺寸。

一个简单 UI 系统可以任何变化都从头做完，容易实现，但高频位置变化会重复做无关工作。另一种设计让组件自己手工调用 invalidate、requestLayout 等接口，开发者要准确表达变化影响。Compose 利用阶段中的可观察读取，自动建立部分依赖关系。

注意这是工作划分，不是“每帧必定组合一次、测量一次、绘制一次”的固定流水线。复用已有结果正是划分阶段的价值；不同阶段也可能因其他原因再次执行。[官方阶段说明](https://developer.android.com/develop/ui/compose/phases)。

## 2. 读取发生在哪里，依赖就建立在哪里

先使用会在组合期间读出偏移的写法：

```kotlin
@Composable
fun MovingDot(offsetPx: State<Int>) {
    val xDp = with(LocalDensity.current) { offsetPx.value.toDp() }
    Box(
        Modifier.offset(x = xDp)
            .size(24.dp)
            .background(Color.Red, CircleShape)
    )
}
```

这里最重要的不是 `.offset`，而是 `offsetPx.value` 在函数执行时已经被读取。`toDp()` 得到普通 Dp 值，再作为参数构造 Modifier。offsetPx 改变后，组合读取者需要重新考虑 xDp，后面的放置也可能随之改变。

现在把读取本身交给放置阶段执行：

```kotlin
@Composable
fun MovingDot(offsetPx: State<Int>) {
    Box(
        Modifier.offset { IntOffset(offsetPx.value, 0) }
            .size(24.dp)
            .background(Color.Red, CircleShape)
    )
}
```

lambda 在组合时被提供，但其内部的 `.value` 在相关布局放置工作中才执行。这样偏移变化可以主要使放置失效，而不必仅因为这次偏移重新执行这段组合。

为什么下列修改无效？

```kotlin
val x = offsetPx.value
Box(Modifier.offset { IntOffset(x, 0) })
```

因为读取早已发生。lambda 只捕获普通整数 x，没有把对 State 的访问一起延后。**延迟传值与延迟读取不是同一回事**。状态在哪里创建也不是决定因素：同一个对象可以被不同阶段同时读取。

## 3. 位置、尺寸和修饰顺序不能混为一谈

移动圆点时，周围标题需不需要让位？如果需要，单纯 offset 可能不符合需求，因为它不等价于改变父布局为子项分配的尺寸。

可以先手画一个父布局：

```text
父布局分配：圆点占位 24px，标题从 x=24 开始
圆点只放置偏移 +10px：圆点可见位置改变，原占位关系未自动变为 34px
圆点实际测量变宽：父布局可能需要重新安排标题
```

图中使用 px 方便算术，不是上节 dp 的直接设备值。产品需要扩大占位时，应把变化放在正确的测量/布局关系中，而不是为了减少重组使用视觉替代。

Modifier 也不是无序属性表。先施加 padding 再施加背景，与先画背景再包 padding，会改变边界；点击区域也要跟相应顺序核对。只看最终圆点颜色正确，不能证明触摸范围与布局关系正确。

本篇只需要建立“哪些结果需要重新算”的模型；Constraints、测量算法与 Modifier.Node 的详细执行在 [布局第 1–6 节](#/article/compose-layout?section=1) 展开。

## 4. 减少结果变化与推迟读取解决不同问题

拖动圆点时，旁边还要显示“已经越过中线”。位置每帧变化，但提示只在跨过阈值时改变。即使把图标读取移到放置阶段，提示如果直接读每个偏移，仍会频繁关心输入。

```kotlin
val crossed by remember(offsetPx) {
    derivedStateOf { offsetPx.value > 100 }
}
Text(if (crossed) "已越过" else "未越过")
```

这里 offsetPx 是状态对象，用作 remember 的 key，使传入对象替换时重新建立派生计算。`derivedStateOf` 管理从高频输入到低频结果的依赖，消费者关心的是布尔结果。阈值 100 是本例业务定义，不是性能参数。

如果提示直接显示当前坐标，例如 `Text("${offsetPx.value}")`，每个新坐标都需要展示。用派生状态包一下并不会让必须变化的文本神奇地不再变化。

两种优化可以同时存在：圆点在放置阶段读取连续位移，文字消费较低频的派生布尔值。前者改变工作发生的位置，后者改变消费者真正关心的结果。派生状态的缓存与动态依赖见 [Snapshot 第 8、9 节](#/article/compose-snapshot?section=8)。

## 5. 用同一个输入比较三条更新路径

再加一个纯装饰圆点，不影响其他内容排布：

```kotlin
Box(
    Modifier.size(100.dp).drawBehind {
        drawCircle(
            color = Color.Red,
            radius = 12.dp.toPx(),
            center = Offset(offsetPx.value.toFloat(), size.height / 2)
        )
    }
)
```

`.value` 在绘制回调中读取，改变输入可以只让相关绘制重新工作。这里移动的是画布上的圆，并没有创建一个随圆移动的独立可点击节点，所以不能把它当作第二节按钮位移的无条件替换。

把三种路径并排记录：

| 写法 | 真正读取位置 | 此变化主要需要重新考虑的工作 |
| --- | --- | --- |
| 函数中先解引用，再传普通 Dp | 组合 | 组合，以及结果变化引起的后续工作 |
| offset lambda 内解引用 | 放置 | 放置及必要后续工作 |
| drawBehind 内解引用 | 绘制 | 绘制 |

如果同一个 offsetPx 还在页面顶部被读取并传入其他组件，组合依赖仍存在。优化前应列出所有读取者，不能仅改掉一处 lambda 就断言整个页面不再重组。

测量与放置有各自重启范围，不过复杂布局依赖可能相互影响；需要结合实际布局行为判断，不能把表格当所有场景的绝对执行次数。[阶段读取与延迟读取示例](https://developer.android.com/develop/ui/compose/phases)。

## 6. 一次写入怎样走到 Recomposer 与目标树

点击后执行 `state.value = newValue`，并不是 setter 立刻递归调用整个页面。先把参与者按职责放在一条时序中：

```text
业务写 State
  状态系统处理有效变化与快照可见性
  观察机制将变更与读取范围关联
  组合相关范围变为失效
  Recomposer 协调待处理组合工作与帧时机
  Composer 执行需要的组合，并记录变更
  应用阶段把变更作用到目标树
  UI 宿主按需要完成布局、绘制及平台呈现
```

Snapshot 的职责在 [快照教程](#/article/compose-snapshot) 已展开；这里关心的是失效之后谁负责工作。Composer 更接近“这次执行怎样维护组合记录”，Recomposer 更接近“哪些组合工作等待处理并如何协调”。它们不是两个同义名字。

仅有这张职责图还不足以解释为什么要等帧。若每个 setter 都立即重跑 UI，一个点击处理里连续修改三个值就可能把同一工作做三遍；动画又需要一致的帧时间。协调器需要把“发现有工作”和“在合适时机执行工作”拆开。

对本文固定提交的普通 `runRecomposeAndApplyChanges` 路径，可以提取以下教学伪代码，省略可移动内容、晚应用、错误恢复及并发变体：

```text
循环，直到协调器结束：
  挂起，等待待处理工作
  将观察到的修改记录到相关组合
  如果没有帧相关工作，继续等待
  等待父 FrameClock 给出帧时间：
    先向等待帧的动画等消费者发送时间
    处理这些消费者可能产生的新状态修改
    收集失效组合，执行需要的重组，积累待应用变更
    补充处理本轮发现的相关失效
    应用目标树变更，完成本轮通知与清理
```

这说明等待帧不是简单固定 sleep 16ms：时机由帧时钟协调，也可能只有动画等待者而没有一开始就排队的重组。动画收到时间后又写状态，因此本轮需要考虑新修改，不能只在最开始截一份列表就忽略后续。组合执行积累变更，再应用到目标树，应用完成也不等于 GPU 已经呈现像素。

不要把上述普通路径推断为任何版本都只有一个组合线程；也不要把 `applyChanges` 与 `MutableSnapshot.apply` 当作同一动作。前者应用组合产生的目标树变更，后者发布快照状态修改，职责与对象都不同。

假设在处理机会之前，状态从 0 改成 1，再改成 2。消费者随后读取时可能直接看到 2，中间的 1 不一定显示成一帧。这可以减少重复工作，但也意味着 State 不适合作为“每次事件必须消费”的队列。

更细的并发、可暂停实现和平台帧驱动随版本变化。读源码时用固定 Runtime 追踪 `runRecomposeAndApplyChanges` 等入口，再看宿主接入，不能把这张职责图说成每个版本完全相同的同步调用栈。[固定提交的 Recomposer](https://github.com/androidx/androidx/blob/b8f12c706099a47e1e44d9772d03e14a4ae37146/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/Recomposer.kt)。

## 7. 父参数变化与自身读取失效是两条入口

为搜索页拆出标题和结果区：

```kotlin
@Composable
fun SearchHeader(query: State<String>) {
    Text(query.value)
}

@Composable
fun SearchResults(results: State<List<String>>) {
    Column { results.value.forEach { Text(it) } }
}
```

这里把 State 对象传给各自消费者，值在内部读取。query 改变时，相关依赖更容易留在标题的实际读取范围。若在父函数先读 query.value 和 results.value 再组织全部内容，父就成为读取者，失效入口可能扩大。

这不是建议所有组件接口都改成 State。传普通不可变值往往更清楚；是否需要延迟读取应看真实热点与职责。代码结构、内联和编译后的重启边界也会影响实际范围，不能按源码大括号机械判断。

再看两种事件：父因为别的输入重新执行，子参数相等且具备跳过条件，可以复用；子内部自己读到的 State 失效，即使参数对象相同，也可能需要重新执行。

这两条入口解释了为什么“参数没变”不能直接推出“绝不重组”。稳定性与强跳过的比较规则在 [编译器第 4–7 节](#/article/compose-compiler?section=4) 单独展开。

## 8. 把布局结果写回状态可能跨帧形成反馈

有时为了让右侧内容匹配左侧高度，会先用 `onSizeChanged` 记录高度，再在组合中读出来：

```kotlin
var measuredHeight by remember { mutableStateOf(0) }
Box(Modifier.onSizeChanged { measuredHeight = it.height }) {
    LeftContent()
}
RightContent(heightPx = measuredHeight)
```

这里不是语法错误，但依赖是“先布局才知道高度，再写状态影响后续工作”。初始 measuredHeight 为 0，右侧先按旧值参与；布局回调之后，下一轮才可能使用新高度。能在同一次父布局中求解的关系，通常更适合在布局算法内测量并放置。

更糟的例子是尺寸反过来决定自己：

```text
高度 > 阈值 → 使用宽布局
高度 <= 阈值 → 使用窄布局
窄布局文字换行多 → 高度超过阈值
宽布局文字换行少 → 高度低于阈值
```

这会让宽窄之间来回切换。加 debounce 只是改变震荡速度，没有解决循环依赖。诊断时记录每帧的输入、约束、测量值和回写值，找出闭环，再把可同时计算的关系收回同一布局。

如果只是向外报告统计或与独立系统协作，布局回调仍有用途；原则是理解引入了什么时序，而不是一律禁止回调。自定义 Layout 与 SubcomposeLayout 的适用边界见 [布局第 3、4、7 节](#/article/compose-layout?section=3)。

## 9. 用对照实验判断是否真正减少了工作

为同一个可拖动元素准备组合读取版与放置读取版，确保物理位移、占位、触摸和语义一致；绘制版作为独立装饰对照，不混成相同产品行为。

先验证正确性：拖动起点终点、父布局位置、点击命中、字号和密度变化。再记录组合、测量、放置、绘制的工作迹象，用 trace 与 release-like 基准对照用户帧时间。

| 观察 | 可以支持什么 | 不能直接证明什么 |
| --- | --- | --- |
| 组合读取减少 | 缩小了一部分组合工作 | GPU 压力一定下降 |
| 放置次数增加 | 位移依赖进入该阶段 | 一定发生完整重新测量 |
| 函数日志出现 | 该执行路径被走过 | 内容已成功应用并呈现 |
| P95 帧时间改善 | 在记录条件下长尾有变化 | 所有设备、所有场景都同样受益 |

如果主要瓶颈是图片解码或后台抢占，减少几次廉价重组可能看不到体验收益。由假设决定改动，再让证据决定是否保留；完整性能实验在 [性能诊断第 1–6 节](#/article/compose-performance?section=1)。本篇没有生成设备跑分，也不把阶段示意当实测日志。

## 面试提炼

1. 为什么把组合、测量、放置和绘制分开，全部重做或手工失效有什么取舍？（回看第 1 节）
2. 外部先读 value 再把整数放进 lambda，为何没有延迟状态读取？（回看第 2 节）
3. derivedStateOf 与延迟读取分别改变什么，为什么不能互相替代？（回看第 4、5 节）
4. 从 State 写入到显示，Snapshot、Recomposer、Composer 和 UI 宿主各负责什么？（回看第 6、7 节）
5. 布局回写如何形成跨帧反馈，怎样验证阶段优化确实改善体验？（回看第 8、9 节）

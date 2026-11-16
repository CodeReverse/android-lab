搜索页不只是把状态画出来：它要请求数据、延迟提示、注册监听，有时还要嵌入旧 View。问题在于 Composable 可以重新执行，而这些动作不能随每次执行无条件重来。本篇让搜索页逐步增加需求，每次只引入解决当前问题的工具。

前置：[State 与数据源](#/article/compose-state)。代码使用 Runtime、kotlinx.coroutines 与 Material 3；服务调用和业务对象是示意接口，按段落说明替换。示例未在 Android 工程执行，不能将注释中的预期视作实测。

## 1. 界面描述被重复执行，外部动作不能跟着重复

先看一段错误思路的伪代码：

```text
SearchScreen(query):
    调用 repository.search(query)
    根据结果描述列表
```

当输入变了，重跑请求看起来合理。但主题、错误提示或另一个状态变化，也可能让这段函数重新执行；某次组合工作还可能没有最终应用。于是“调用函数一次”并不能表达“用户发起一次搜索”。

UI 描述主要根据输入计算结构；请求会改变外部世界、消耗资源并产生未来结果。二者需要不同的执行契约。否则为了展示一次 loading 而重执行，又发起新的请求，可能把状态更新和请求触发连成循环。

一种替代方案是把搜索完全放进 ViewModel：输入事件进入状态持有者，UI 只显示结果。这对跨配置持续的屏幕业务很合适。但动画、局部计时、与组合内容绑定的监听等仍需要在 UI 层拥有生命周期，Effect 正是为这些需求提供入口。

所以先问工作由谁拥有：离开这段 UI 就没意义，还是离开后仍应继续？这个答案先于选 LaunchedEffect 或全局作用域。

## 2. 用 key 表达一项协程工作的身份

先只做一个“输入稳定 300ms 后通知搜索”的局部组件：

```kotlin
@Composable
fun DebouncedSearch(query: String, onSearch: suspend (String) -> Unit) {
    LaunchedEffect(query) {
        delay(300)
        onSearch(query)
    }
}
```

需要 Runtime 的 LaunchedEffect 和协程 delay。进入组合时启动任务；query 改变时旧任务取消，新任务使用新 query；这段内容离开组合时任务取消。300ms 只是本例交互选择，不能作为通用防抖标准。

按时间线推演：

```text
0ms：query=A，启动计时 A
100ms：query=AB，取消 A，启动计时 AB
400ms：AB 计时结束，调用 onSearch(AB)
```

为什么 key 是 query？因为 query 变化意味着需要一项不同搜索工作。若永远写 Unit，组合位置不变时输入更新不会按 query 重启；任务可能仍使用启动时捕获的旧查询。

也不能把每帧变化但不定义工作身份的所有数据都塞进 key，那会让任务不断重启。上述片段还假设 onSearch 的实现身份稳定；如果回调可以变化，要决定变化是否要求重启，下一节处理“只更新回调”的情形。

取消是协作的。delay 能响应取消，某个阻塞库未必能立即停；Effect 管理协程生命周期，不替第三方库实现取消。[LaunchedEffect 的公开契约](https://developer.android.com/develop/ui/compose/side-effects)。

## 3. 计时保持不变，但完成后使用最新回调

给搜索页增加一个延时提示。产品要求进入页面 2 秒后提示一次；等待期间父层可以替换提示处理逻辑，但不应从头再等 2 秒。

若写 `LaunchedEffect(onTimeout)`，回调身份变化会重启计时；若写 Unit 却直接捕获 onTimeout，旧任务可能调用旧回调。我们需要稳定的工作身份，加一个能读到最新回调的容器：

```kotlin
@Composable
fun SearchHint(onTimeout: () -> Unit) {
    val latestOnTimeout by rememberUpdatedState(onTimeout)
    LaunchedEffect(Unit) {
        delay(2_000)
        latestOnTimeout()
    }
}
```

rememberUpdatedState 在后续组合中更新保存的值，让已经运行的任务访问当前回调。`latestOnTimeout()` 的委托读取发生在任务真正调用时，而不是只取出第一次的回调一直使用。

这里有两种变化：任务身份变化应取消重启；仅任务使用的数据变化可以更新读取。如果从账号 A 切到 B，查询所属账号已经变了，就不能只用 latest 回调把 A 的结果交给 B。账号应参与任务身份或由业务状态层隔离。

回到上一节，可以让 query 作为 key、回调用最新值模式；也可以把 onSearch 纳入 key，前提是重启符合需求。没有一个万能的“所有回调都加 key”规则。

## 4. 注册一次监听，就要定义一次解绑

搜索页还显示网络是否可用。假设已有一个回调式源，接口约定 register/unregister 配对：

```kotlin
interface StatusSource {
    fun register(listener: (Boolean) -> Unit)
    fun unregister(listener: (Boolean) -> Unit)
}

@Composable
fun ObserveStatus(source: StatusSource, onStatus: (Boolean) -> Unit) {
    val latestOnStatus by rememberUpdatedState(onStatus)
    DisposableEffect(source) {
        val listener: (Boolean) -> Unit = { latestOnStatus(it) }
        source.register(listener)
        onDispose { source.unregister(listener) }
    }
}
```

本例假设 source 在约定的 UI 执行上下文回调；若源从后台线程调用，应在适配层切换到消费者要求的上下文，并保留取消与身份校验。source 定义订阅身份，listener 是本次注册的具体对象。清理闭包保存同一 source 与同一 listener，避免“用新对象去解绑旧注册”。回调更新不需要重新注册，但 source 变化需要结束旧订阅。

为什么不用 LaunchedEffect 注册后立即返回？协程块完成不等于回调源已解绑；如果注册 API 没有挂起生命周期，需要明确清理。可以通过挂起适配或 callbackFlow 统一到业务层，但 DisposableEffect 是组合内配对资源的直接表达。

SideEffect 解决另一种需求：成功应用组合后，把最新配置同步给外部对象，例如更新一个分析组件的用户属性。它没有注册/解绑对称结构，执行块也不适合阻塞工作。用 effect 名称之前，先明确操作是持续资源、协程任务，还是成功应用后的短同步。

更底层为什么要区分已记住、已遗忘、已放弃，在 [组合结构第 8 节](#/article/compose-slots?section=8) 说明；[Effects 固定源码](https://github.com/androidx/androidx/blob/b8f12c706099a47e1e44d9772d03e14a4ae37146/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/Effects.kt)用于继续跟踪 RememberObserver 与 Job 的协作。

## 5. 用数据方向区分三种状态桥接

刚才 StatusSource 是“外部回调 → UI 状态”。若组件希望自己得到一个 State，而不是要求调用方接回调，可以用 produceState 组织生产与释放：

```kotlin
@Composable
fun rememberOnline(source: StatusSource): State<Boolean> =
    produceState(initialValue = false, key1 = source) {
        val listener: (Boolean) -> Unit = { online -> value = online }
        source.register(listener)
        awaitDispose { source.unregister(listener) }
    }
```

这里 false 是初始显示值；真实产品可能需要“尚未知”的第三种状态。source 作为 key 决定何时重建生产任务，awaitDispose 配对非挂起的注册资源。函数名含 remember 不赋予额外魔法，关键是 produceState 的生命周期协议。

若方向相反，要把列表滚动状态接到 Flow 链用于分析，可以使用 snapshotFlow：

```kotlin
LaunchedEffect(listState) {
    snapshotFlow { listState.firstVisibleItemIndex > 0 }
        .filter { it }
        .take(1)
        .collect { reportFirstScroll() }
}
```

这里 reportFirstScroll 是本例业务占位函数，需引入 Flow 操作符。收集时跟踪快照读取，相关变化后重新计算，结果按相等关系决定发射；不能把它当每次赋值必达的队列。块中应只计算结果，不写状态或执行外部操作。

如果只想决定按钮显隐，不需要异步流，那么 `derivedStateOf { ... }` 更贴合“输入状态 → 派生状态”。它不会启动后台协程，也不会让昂贵计算自动异步化。

这三个工具分别连接不同边界：外部生产进入 State、State 读取进入 Flow、State 派生另一个状态。先画数据方向，再选 API。[状态与副作用工具](https://developer.android.com/develop/ui/compose/side-effects)。

## 6. 搜索请求取消了，旧结果仍需要身份校验

防抖减少发出的请求，不能代替结果仲裁。设 A 请求已发出，随后 AB 发出并先返回；A 的某个非协作回调最后才到。如果它无条件写 UI，会把新结果覆盖。

先写清业务规则，再决定在哪一层实现：

```text
每次接受新查询：
    推进 requestGeneration
    记录当前 accountId、规范化 query
    请求携带这份身份

结果到达：
    账号与代次仍匹配 → 才能提交结果
    已过期 → 丢弃，不显示成当前请求的失败或成功
```

这个检查不仅应在画面赋值前，也要考虑缓存或数据库写入的账号归属。取消尽量减少无效工作，身份校验保护迟到结果；两者解决不同问题。

异常处理还要保留取消语义：

```kotlin
try {
    val result = repository.search(query) // 示意挂起接口
    publishIfCurrent(requestIdentity, result)
} catch (e: CancellationException) {
    throw e
} catch (e: IOException) {
    publishFailureIfCurrent(requestIdentity, e)
}
```

这不是完整仓储实现；publishIfCurrent 需要在状态拥有者的受控执行边界核验与更新，不能校验后任由另一个线程切换身份再无条件提交。新旧请求并发规则可由 ViewModel 状态机表达，而不是分散在多个 UI effect 里。

跨配置持续的搜索应交给相应状态持有者。Composable 负责提交输入与消费状态，数据桥接见 [State 第 7 节](#/article/compose-state?section=7)；取消机制本身见 [协程教程](#/article/coroutines)。

## 7. 把 source 切换完整走一遍

第 4 节的监听例子可以用四个动作检查：进入 source A，更新 onStatus，切换 source B，离开页面。先写预期表：

| 动作 | 订阅动作 | 后续回调应交给谁 |
| --- | --- | --- |
| 初次进入 A | A 注册 listenerA | 当前 onStatus |
| 仅回调更新 | 不因这次更新重新注册 | 更新后的 onStatus |
| A 换成 B | 解绑 A，绑定 B | B 所属的当前处理逻辑 |
| 离开内容 | 解绑 B | 不再接受该 UI 订阅 |

这张表解释了 owner 作为 key、latest 回调作为读取值的配合。若把所有东西都放 Unit，切换 B 不会重建正确订阅；若把每次创建的新 listener 作为 key，又可能无端重启。

底层 unregister 也可能无法撤销已经在队列里的回调。如果回调会提交账号数据，要在业务层继续核验身份。`onDispose` 是清理入口，不是让全世界在同一瞬间撤回在途工作的协议。

可以用 fake source 记录注册对象与解绑对象是否相同，再主动派发“解绑后迟到事件”。这个 Spike 能验证我们最容易漏掉的假设：停止订阅是否等于绝无旧事件。结果以实际源契约为准。

## 8. 混合 View 页面也需要同样的所有权协议

如果搜索结果包含旧地图 View，创建、更新和释放对应不同时间：

```kotlin
AndroidView(
    factory = { context -> LegacyMapView(context) },
    update = { view -> view.showSelected(selectedId) }
)
```

LegacyMapView 为业务占位类。factory 用于创建，update 可能在状态变化后再次执行。因此昂贵对象构造、无限追加监听或启动不可回收任务不应藏在 update 中。

另一方向，Fragment 用 ComposeView 承载内容时，Fragment 本体与它的 View 生命周期不同。旧 View 被销毁后，组合及监听应跟随正确边界结束，不能等 Fragment 最终消失才处理。

此处不用新的记忆口诀：仍然是“谁创建、谁持有、什么变化需要重新绑定、何时释放”。宿主配置、AndroidView 重置与回收的协议推演放在 [互操作第 1–4 节](#/article/compose-interop?section=1)，避免把资源生命周期在两篇中各讲半套。

## 9. 点击动作与持续任务选择不同触发入口

用户点击显示 Snackbar，是一个事件，不需要等某个 key 变化来推断。可在组合中取得受该位置生命周期管理的作用域，再从事件启动：

```kotlin
val scope = rememberCoroutineScope()
val host = remember { SnackbarHostState() }
Button(onClick = {
    scope.launch { host.showSnackbar("已提交收藏操作") }
}) {
    Text("收藏")
}
```

SnackbarHostState 需接入相应宿主才能显示。rememberCoroutineScope 提供事件发生时可用的 scope，本身不在每次组合时启动任务；内容离开后，该 scope 的任务会取消。

如果是必须离开页面仍完成的上传，这个寿命就不对，应交给业务任务层或适合的持久工作机制。若是付款，LaunchedEffect(Unit) 也不能保证恰好一次：重新进入页面会有新的生命周期，进程还可能在服务端成功后、本地确认前死亡。

副作用的 UI 生命周期与业务幂等是两层协议。支付操作需要稳定业务操作 ID、服务端防重及恢复查询；不能把技术方案缩成“把 key 固定就不会重复”。[请求幂等与结果未知](#/article/network-reliability)继续解释跨系统边界。

## 10. 用失败时序检验 Effect 选择

现在搜索页已有输入、提示、监听和点击操作。不要只在正常启动时看它们各执行一次，而要主动改变所有权与工作身份：

```text
输入 A → 改 AB → AB 返回 → A 迟到
计时开始 → 回调替换 → 计时完成
source A → source B → A 已排队回调迟到
点击开始任务 → 内容离开 → 再次进入
```

每条时序都写明确断言：当前结果属于 AB；计时未因仅回调变化而重置；旧账号结果不能污染新账号；注册与解绑对象配对；任务是否继续符合寿命要求。

测试时控制 fake 源和协程调度，不用随意 sleep 等运气。虚拟时间能控制 delay，不代表真实网络和阻塞 native 任务已经停止；这些另做集成验证。方法见 [测试第 2–5 节](#/article/compose-testing?section=2)。

到源码层，再把 effect 的身份记忆、成功应用、遗忘时取消或清理串起来。无需为记住 API 名称背一棵完整继承树；应能解释如果删掉 key、清理或最新值容器，前面的哪个实验会失败。

## 面试提炼

1. 为什么 Composable 函数体不能承担“业务恰好执行一次”的触发语义？（回看第 1 节）
2. key 变化与回调更新有什么区别，什么时候选择重启，什么时候只读最新值？（回看第 2、3 节）
3. DisposableEffect 怎样保证配对清理，为什么仍需考虑迟到回调？（回看第 4、7 节）
4. produceState、snapshotFlow、derivedStateOf 分别连接什么数据方向？（回看第 5 节）
5. 从搜索取消到付款幂等，哪些保证属于 UI 生命周期，哪些需要业务协议？（回看第 6、9、10 节）

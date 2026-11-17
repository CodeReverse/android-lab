## 1. 一个页面为什么会发两次请求

搜索页同时在内容区和角标收集同一个 Flow，日志却出现两次查询。先看生产端：

```kotlin
fun results(query: String): Flow<List<Item>> = flow {
    emit(repository.search(query))
}
```

`Item` 和 repository 是教学占位。这里返回的是冷流：描述如何生产数据，调用 results 不等于已经开始查询；每次 collect 都执行一次 flow 块。两个消费者就是两次独立执行。冷流的好处是工作归收集者，取消后上游可以结束；代价是需要共享时必须明确安排共享范围。Flow 是异步数据序列的抽象，不是天然缓存，也不是天然广播。

## 2. 先不加线程，走一次生产和消费

假设上游产生 A、B、C，每次加工需要 100 ms，下游渲染每项需要 200 ms。忽略调度开销，顺序流的教学时间线是：

```text
加工 A 100 → 消费 A 200 → 加工 B 100 → 消费 B 200 → ...
```

emit 会等待下游处理，这就是默认的背压：慢消费者限制快生产者，避免无限堆积。三项总计约 900 ms 是该简化模型的计算值，不是设备测量值。

加入 `buffer(1)` 后，生产和消费通过有界通道分开：消费者处理 A 时，生产者可以加工 B。队列满了仍要等待。它改变重叠程度，不会让慢消费者无限加速；也不保证必然创建另一个线程。为什么不直接无限缓冲？每项可能持有图片或大列表，延迟最终会变成内存问题。

`conflate` 丢弃未消费的旧值，适合只关心最新进度；`collectLatest` 取消旧值的处理块，适合可取消的搜索渲染。付款事件不能因为“更新”就丢掉，这由业务语义决定。操作符行为可核对 [Kotlin Flow 文档](https://kotlinlang.org/docs/coroutines-flow.html)。

## 3. flowOn 改变的是哪一段

加工搜索结果很重，希望上游在计算线程执行，UI 收集仍在主线程：

```kotlin
results(query)
    .map { items -> rank(items) }
    .flowOn(Dispatchers.Default)
    .collect { items -> render(items) }
```

flowOn 影响它上面的生产和 map，不把下面的 collect 一并迁走。这样收集者不必知道数据源内部选什么线程。跨调度边界时会引入协调及缓冲，取消时不能假设所有已发出的在途值一定到达。

在普通 `flow {}` 内随意 withContext 切换后 emit，会违反该构建器的上下文约束。多协程生产可评估 channelFlow；单个计算块也可以先在其他上下文算出结果，再回到原上下文 emit。上下文保存和取消先读 [协程第 3–5 节](#/article/coroutines?section=3)。

## 4. 共享工作之前先确定谁拥有它

两个 UI 消费者确实需要同一份搜索状态，可以把冷流转换成由 ViewModel scope 持有的 StateFlow：

```kotlin
val uiState = repository.observeItems()
    .map { items -> UiState(items = items) }
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = UiState(items = emptyList())
    )
```

这段代码展示所有权，不是一套完整加载错误模型。共享协程由 scope 管；订阅策略决定何时启动、停止上游。示例中的 5 秒是人为选择的停止宽限，用于跨短暂订阅中断保留上游工作，不是通用最佳值，也不是缓存过期时间。默认 replay 保留行为应与自己的重置需求一起审查。

StateFlow 需要初值，保存最新状态，并按 equals 合并相等值。它解决“现在是什么”，不是可靠记录“发生过几次”。shareIn 则产生 SharedFlow，replay 和缓冲需要按广播需求配置；无订阅者时的行为不能简单套用有消费者时的容量推理。契约见 [StateFlow](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-state-flow/) 与 [shareIn](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/share-in.html)。

## 5. 状态不刷新，先检查是否真的产生新值

如果把 `state.value.items` 强转成可变列表并原地追加，再把同一个 UiState 赋回去，旧、新状态可能 equals 相等，消费者不会看到预期变化。正确方向是产生新的状态值，同时保持旧状态不被后来修改：

```kotlin
_state.update { old -> old.copy(items = old.items + item) }
```

update 的函数可能因并发竞争重新求值，因此里面不要发送网络请求或计费。这里只计算下一个状态；外部副作用另行管理。Kotlin 只读 List 也不等于底层对象不可变，相关边界见 [集合与可变性](#/article/collections)。

同理，连续两次“支付成功”字符串不适合当作状态事件计数。需要可靠处理的业务事实应持久化、有唯一 ID 和确认状态；临时提示是否允许丢失应显式决定，不是换一个 Flow 类型就获得事务保证。

## 6. 收集结束以后，监听器也应结束

把定位监听封装为 callbackFlow 时，注册与解绑必须成对：

```kotlin
fun locations() = callbackFlow {
    val listener = Listener { value ->
        val result = trySend(value)
        // 教学提示：按业务处理关闭或缓冲满，不能默认发送成功
    }
    source.register(listener)
    awaitClose { source.unregister(listener) }
}
```

Listener/source 是示意接口。真实适配还要处理注册异常、回调线程以及取消和解绑竞争。UI 可用 repeatOnLifecycle 在合适状态内收集：界面停止时取消收集，回到前台重新启动；它不是保证只执行一次的工具。验证时数清注册、解绑和上游查询次数，再测试慢消费者与快速切换条件。本文时间线为推导，未声明真实基准结果。

## 面试提炼

1. 同一个冷 Flow 为什么能执行两次查询？（第 1 节）
2. buffer、conflate、collectLatest 分别改变什么语义？（第 2 节）
3. flowOn 为什么只影响上游？（第 3 节）
4. stateIn 的 scope、订阅策略、初值各有什么责任？（第 4 节）
5. equals、可变列表与重复业务事件怎样导致状态设计错误？（第 5、6 节）

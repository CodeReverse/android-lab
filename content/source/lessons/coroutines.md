## 1. 从顺序代码里找出等待

详情页先取得用户，再加载该用户的订单。回调可以完成这件事，但第二步的成功、异常和页面取消散落在不同位置。我们希望代码顺序接近业务顺序：

```kotlin
suspend fun loadDetail(): Detail {
    val user = loadUser()
    val orders = loadOrders(user.id)
    return Detail(user, orders)
}
```

`Detail` 和两个加载函数是教学用业务类型；这里假设加载 API 本身支持挂起等待。`suspend` 允许函数暂停后继续，不保证一定暂停，更不保证开线程。若 `loadUser` 内部直接执行阻塞读取，调用它的线程仍被占住。先区分这两种等待：阻塞保留线程执行栈并等待；挂起保存继续计算所需的状态，让当前线程有机会处理其他工作。

为什么不每个请求开一个线程？线程有栈、调度及切换成本，等待数很多时尤其明显。协程把等待中的计算和线程解耦，但实际执行代码仍要用线程；它没有消除 CPU 和下游连接容量限制。

## 2. 顺序代码怎样记住恢复位置

普通函数依靠调用栈记住“下一行”。挂起后这段栈不必一直占着线程，恢复位置就需要另一种载体：Continuation。编译器按挂起点转换控制流。下面是解释用途的伪代码，不是某个 Kotlin 版本的反编译输出：

```text
state = 0, savedUser = null
resume(result):
  state 0:
    state = 1
    r = loadUser(thisContinuation)
    if r == SUSPENDED: return SUSPENDED
    result = r
  state 1:
    user = checkedResult(result)
    savedUser = user
    state = 2
    r = loadOrders(user.id, thisContinuation)
    if r == SUSPENDED: return SUSPENDED
    result = r
  state 2:
    return Detail(savedUser, checkedResult(result))
```

第一次真正挂起时，状态已经设为 1。恢复携带用户结果，从状态 1 继续；第二次挂起前把后面要用的 `user` 保存起来。若加载函数命中内存缓存直接返回，就顺着同一次调用继续，不需要先挂起再恢复。`checkedResult` 表示结果可能包含异常，不能把失败当正常用户使用。

因此不是“每行代码都变成一个线程”，也不是保存整个线程栈。需要跨挂起点存活的局部变量、位置标签及后续 Continuation 构成恢复所需的信息。具体生成类、内联和状态机消除依编译器而变；语言模型可查 [Kotlin 协程规范](https://kotlinlang.org/spec/asynchronous-programming-with-coroutines.html)。

## 3. 能恢复以后，谁负责让它继续运行

Continuation 解释了恢复什么，Dispatcher 决定在哪里调度恢复，Job 表达谁拥有这项工作。三者不能合并成“协程就是轻量线程”。页面 scope 里的任务通常跟随页面级状态所有者；作用域取消后，不应还把旧结果更新到新页面。

```kotlin
suspend fun readLegacyFile(): ByteArray = withContext(Dispatchers.IO) {
    blockingFileRead() // 教学占位：第三方阻塞函数
}
```

这里显式把阻塞段安排到适合阻塞 I/O 的调度器；标注 suspend 本身做不到。CPU 计算另需控制并行度；即使使用 IO，也应按数据库连接、文件句柄等资源设置容量，不能认为线程池会替业务做背压。调度器能换线程，任意 `ThreadLocal` 却不会自动获得正确的跨恢复语义。

## 4. 两个请求可以并行，失败也必须有归属

订单依赖用户，不能凭空并行；用户资料和独立的权益请求则可以。把这个区别写进任务结构：

```kotlin
suspend fun loadScreen() = coroutineScope {
    val user = async { loadUser() }
    val rights = async { loadRights() }
    Screen(user.await(), rights.await())
}
```

先创建两个子任务，再等待两个结果。普通父子结构下，一个子任务失败会影响父和兄弟；作用域不会在仍有子任务运行时正常返回。`async` 保存结果，不意味着失败只在 await 那一刻才影响父级。

如果推荐位失败允许降级，才需要监督关系及它自己的异常处理。`supervisorScope` 改变子失败对兄弟的影响，并不为失败自动生成默认值。更稳妥的评审问题是“哪些结果缺一不可”，然后选择任务树，而不是全局使用 SupervisorJob。异常处理细节见 [协程异常传播](https://kotlinlang.org/docs/exception-handling.html)。

## 5. 取消是一项协议，不是强制中断

用户离开页面时，cancel 先改变 Job 状态。可取消挂起点检查这一状态；纯计算循环要主动 `ensureActive()`；不响应中断的阻塞库还需要它自己的关闭接口。这解释了为什么发出取消后，旧回调仍可能到达。

回调转挂起需要处理三个时序：先取消后回调、先成功后取消、资源交付但协程尚未实际使用就取消。可用 `suspendCancellableCoroutine`，但不能只写一行 resume：必须按其 API 契约解绑回调，连接底层 cancel，并为资源未被接收的窗口安排关闭。接口与重载依版本核对 [可取消挂起 API](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/suspend-cancellable-coroutine.html)。

业务层还应校验账号和请求代次。取消节省资源，代次检查保护结果归属，两者职责不同。捕获异常时不要吞掉 CancellationException 后继续重试；普通清理放 finally，必须挂起的清理只在小范围、有限时间内使用 NonCancellable。

## 6. 用时序验证设计

教学验证可以把加载函数分别替换成可取消 delay、带检查的计算循环和不可取消回调：在同一逻辑时刻取消，记录 Job 完成、资源关闭和 UI 写入时刻。预期是三者停止路径不同，而不是取消后必然零延迟结束。

再让权益请求先失败，观察用户请求是否被取消；把权益改为可降级后，验证页面仍只发布完整的合法状态。测试调度器适合控制挂起顺序，不能证明真实多线程没有竞争。本文给出验证方案，未声称运行过设备实验；后续连续数据传递见 [Flow 的生产、缓冲与共享](#/article/flow-state)。

## 面试提炼

1. suspend 为什么不等于切线程？Continuation 具体保存什么？（第 1、2 节）
2. 函数直接返回与真正挂起怎样走不同路径？（第 2 节）
3. Dispatcher、Job 和作用域分别解决什么问题？（第 3、4 节）
4. async 的异常为什么可能在 await 前影响父任务？（第 4 节）
5. 取消与资源交付同时发生时，谁负责关闭资源？（第 5、6 节）

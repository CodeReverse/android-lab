## 1. 从后台结果回到主线程

下载线程拿到图片后不能随意修改 View，我们先把界面更新交给主线程：

```kotlin
val uiHandler = Handler(Looper.getMainLooper())
// result 是已经准备好的结果，不在 lambda 中执行阻塞下载
uiHandler.post { renderResult(result) }
```

post 的调用发生在下载线程，lambda 的执行发生在绑定的 Looper 线程。Handler 没有创建线程，只是提交工作。若 lambda 里又解码大图或等待网络，主线程依然会卡住。这里真正需要解释的是：任务存在哪里，主线程什么时候取，怎样从睡眠中被唤醒。

本文源码基线固定为 AOSP `android-14.0.0_r1`，不把该标签的队列内部结构当成所有后续 Android 版本的保证。公开 API 参见 [Handler](https://developer.android.com/reference/android/os/Handler)。

## 2. 四个角色连接一次执行

```text
发送线程 → Handler → MessageQueue
                         ↓ next()
目标线程 → Looper.loop → Handler.dispatchMessage → Runnable
```

Message 保存任务数据、目标 Handler 与调度时间；MessageQueue 保存待处理消息；Looper 在所属线程循环取得可运行消息；Handler 负责提交与分派。多个 Handler 可以共用同一 Looper，因此不能靠创建更多主线程 Handler 获得并行。

普通线程要先 `Looper.prepare()` 再进入 `Looper.loop()` 才会消费消息；ThreadLocal 建立当前线程与 Looper 的关联，不负责同步所有发送者对队列的访问。HandlerThread 封装了常见的准备和循环过程。主线程的这些准备由框架完成，应用不应再次 prepare。

## 3. Runnable 为什么没有走 handleMessage

post 会把 Runnable 放入 Message.callback。分派的关键顺序可以写成下面的教学伪代码：

```text
dispatch(message):
  if message.callback exists:
    run(message.callback)
  else if handlerCallback exists and consumes(message):
    return
  else:
    handleMessage(message)
```

因此 override handleMessage 不是拦截所有 post 的入口。Message.target 则决定由哪个 Handler 分派；它与 Message.callback 是两个不同字段。源码可对照 [Handler.java](https://android.googlesource.com/platform/frameworks/base/+/android-14.0.0_r1/core/java/android/os/Handler.java) 的 post、enqueueMessage 与 dispatchMessage。

消息对象可能从池复用。入队后再修改载荷或重复发送同一个 Message，会破坏所有权与时序假设；发送可变业务对象也不能靠队列自动消除后续并发修改。

## 4. 队列按时间安排，执行却仍是串行

在本标签中，队列以链接结构组织消息，入队和取出关键路径使用同步保护。假设当前 uptime 为 0，三条普通消息的 when 分别为 100、30、60，队列会优先考虑 30，而不是按三次调用的先后固定 FIFO。

```text
队列：B(30) → C(60) → A(100)
若 B 从 30 执行到 110：C 最早只能在 110 后执行
```

这是手工演算，不是实测时间。postDelayed 给最早可调度时间，不能抢占正在运行的 B。使用 uptime 时基也意味着深度休眠等因素会影响实际墙钟等待；它不是跨休眠的精准闹钟。若业务需要系统级定时，必须另选符合后台限制的机制。

## 5. 没有任务时为什么不会把 CPU 转满

取消息时，若下一条还没到期，会计算等待时间；若没有可执行消息，可能进入无限等待。nativePollOnce 将线程置于 native 等待机制中，循环存在不等于持续执行指令。

```text
检查队列 → 无到期消息 → 等待
发送者插入更早可执行的消息 → 按条件 nativeWake
等待返回 → 重新检查队列 → 取出并执行
```

为什么不是每次 post 都 wake？假如线程已计划在 30 时醒来，新消息到期时间为 80，就没有必要为它提前唤醒；而新消息在 10 到期，通常要更新等待。实际条件还包括是否已经阻塞及屏障状态。同步保护和唤醒协议一起避免“检查完准备睡眠时错过新工作”的竞态。源码见 [MessageQueue.next / enqueueMessage](https://android.googlesource.com/platform/frameworks/base/+/android-14.0.0_r1/core/java/android/os/MessageQueue.java)。

## 6. 同步屏障只改变选择，不创造线程

框架某些调度路径会插入同步屏障。本标签用特殊队列节点表达屏障；当它挡在选择位置时，普通同步消息暂缓，队列寻找可运行的异步消息。

```text
屏障 → 普通消息 A → 异步消息 B
选择可能越过 A 处理 B；A 没有被删除，也没换线程
```

“异步 Handler”因此不是后台 Handler，也不是永远比所有消息优先。没有屏障时仍按正常条件安排，正在执行的任务也不会被它打断。屏障若长期不移除可能让同步消息饥饿；应用不应通过隐藏接口自行插屏障，或把所有任务改异步来掩盖卡顿。

## 7. 空闲与退出都需要明确契约

IdleHandler 适合观察或安排少量空闲工作，但“现在没到期消息”不能保证接下来一段时间没有用户输入。一个 100 ms 的空闲回调开始后，新输入仍可能被它挡住。因此把所有初始化塞入 IdleHandler，只是把工作移到了另一处。

quit 请求退出，quitSafely 在相应契约下处理已经到期的工作后退出，并不等待全部未来延迟任务。发送成功只表示队列接受了消息，不是业务已完成。需要完成确认时，应另设结果或状态协议。主 Looper 不能由应用随意退出；后台 HandlerThread 的停止也要与资源关闭配套。可查 [Looper](https://developer.android.com/reference/android/os/Looper)。

## 8. 页面泄漏沿着消息所有权追

```text
存活线程 → Looper → 队列 → Message → Runnable → Activity
```

页面离开不改变这条引用路径。静态 Handler 也不够：Runnable 仍可以捕获 Activity。页面拥有的任务，应保存可取消的具体回调并在相应生命周期结束时撤销：

```kotlin
private val refresh = Runnable { renderCurrentPage() }
fun schedule() { handler.postDelayed(refresh, 1_000) }
fun stopPageWork() { handler.removeCallbacks(refresh) }
```

这段示例只撤销该回调，避免清空共享 Handler 的全部工作。若回调已经执行，removeCallbacks 不能回滚它；异步结果还需检查代次和所有者。弱引用最多改变对象保留关系，不能代替停止无用下载、数据库写入或重复计时器。

## 9. 用排队时间与执行时间定位卡顿

为同一条任务记录投递时刻、计划时刻、实际开始和结束。排队很久但执行很短，查前置任务、锁或系统调度；执行本身很长，再查回调内部计算、I/O 与等待。把这些时刻放到故障时间窗里，才能解释用户看到的延迟。

单张栈里出现 nativePollOnce 常见于空闲，也可能是采样时卡顿已经结束，不能独立定罪。完整排查见 [ANR](#/article/anr-diagnosis)。教学验证可在隔离环境安排可控长任务与短任务，比较预期和实际顺序，再检查页面退出后回调与对象数量；本文未运行设备实验。

## 面试提炼

1. Handler 为什么不负责创建线程，四个角色怎样协作？（第 1、2 节）
2. post 为什么可能绕过 handleMessage？（第 3 节）
3. 延迟消息为何不保证准时，等待为何不忙轮询？（第 4、5 节）
4. 异步消息、屏障与 IdleHandler 分别改变什么？（第 6、7 节）
5. 如何同时验证任务取消、页面保留和排队延迟？（第 8、9 节）

## 1. Handler 的线程通信职责

Handler 向指定 Looper 的队列提交工作，并在该 Looper 所属线程处理消息。它既不是线程，也不会创建线程。执行位置取决于绑定的 Looper，而不是调用 post 的线程；异步 Handler 也不代表后台线程。

## 2. 消息循环的四个角色

Message 保存目标、回调、数据和调度时间；MessageQueue 管理待处理消息；Looper 循环取出并分派消息；Handler 提供发送和处理入口。一个 Looper 可服务多个 Handler，但它们仍在同一线程串行执行，一个长回调会延后后续消息。

## 3. Looper 与线程绑定

Looper.prepare 通过 ThreadLocal 建立当前线程的 Looper，并禁止重复准备。主线程由框架准备；普通线程需显式准备并进入 loop 才会消费消息。HandlerThread 封装了这一生命周期。ThreadLocal 负责绑定，队列的跨线程访问另需同步；退出后投递可能失败。

## 4. 消息投递到分派

以 AOSP android-14.0.0_r1 为基线，执行链是：

`sendMessageAtTime → enqueueMessage → MessageQueue.next → Looper → Handler.dispatchMessage`

post 把 Runnable 放入 Message.callback。分派时优先运行它，其次尝试 Handler.Callback，未消费时才调用 handleMessage。因此重写 handleMessage 不会截获所有 post。消息存在复用池与 in-use 约束，入队后不要重复发送或修改同一 Message。

## 5. 多线程入队与同步

上述版本用临界区保护队列结构，并结合队列状态决定唤醒。Looper 的线程本地绑定不能替代这种同步。业务载荷也需要所有权协议：发送者入队后继续修改同一对象会引入竞争，宜传不可变快照或明确移交所有权。

## 6. 阻塞等待与唤醒

队列没有到期可执行消息时，nativePollOnce 进入等待；新工作改变等待条件时，队列按需调用 nativeWake。它不是持续空转，也不是每次 post 都无条件唤醒。

同标签的 native Looper 使用 epoll 等待和 eventfd 唤醒：写入 eventfd 令其可读，等待返回后消费事件并重新检查工作。唤醒只表示重新检查条件，不等于消息已经执行。Java 队列同步和 native 等待共同处理检查、入睡与入队之间的竞态。

## 7. 延迟消息与时钟

postDelayed 指定最早可执行时间，时基与 uptimeMillis 相关；深度休眠、前置任务和线程调度都可能使实际执行更晚。例如消息计划在 100 ms 运行，而当前回调到 180 ms 才返回，它不能抢占该回调。跨休眠定时需求应另选适合的系统调度能力。

## 8. 同步屏障与异步消息

在上述队列实现中，同步屏障暂缓其后的同步消息，允许符合条件的异步消息被选中；它不打断已运行的回调，也不改变执行线程。没有屏障时，异步消息不是普遍最高优先级。屏障未移除可能导致饥饿，应用不应依赖隐藏接口插入屏障或把全部消息改异步来掩盖问题。

## 9. 空闲回调与退出

IdleHandler 在符合空闲条件时运行，但重任务仍会阻挡随后到来的输入。quit 退出循环并丢弃相应工作；quitSafely 在契约范围内处理已到期工作后退出，不会等完全部未来延迟消息。投递成功也不代表业务已完成。

## 10. 消息引用与页面泄漏

典型保留链是：存活线程 → Looper → 队列 → Message → Runnable/Handler → Activity。即使 Handler 是静态内部类，Runnable 仍可能捕获页面。页面级任务应在生命周期结束时撤销，长期任务交给相应所有者。共享 Handler 上无差别清空回调会误删其他任务，应按回调或 token 管理；弱引用不能代替取消。

## 11. nativePollOnce 与 ANR 证据

单独看到 nativePollOnce 无法确定 ANR 根因：它可能是正常空闲，也可能采样时阻塞已结束。需对齐故障时间窗、调度、锁和 Binder 等待链。

记录入队、计划执行和分派起止：排队长而回调短，查前置阻塞；回调本身长，查计算、IO 或锁。进一步阅读 [ANR 等待链](#/article/anr-diagnosis)。

## 12. 消息时序的验证

在隔离调试场景投递一个可控长任务和两条带时间戳的短任务，比较计划时间与实际分派，验证串行和延后；再对比页面退出前取消与未取消延迟回调时的引用链。保留版本、时间线和存活对象，不在真实主流程注入阻塞，也不使用隐藏屏障 API。此处是验证设计，未执行设备实验。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [Handler API 与调度时基](https://developer.android.com/reference/android/os/Handler)
- [AOSP android-14.0.0_r1 Handler](https://android.googlesource.com/platform/frameworks/base/+/android-14.0.0_r1/core/java/android/os/Handler.java)
- [AOSP android-14.0.0_r1 MessageQueue](https://android.googlesource.com/platform/frameworks/base/+/android-14.0.0_r1/core/java/android/os/MessageQueue.java)
- [AOSP android-14.0.0_r1 Looper](https://android.googlesource.com/platform/frameworks/base/+/android-14.0.0_r1/core/java/android/os/Looper.java)
- [LeakCanary 工作机制](https://square.github.io/leakcanary/fundamentals-how-leakcanary-works/)

- [AOSP android-14.0.0_r1 native Looper：eventfd / epoll](https://android.googlesource.com/platform/system/core/+/android-14.0.0_r1/libutils/Looper.cpp)

## 面经选题来源

原帖仅支持选题，不代表本文全部内容是公司原题，也不用于估算行业频率。

- [美团 Android 一面 · 2025-02-17](https://www.nowcoder.com/feed/main/detail/592247f523b64d45bb0dd5f28bdfaf56)：涉及 Handler 导致的内存泄漏。
- [小米安卓一二面 · 2025-10-27](https://www.nowcoder.com/feed/main/detail/2f0777d95e974ce686abc063a75f5349)：涉及主线程 Looper 与 Handler。

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. Handler 是什么？它解决什么问题？（回看第 1 节）
2. Handler、Looper、MessageQueue、Message 各负责什么？（回看第 2 节）
3. postDelayed 保证到点执行吗？用的是什么时间？（回看第 7 节）
4. 主线程栈看到 nativePollOnce 能判定 ANR 根因吗？（回看第 11 节）
5. 怎样用实验把回答验证出来？（回看第 12 节）

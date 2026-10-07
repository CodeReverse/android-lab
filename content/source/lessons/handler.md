## 阅读方式与讨论边界

沿“定义 → 结构 → 运行过程 → 实现机制 → 故障与取舍 → 验证证据”逐层追问。下面是原创面试问答链；只有文末明确映射的主题才来自面经，不声称面试官实际按本篇问过全部问题。每个主问题后直接给出回答，可跳读，也可用于自测。

## 第 1 问：Handler 是什么？它解决什么问题？

Handler 是向指定 Looper 的消息队列提交与处理工作的接口，不是线程，也不自动创建线程。常用于把其他线程的结果交给目标线程串行处理，或在目标线程安排后续任务。执行位置由它绑定的 Looper 决定，不由调用 post 的线程决定。

因此“new Handler 就开后台线程”和“异步 Handler 在子线程执行”都是错误说法。先画发送线程、目标队列与消费线程三者，后续机制才不容易混淆。

## 第 2 问：Handler、Looper、MessageQueue、Message 各负责什么？

Message 承载目标、数据、回调与调度时间等信息；MessageQueue 管理待分派工作；Looper 驱动目标线程的取消息与分派循环；Handler 提供投递入口与处理逻辑。一个线程通常只能 prepare 一个 Looper，它可以服务多个 Handler，共用该线程的队列。

多个 Handler 不代表并行执行。只要绑定同一个 Looper，一个回调尚未返回，后续消息通常就无法在同一循环中分派。

## 第 3 问：Looper 怎样和线程绑定？为什么子线程直接创建 Handler 可能失败？

Looper.prepare 通过线程本地存储建立当前线程的 Looper，并防止重复 prepare。主线程 Looper 由框架启动流程准备；普通线程没有自动拥有。显式传入已存在的 Looper 最清楚，避免依赖隐式当前线程选择。

只有 prepare 而没有进入 loop，消息仍不会自动消费。HandlerThread 可以封装带 Looper 的线程生命周期，但也要考虑结束、取消和退出后投递失败。ThreadLocal 在此保存线程所属关系，不承担跨线程队列同步。

## 第 4 问：sendMessage 和 post 怎样走到真正执行？

以 AOSP android-14.0.0_r1 为阅读基线，沿 sendMessageAtTime → enqueueMessage → MessageQueue.next → Looper 分派 → Handler.dispatchMessage 看链路。post 的 Runnable 被放入消息 callback。dispatchMessage 优先处理消息上的 Runnable；否则尝试 Handler.Callback，未消费时再到 handleMessage。

所以只重写 handleMessage 不会接住所有 post 的 Runnable。Message 还有复用池与 in-use 约束，消息入队后不要把同一实例当普通可随意改写的数据对象再次发送。队列实现细节不视为永久公开契约。

## 第 5 问：消息可以由不同线程提交，队列怎么避免竞争？

生产者与消费者共享队列，相关队列操作需要同步。在上述版本中，可沿 enqueueMessage 与 next 中的临界区理解链表状态保护和唤醒决定。线程本地的 Looper 绑定并不意味着队列里的数据无需跨线程同步。

传入消息的业务对象仍需自己的所有权协议。入队后发送者继续修改同一可变对象，消费者读到什么不能靠“用了 Handler”随意假定；更清楚的做法是提交不可变快照或明确移交对象所有权。

## 第 6 问：Looper 为什么死循环却不一直占 CPU？怎样被唤醒？

next 在没有到期可执行消息时通过 native 等待机制阻塞，等待超时或事件唤醒，而不是始终忙轮询。到期时间决定等待预算；生产者插入会改变下一次应执行工作的消息时，按队列状态决定是否需要 nativeWake。不是每次 post 都必然发出一次无条件唤醒。

要继续追底层，可沿 nativePollOnce/nativeWake 到相应 Android 分支的 native Looper 和系统事件等待实现。这里的阻塞是正常空闲；长回调运行、持锁或同步 Binder 等待才可能拖延交互。

继续追问到 native 层：在同标签的 libutils/Looper.cpp 中，唤醒用 eventfd，读事件加入 epoll；等待路径调用 epoll_wait，并传入超时。wake 向 eventfd 写入计数，使其变为可读从而唤醒等待，消费方读取计数后继续检查任务与事件。因此等待时不需要用户态空转，唤醒也不等于消息已经执行。要结合队列锁与重新检查条件理解“检查后入睡”之间的竞态，不能把 Java 层 sleep 当成等价替代。

## 第 7 问：postDelayed 保证到点执行吗？用的是什么时间？

它表示最早可执行时间，Handler 的延时时基与 uptimeMillis 相关；设备深度休眠会影响相对墙上时间观察到的等待。任务还可能被前面的长任务、调度和队列状态延后，不是实时计时器。

假设 A 计划 100 ms 执行，但当前回调到 180 ms 才结束，A 不会抢占它。需要跨休眠或系统级调度时，应按业务语义选择对应系统能力，不能仅增加主线程 delay。

## 第 8 问：同步屏障和异步消息到底是什么？

在上述版本的队列中，屏障会使它后面的同步消息暂缓，允许符合条件的异步消息被选择；它不能中断已经运行的回调。异步指屏障语义，不改变所属线程。框架用此机制协调某些调度，应用不应依赖隐藏接口随意插入屏障。

没有屏障时，异步消息并不是普遍最高优先级；到期时间和队列位置仍重要。屏障未正确移除会导致普通消息饥饿，不能把所有业务消息改成异步来掩盖根因。

## 第 9 问：IdleHandler 适合做重任务吗？quit 和 quitSafely 呢？

IdleHandler 在队列符合空闲条件时回调，空闲只描述当前可执行工作，不保证接下来没有输入。执行很重的任务仍会挡住后续交互。它不是免费的后台线程。

quit 让循环退出并丢弃相应待处理工作；quitSafely 在契约范围内处理已到期工作后退出，未来延迟消息不会全部等完。队列退出后提交可能失败；提交返回成功也不是业务一定执行完成的回执。

## 第 10 问：Handler 为什么可能泄漏 Activity？静态内部类就安全了吗？

典型路径是存活线程 → Looper → 队列 → Message → Runnable 或 Handler → Activity。Runnable 捕获页面，即使 Handler 是静态内部类也仍可保留页面。泄漏来自不合理的引用与生命周期，不来自 Handler 类名。

页面级任务在生命周期结束时撤销，跨页面任务交给更长生命周期的所有者，并让当前页面观察结果。共享 Handler 上 removeCallbacksAndMessages(null) 可能误删其他工作，优先使用清晰的回调或 token 归属。弱引用也不能替代业务取消。

## 第 11 问：主线程栈看到 nativePollOnce 能判定 ANR 根因吗？

不能。采样可能发生在阻塞已经结束以后，也可能当前线程正在正常等消息。ANR 是系统对特定交互的超时判断，需对齐事发时间窗、线程调度、锁等待和 Binder 链路。

记录入队、计划执行、分派起止与任务标签。等待长但执行短，查队列积压与前置阻塞；执行本身长，查该回调内计算、IO 或锁。参考 [ANR 等待链](#/article/anr-diagnosis)，不要把单一栈帧当根因。

## 第 12 问：怎样用实验把回答验证出来？

在专用调试场景给同一 Looper 投递一个可控耗时任务与两条有时间戳的短任务，比较计划时间和实际分派，验证串行和延后。再让页面 post 延迟回调并退出，比较取消前后的可达路径；观察目标实例是否仍保留。

实验中不要把阻塞注入真实主流程，不调用隐藏屏障 API 模拟线上行为。保留源码版本、事件时间线和引用链，明确正常等待、排队与实际执行时间。本文没有执行设备实验。

## 原理依据与适用边界

本文是结合机制与工程约束的原创讲解。官方资料用于核对机制，工程方案是可讨论的设计建议；文中的推演与实验步骤不是已运行的测试结果。实现细节应以项目锁定的依赖版本为准。

- [Handler API 与调度时基](https://developer.android.com/reference/android/os/Handler)
- [AOSP android-14.0.0_r1 Handler](https://android.googlesource.com/platform/frameworks/base/+/android-14.0.0_r1/core/java/android/os/Handler.java)
- [AOSP android-14.0.0_r1 MessageQueue](https://android.googlesource.com/platform/frameworks/base/+/android-14.0.0_r1/core/java/android/os/MessageQueue.java)
- [AOSP android-14.0.0_r1 Looper](https://android.googlesource.com/platform/frameworks/base/+/android-14.0.0_r1/core/java/android/os/Looper.java)
- [LeakCanary 工作机制](https://square.github.io/leakcanary/fundamentals-how-leakcanary-works/)

- [AOSP android-14.0.0_r1 native Looper：eventfd / epoll](https://android.googlesource.com/platform/system/core/+/android-14.0.0_r1/libutils/Looper.cpp)

## 面经如何映射到本篇

下列原帖只证明曾考察相应主题，不证明本文答案，也不代表该公司所有团队或资深岗位的统一要求。样本不足以计算行业频率。

- [美团 Android 一面 · 2025-02-17](https://www.nowcoder.com/feed/main/detail/592247f523b64d45bb0dd5f28bdfaf56)：涉及 Handler 导致的内存泄漏。
- [小米安卓一二面 · 2025-10-27](https://www.nowcoder.com/feed/main/detail/2f0777d95e974ce686abc063a75f5349)：涉及主线程 Looper 与 Handler。

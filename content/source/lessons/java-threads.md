## 1. 从批量缩略图任务定义并发需求

列表进入后需要生成一百张缩略图。每项 new Thread 很直观，却会同时消耗线程栈、调度时间和解码内存。只建一条线程又可能让用户等待太久。我们真正需要的是限制同时进行的工作，并给任务安排等待、取消与失败出口。

并发表示多个任务在一段时间内推进，并行表示同一时刻实际同时执行。线程是运行时与操作系统调度相关的执行资源，任务是业务工作；二者不应一对一绑定。本文以 Java 21 平台线程与 ThreadPoolExecutor 契约说明，Android 支持范围另按 API/工具链核对，不默认具有桌面虚拟线程能力。

## 2. start 与 run 建立不同的执行关系

`thread.run()` 只是当前线程的普通方法调用；`thread.start()` 请求启动新线程执行其任务。两者都可能调用同一段代码，但调用者是否继续、任务在哪条线程执行不同。

```java
Thread worker = new Thread(() -> decodeOne(), "thumbnail-worker");
worker.start();
worker.join(); // 当前调用者等待 worker 结束
```

decodeOne 是教学占位函数。join 适合确实允许阻塞的调用者，不应拿它在 Android 主线程等待图片，否则只是把工作换了线程、等待仍留在主线程。start/join 还提供规定的内存可见性关系，详细推导见 [JMM](#/article/jmm-concurrency?section=2)。

## 3. 从线程状态判断下一步证据

线程池卡住时，单看名字无法判断忙在哪里。Java 的 NEW、RUNNABLE、BLOCKED、WAITING、TIMED_WAITING、TERMINATED 是语言/API 层状态，不与内核状态逐项等价。

```text
RUNNABLE：可能在运行，也可能处于相关可运行/平台等待情形，需要 CPU 与栈证据
BLOCKED：等待进入监视器，不等于所有锁等待都叫 BLOCKED
WAITING：例如无期限 wait/join/park 等条件下等待
TIMED_WAITING：具有超时的相应等待
```

AQS 锁等待常通过 park 表现为等待状态，不能因为没看到 BLOCKED 就排除锁。看一份栈只能看到采样时刻，还要追谁持有资源、是否有进展。状态契约见 [Thread.State](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Thread.State.html)。

## 4. 用六个任务手算线程池入队规则

配置核心线程 2、最大线程 4、队列容量 2，假定任务都很慢，在提交期间没有完成：

```java
ExecutorService pool = new ThreadPoolExecutor(
    2, 4, 30, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(2),
    new ThreadPoolExecutor.AbortPolicy()
);
```

```text
任务 1、2：创建核心工作线程执行
任务 3、4：核心规模已到，进入队列
任务 5、6：队列满，继续创建线程直到最大 4
任务 7：线程与队列都满，执行拒绝策略
```

为什么不是先开满 4 条再入队？这就是 ThreadPoolExecutor 的配置协议，使用无界队列时通常很难靠满队列触发扩到 maximum。若只调 maximum 而不理解队列，可能完全不改变吞吐。公开规则见 [ThreadPoolExecutor](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)。

## 5. 队列把突发吸收成等待和内存

队列不会消灭工作，只把它推迟。如果平均到达速度长期高于处理速度，积压会增长；每个任务还可能捕获 Bitmap、Activity 或大数组。限制线程而队列无界，不等于资源有界。

对稳定系统可以用 Little 定律理解平均关系：在途数约等于吞吐率乘平均停留时间。人为算例：每秒处理 20 项、平均停留 0.5 秒，在途均值约 10；这不是任意过载场景的容量保证。

图片任务可以按可见优先、同资源去重和离屏取消减少无效工作。CPU 密集任务开过多线程会竞争核心，I/O 等待任务可能允许更多并发，但还受 socket、数据库和内存限制。尺寸应来自目标设备实验，不是一个永恒的 CPU核数乘二公式。

## 6. 拒绝策略是业务行为的一部分

Abort 抛出拒绝异常，调用方可以明确失败或降级；CallerRuns 把工作交给提交者，能形成反压，却可能在 UI 线程直接执行解码，造成卡顿；静默丢弃可能适合可丢预取，却不适合必达保存。

所以提交 API 应返回能表达接收、拒绝和最终结果的契约。不能一边用 discard，一边向用户提示“已成功加入下载”。把请求优先级、队列容量、拒绝与取消一起设计，比单独比较线程池名字更有效。

## 7. 中断请求与任务真正停止不是一回事

`Future.cancel(true)` 可以请求中断运行线程，但不是强制杀死任意 Java/native 代码。任务应响应可中断等待，并在 CPU 循环中检查取消条件。

```java
try {
    while (!Thread.currentThread().isInterrupted()) {
        Work item = queue.take();
        process(item);
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
} finally {
    releaseOwnedResources();
}
```

这是工作循环骨架；process 也需有合理取消边界。捕获 InterruptedException 后什么也不做并继续循环，会吞掉停止请求。外部副作用可能已经发生，中断不提供事务回滚；请求幂等要在业务层处理。

## 8. 池内等待会制造没有锁的死锁

只有一条工作线程，父任务提交子任务后 `get()` 等它完成。子任务在同一池排队，唯一线程却被父任务占着，双方都没有前进机会。

```text
worker：父任务 → 提交 child → 等 child
queue：child → 等 worker
```

增加线程数可能暂时掩盖，但多层依赖仍可耗尽。更稳妥的是把依赖表达为非阻塞组合，或明确不同资源池与执行预算。不要把“没有 synchronized”当成不会死锁。

ThreadLocal 也要按任务边界清理：池复用的是线程，任务 A 留下账号上下文可能被 B 继承；用 try/finally remove，并避免用线程身份隐含业务身份。

## 9. 用资源与完成语义验收

为缩略图场景提交超量任务、慢任务、抛异常任务、取消任务和页面退出。记录 active、queue、拒绝数、等待时间、执行时间与内存峰值；断言已取消结果不会写回旧页面，重要任务不会静默丢失。

关闭时区分 shutdown 的有序结束与 shutdownNow 的中断请求；后者也不是等待所有代码立刻消失。明确池由谁创建和关闭，避免每页新池不回收。本文代码和数值为学习设计，未运行线程压力实验。协程把等待从占线程变成挂起，但仍需同样资源预算，继续读 [协程](#/article/coroutines)。

## 面试提炼

1. 任务、线程、并发与并行为什么不能画等号？（回看第 1、2 节）
2. 如何手算 core、queue、maximum 与拒绝的先后？（回看第 4 节）
3. 无界队列和 CallerRuns 分别会把成本转移到哪里？（回看第 5、6 节）
4. 中断为何不等于强杀，池内等待为何不需要锁也能死锁？（回看第 7、8 节）
5. 怎样验证线程池限制了资源，同时保留正确完成与取消语义？（回看第 9 节）

## 1. 从一个退出页面后仍在工作的任务出发

设想一个教学故障：相册页每进入一次就安排延迟刷新，退出后旧页面仍在内存中；反复进出后开始卡顿。这不是某家公司真实事故，我们用它把运行时知识连成可推导的路线。

先写最小结构：

```kotlin
class GalleryActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private val refresh = Runnable { renderGallery() }
    fun schedule() { handler.postDelayed(refresh, 60_000) }
    private fun renderGallery() { /* 教学占位 */ }
}
```

一分钟是为了暴露保留窗口而选择的演示值。Activity 离开屏幕后，并不意味着 JVM/ART 可以忽略所有指向它的引用。第一步不是强制 GC，而是问 refresh 被谁持有、是否仍有业务必要。

## 2. 先画引用图，再决定补哪一层知识

```text
存活的主线程
  → Looper / MessageQueue
  → 尚未分派的 Message
  → Runnable
  → GalleryActivity
```

回调要调用实例方法，因此需要取得页面实例；消息在队列中尚未处理时，这条保留关系可能持续存在。GC 根据可达性判断，而不是根据“用户已经离开”判断。若只有两个已不可达对象互相引用，它们仍可被追踪式 GC 回收；本例不同之处是存在来自存活根的路径。

先读 [GC 第 1–2 节](#/article/gc-runtime?section=1) 学会区分业务生命周期与对象可达性，再读 [Handler 的消息流转](#/article/handler?section=1) 确认具体是谁保存了回调。若不清楚方法执行和对象引用怎样分布，则回到 [JVM 的一次方法执行](#/article/jvm-runtime?section=1)。Android 的实际运行时还须转到 [ART](#/article/memory-art)，不能把 HotSpot 的参数直接用于应用。

## 3. 修掉引用以后，为什么还可能卡顿

对页面所有的延迟回调在相应生命周期结束时撤销，能切断这一条引用链。但如果 refresh 已开始执行并等待后台锁，取消队列中的消息不会让已运行代码立即停止。

```text
主线程 → 等锁 L
后台线程持有 L → 等网络响应
网络响应 → 等服务端完成
```

这是一张等待图。它解释“不继续执行”，前面的引用图解释“仍可达”。两者不可互相代替。此时应缩小持锁区，把网络等待移出锁；如果只换弱引用，主线程依然会等待。如果只增加线程池，锁竞争还可能更严重。

按这个依赖读 [线程的排队与阻塞](#/article/java-threads)、[锁保护的不变量](#/article/java-locks?section=1) 和 [ANR 等待链](#/article/anr-diagnosis)。学完后应能画出锁所有者与下游依赖，而不是只说“主线程做了耗时操作”。

## 4. 删回调之外，还要保护结果归属

假设改为协程，页面销毁会取消任务，但底层第三方回调不支持取消，结果仍可能到达。一个 boolean 标记也不自动具备跨线程发布保证；需要明确执行上下文、同步方式与结果所属的账号/请求代次。

教学协议可以写成：

```text
开始请求时保存 generation = 7
离开页面时推进当前 generation，并取消底层工作
回调抵达时切到状态所有者的串行上下文
只有 savedGeneration == currentGeneration 才更新界面
```

代次比较与发布都放在同一个串行上下文，避免“检查通过后又切换账号”的窗口。若结果要写数据库，校验也应覆盖那个写入边界，不能只在 UI 层做。这里用代次防止陈旧结果，用取消减少资源浪费；两者缺一不可。可继续读 [JMM 发布规则](#/article/jmm-concurrency?section=2) 和 [协程取消协议](#/article/coroutines?section=5)。

## 5. 用一条验证记录串起学习结果

为这个故障保留四类证据：复现步骤、退出后的根路径、主线程等待时的持锁线程、修复后的相同场景对照。不要只记录“内存下降了”；要比较多轮进出后旧页面数量、回调数量、稳态存活基线，以及高峰内存。

如果旧页面已释放但峰值仍高，转到 [OOM 资源分类](#/article/oom-diagnosis?section=1)，检查图片解码和并发峰值。这样每个后续章节都有进入原因，而不是把所有文章按顺序打勾。进度记录与练习可在设置关闭，按当前证据跳读即可。

这条路线基于 [JVM 运行时规范](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html)、[Java 内存模型](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) 与 [Android 内存概览](https://developer.android.com/topic/performance/memory-overview) 的边界组织；代码与事故为教学构造，未声称执行设备测试。面经逐题解答仍单独保留，不把这些推导冒充面试原话。

## 面试提炼

1. 为什么退出页面不等于对象不可达？（第 1、2 节）
2. 引用图和等待图分别能证明什么？（第 2、3 节）
3. 取消任务以后为什么仍需检查结果代次？（第 4 节）
4. 哪些证据能区分泄漏修复与峰值内存优化？（第 5 节）

## 1. 同一份 Kotlin 代码在手机上由谁运行

桌面 Java 程序通常从 class 字节码进入某个 JVM 实现；Android 构建链还会把适当的字节码转换为 DEX，由 ART 执行。Kotlin 语言、JVM 规范、HotSpot 与 ART 属于不同层，不能把 `-Xmx`、Metaspace 或某个 HotSpot 收集器配置直接套到 Android 应用。

```text
Java / Kotlin 源码
 → 编译与构建优化
 → DEX（以及应用的 native 库、资源）
 → ART / native 执行与 Android 系统协作
```

D8 负责 DEX 转换等工作，R8 可参与收缩与优化；具体流水线依 AGP 配置。这里先建立责任边界，构建细节见 [构建与发布](#/article/build-release)。ART 的定义与 DEX 契约见 [AOSP Runtime](https://source.android.com/docs/core/runtime)。

## 2. 为什么解释、JIT、AOT 可以共同存在

如果所有代码只解释执行，冷启动准备可能较少，但热点执行成本较高；如果安装时把所有代码都充分编译，会增加安装、存储和编译成本，其中很多代码可能从未用过。混合执行让系统把编译资源更多放到有价值的路径。

ART 的 JIT 可以根据运行信息编译热点，profile 可为后续编译提供依据；AOT 与解释路径并非被 JIT 全部替代。策略、文件格式和触发时机随 Android/ART 版本变化，不能用“Android 某版本之后永远全 AOT”概括。参见 [ART JIT](https://source.android.com/docs/core/runtime/jit-compiler)。

教学对照应分首次启动、预热后启动和具有 profile 的安装状态。把后一次更快直接归因于业务改动，会混入代码编译和文件页缓存差异。

## 3. 进程内存不是只有 Java 堆

现在打开一张图片，再启动 native 推理。即使 Kotlin 对象数量没怎么增加，进程占用也可能上涨：

|部分|可能承载的内容|观察重点|
|---|---|---|
|托管堆|对象、数组、框架包装对象|存活对象与分配趋势|
|native 分配|解码缓冲、模型工作区|申请/释放与调用栈|
|线程相关|线程栈和线程运行资源|数量、栈映射与等待|
|映射与代码|DEX、共享库、模型 mmap|映射大小和驻留页|
|图形相关|纹理、缓冲等|版本/驱动与工具归属|

同一资源可能有 Java 包装对象，却把主要字节放在其他区域。单看 Java heap 图，不能证明整个进程没有增长。系统划分与计量依据见 [进程内存分配](https://developer.android.com/topic/performance/memory-management)。

## 4. RSS、PSS 和映射大小回答不同问题

假设一个 12 MiB 的共享驻留区域由三个进程等比例分摊，仅为说明计量：每个进程 RSS 都可计入这 12 MiB，而 PSS 对这一共享部分各计约 4 MiB。真实分摊按页面实际共享情况计算，不是按应用名字平均分。

虚拟地址映射大小则不等于已经驻留的物理页。mmap 一个大模型后，访问页面的过程可能逐步增加驻留；不能因为映射成功就说模型没有内存成本，也不能把整个地址范围直接当 PSS。

因此比较版本内存时要固定指标和采样时点。把一个版本的 Java heap 与另一个版本的 PSS 放在同一折线里，是计量口径变化，不是优化证据。

## 5. GC 看的是引用关系，不知道业务何时结束

页面销毁后，如果全局监听器或消息回调仍引用它，托管 GC 会继续认为对象可达。循环引用本身不是追踪式 GC 的死穴，有根路径才是保留的关键。通用标记与屏障原理见 [GC](#/article/gc-runtime)。

ART 的具体收集器、空间组织与屏障实现需按系统标签阅读；本文不把 HotSpot G1 的 region 参数移植过来。对应用开发，先证明所有权结束后引用能断开，再追问运行时怎样完成回收。强制 GC 不能让仍被合法强引用的页面消失。

## 6. JNI 引用也能把托管对象留下

native 代码拿到 jobject，并不意味着拿到可永久保存的裸对象指针。局部引用和全局引用有各自生命周期；长期保存对象通常需要合适的全局引用并在结束时删除。遗漏 DeleteGlobalRef 可以让 Java 对象一直可达，最终在托管堆中表现为泄漏。

```text
native session 创建 → 建立 GlobalRef(callback)
session 关闭        → 停止回调 → DeleteGlobalRef
```

这是所有权示意，不是可直接复制的 JNI 实现。线程附着、局部引用清理、异常和关闭竞争都需要遵守 [JNI tips](https://developer.android.com/ndk/guides/jni-tips)。仅在 Java 一侧把 callback 变量设 null，无法移除 native 持有的全局引用。

## 7. Bitmap 必须带版本与配置讨论

压缩图片文件只有 2 MiB，不代表解码后只占 2 MiB。以 4000×3000、每像素 4 字节的理想像素数据计算，需要 48,000,000 字节，约 45.8 MiB；实际还受行跨度、配置、额外缓冲等影响。

像素存储位置随 Android 版本变化，硬件位图也有不同边界；不要背成“Bitmap 永远在 Java 堆”或“永远在 native 堆”。[Bitmap 内存文档](https://developer.android.com/topic/performance/graphics/manage-memory) 列出历史差异。工程上先按目标尺寸解码、限制并发与缓存字节，而不是依赖某个堆分类侥幸避开限制。

## 8. 分配失败与系统杀进程不是一个机制

应用内某类分配失败可能抛出 OutOfMemoryError，也可能在 native 路径产生其他失败。系统在整体内存压力下终止进程，则可能没有 Java OOM 栈，更不会承诺先执行应用清理回调。

所以“后台回来页面重载”不能直接诊断为堆泄漏。需要看退出原因、系统内存压力、进程重要性和应用资源趋势。系统侧说明见 [Low memory killers](https://developer.android.com/google/play/vitals/lmk)；状态恢复能力见 [生命周期与恢复](#/article/state-restoration)。

## 9. 把不同内存证据放到同一时间线

教学实验可以固定“进相册—解码—退出—等待空闲”的循环，同时记录托管存活量、native 分配、线程数与 PSS。若托管基线稳定而 native 持续涨，优先追 native 所有权；若退出后 Activity 数量递增，先查根路径；若只在并发解码时尖峰，则查峰值重叠。

记录 ABI、Android/ART 版本和工具限制，避免拿不同设备口径硬比较。这些是诊断分支，不是已发生的真实故障结论。下一步按 [OOM 第 1 节](#/article/oom-diagnosis?section=1) 把“哪类资源申请失败”与具体证据连接起来。

## 面试提炼

1. JVM、HotSpot、DEX 与 ART 怎样区分？（第 1、2 节）
2. 为什么 Java heap 稳定不能证明进程内存稳定？（第 3 节）
3. RSS、PSS 与虚拟映射大小分别量什么？（第 4 节）
4. JNI 与 Bitmap 为什么必须讨论所有权和版本？（第 5–7 节）
5. 怎样区分应用 OOM、峰值压力与系统终止进程？（第 8、9 节）

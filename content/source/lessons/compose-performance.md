## 1. 先把卡顿变成可反驳的陈述

搜索框每输入一个字，结果列表就顿一下。团队看到重组次数不少，于是准备给所有模型加 `@Stable`。这一步跳得太快：可能是排序，也可能是文本测量、锁等待或 GPU 合成。重组计数只告诉我们某段代码被重新执行，没告诉我们用户为什么等。

先把问题改写成具体路径：“固定五千条本地结果，在低端目标设备上连续输入 compose，文字反馈与结果更新出现可见停顿。”把两个时间区间分开：按键到输入框新字符可见，查询变化到对应结果可见。把耗时排序移到后台，可能改善前者，却仍让后者很慢；两者都需要报告。

同时固定构建类型、设备、刷新率、数据集、图片缓存和温度条件。60Hz 帧间隔约 16.7ms，120Hz 约 8.3ms，但帧预算还涉及调度和呈现时间，不能只用一个主线程函数是否超过 16ms 判断全部掉帧。

本篇围绕一个假设案例推导，不包含实际设备跑分。技术 Spike 的目标不是证明“Compose 应该很快”，而是回答：哪个环节主导了这条交互路径，改动后是否在同等条件下改善，而且没有把工作或错误转移到别处。

## 2. 沿一次输入定位重复排序

假设页面有这段代码，`articles` 为不可变文章列表，`query` 为搜索词，`descending` 控制排序：

```kotlin
@Composable
fun SearchResults(articles: List<ArticleUi>, query: String, descending: Boolean) {
    val matched = articles.filter { it.title.contains(query, ignoreCase = true) }
    val sorted = if (descending) matched.sortedByDescending { it.updatedAt }
                 else matched.sortedBy { it.updatedAt }
    ArticleList(sorted)
}
```

函数每次执行就过滤、排序。若另一个无关参数变化导致此范围重新执行，即使列表与查询不变，也再次付出计算和分配成本。五千项排序通常包含约 `n log₂n` 量级比较，但实际耗时还取决于比较器、字符串、分配与设备，不能只从复杂度宣布它一定是瓶颈。

先在目标构建采集系统 trace，在业务计算周围增加有意义的 trace section；将输入时间点、主线程计算、组合、测量、RenderThread 与目标帧对齐。若主线程主要处于 Running 且热点落在排序，可支持重复计算假设；若长时间等待锁，则需追持锁线程；若 CPU 已结束而呈现迟到，还需看渲染与调度。

```text
输入到达
  → query 更新
  → SearchResults 执行
  → filter / sort [自定义 trace 区间]
  → Lazy 项更新与测量
  → 绘制、RenderThread、呈现
```

Layout Inspector 的重组/跳过计数辅助定位范围，编译器报告解释参数与跳过资格，系统 trace 才能把它们放到时间轴上。调试构建和 Inspector 观测本身有开销，发现线索后应在接近发布的构建复核。工具入口见 [Compose 性能](https://developer.android.com/develop/ui/compose/performance)。

## 3. 从缓存正确输入到移动计算边界

若确认同一输入被反复计算，最小改动是按真实依赖记忆结果：

```kotlin
val sorted = remember(articles, query, descending) {
    val matched = articles.filter { it.title.contains(query, ignoreCase = true) }
    if (descending) matched.sortedByDescending { it.updatedAt }
    else matched.sortedBy { it.updatedAt }
}
```

这里省掉的是无关重组的重复计算，不是第一次查询的成本。三个 key 缺一不可：忘记 descending 会让切换排序无效；原地修改普通 List 后继续传同一对象，也可能复用旧结果。缓存需要完整输入和正确的变化表达，不能把 `remember` 当成自动依赖追踪器。

如果每个新查询本身也很昂贵，就要移动到状态处理层，并决定取消规则。以下是 ViewModel 中的教学管道：输入为可观察 query、sort 与不可变 articles Flow，`rankingDispatcher` 应可注入，CPU 工作使用 Default 类调度器；需要项目的 kotlinx.coroutines 依赖，`mapLatest` 按所用版本添加必要 opt-in。

```kotlin
val results = combine(query, sortDescending, articles) { q, desc, rows ->
    Triple(q, desc, rows)
}.mapLatest { (q, desc, rows) ->
    withContext(rankingDispatcher) {
        val matched = rows.filterIndexed { index, row ->
            if (index % 128 == 0) ensureActive()
            row.title.contains(q, ignoreCase = true)
        }
        val ordered = if (desc) matched.sortedByDescending { it.updatedAt }
                      else matched.sortedBy { it.updatedAt }
        ensureActive()
        SearchResult(query = q, rows = ordered)
    }
}
```

`mapLatest` 用于取消旧转换，但普通 CPU 排序本身不会因为协程取消立即停止。过滤循环定期检查，排序结束后再次检查，防止过期结果继续往下游走；若排序已经大到取消延迟不可接受，还需改算法、索引或数据规模，不能只加协程包装。下游如何 `stateIn`、何时订阅与何时停止生产，见 [State 的数据源接入](#/article/compose-state)。

是否再加防抖？输入框显示通常应立即更新，结果请求可以按产品容忍度防抖；不能为了少计算，让用户输入的文字也延迟数百毫秒。另一种方案是预建搜索索引，增加构建与内存成本，换取更低查询成本。选择取决于数据变更频率、查询频率和内存预算，不能一律后台排序。

其他优化也应有对应证据：高频偏移只影响位置时延迟到放置读取；输入频繁而结果只是“是否超过阈值”时评估 derivedStateOf；图片成本主导时调整尺寸和解码。每次只验证明确假设，相关机制分别见 [阶段失效](#/article/compose-phases) 和 [列表](#/article/compose-lazy)。

## 4. 防止把不更新误认成优化成功

假设给模型强行标了稳定：

```kotlin
// 反例：普通 var 的变化没有通知 Compose，不满足此声明的承诺。
@Stable
class ArticleUi(var title: String)
```

随后修改 `article.title`，对象仍是同一个，普通属性也没有触发状态失效。页面可能保持旧标题，重组计数看起来“更好了”。这不是性能收益，而是状态模型错误。

可选择真正不可变的数据并通过可观察持有者替换实例，或者在稳定持有者中使用可观察 State 属性。注解描述契约，不会替属性生成观察器。强跳过下，不稳定参数可能按引用身份比较，稳定参数按相等性比较；因此也不能拿旧版本“有不稳定参数就不能跳过”的经验直接解释新项目。

验证至少包括：同一实例内部变化、新实例内容相同、新实例内容不同、函数自己读取的 State 直接失效。前两项不是要求得到同样重组次数，而是确保每种数据模型下显示与契约一致。具体转换和比较条件见 [编译器与强跳过](#/article/compose-compiler?section=4) 第 4–6 节。

缓存和比较都有成本：结构相等可能遍历集合，深层 UI 模型复制可能增加分配，分得过细也会增加维护复杂度。优化评审要能说明省掉了什么、增加了什么，以及为什么当前瓶颈值得这个交换。

## 5. 把对照场景固定为基准

trace 支持根因假设以后，用 Macrobenchmark 把同一交互重复执行。基准模块与被测应用分离，被测版本应接近 Release：明确 debuggable、profileable、混淆和编译模式，不能用 debug 与 release 比较后把全部差异归因于一次代码改动。

下面是滚动场景的测试骨架。依赖 AndroidX Benchmark Macro 的 JUnit4 rule 和 UI Automator；`com.example.reader` 是需替换的包名，测试目标需有固定本地数据入口。这里用内容描述定位仅为演示，实际可使用已配置的稳定资源标识，避免为了测试污染读屏文案。

```kotlin
@get:Rule
val benchmark = MacrobenchmarkRule()

@Test
fun resultsScroll() = benchmark.measureRepeated(
    packageName = "com.example.reader",
    metrics = listOf(FrameTimingMetric()),
    compilationMode = CompilationMode.None(),
    iterations = 10,
    setupBlock = {
        pressHome()
        startActivityAndWait()
        check(device.wait(Until.hasObject(By.desc("固定结果列表")), 5_000))
    },
) {
    val list = device.findObject(By.desc("固定结果列表"))
    list.setGestureMargin(device.displayWidth / 5)
    list.fling(Direction.DOWN)
    device.waitForIdle()
}
```

骨架假设每次启动都进入相同列表并重置滚动位置；如果应用会恢复位置，必须在 setup 明确恢复相同起点，否则十轮测的不是同一段内容。输入延迟还需另建输入场景及对应指标，不能用滚动 FrameTimingMetric 单独证明搜索反馈改善。

`CompilationMode.None()` 是一个明确的无预编译对照条件，不是生产用户唯一状态。评估 Baseline Profile 时，可对照实际支持的 `CompilationMode.Partial(baselineProfileMode = BaselineProfileMode.Require)`，确认 Profile 存在并被使用；记录 warmup、安装和启动条件，避免把预热差异算作业务优化。API 与配置以 [Macrobenchmark 文档](https://developer.android.com/topic/performance/benchmarking/macrobenchmark-overview) 为准。

Baseline Profile 让 ART 对关键路径获得提前优化依据，减少解释/JIT 等成本；它不能把反复排序变成不排序，不能消除错误锁等待，也不能代替图形优化。生成路径应覆盖真实关键操作，再在可重复实验里确认收益，不能把官方案例的百分比套到自己的应用。机制见 [Baseline Profiles](https://developer.android.com/topic/performance/baselineprofiles/overview)。

## 6. 把实验结论变成持续治理与项目证据

报告应让没参与的人也能复核。对当前案例，可以先建立下面这份空表，实测后填写，不能把示例数字伪装成结果：

| 项目 | 原版本 | 修改版本 | 判定依据 |
| --- | --- | --- | --- |
| 输入反馈分布 | 待测 | 待测 | 同设备、同词序列、同数据 |
| 对应结果可见时间 | 待测 | 待测 | 查询版本一致，旧结果不覆盖 |
| 滚动帧分布 | 待测 | 待测 | 同段列表与缓存条件 |
| 内存与 CPU 工作量 | 待测 | 待测 | 排序次数、分配、后台成本 |
| 正确性 | 待验 | 待验 | 排序切换、取消、恢复、账号切换 |

保留原始 trace、提交 SHA、依赖版本、设备与异常样本。先规定异常处理规则，再观察结果；不要只挑最快一轮。若低端设备改善而高端无变化，这是有价值的边界；若平均值改善但尾部恶化，则要解释尾部对应哪种用户路径。

持续治理可以把固定场景放入回归流程，设定噪声容忍范围和需人工复核的退化门槛。线上按页面、设备档位和版本观察，提供回退开关。流式 AI 文本若改成批量刷新，也应同时报告首字延迟、帧分布和内容完整性，不能把等待增加藏在更好的帧指标后面。

面试时能讲清“现象如何量化、证据排除了什么、为什么选这个方案、牺牲了什么、后续怎样防回退”，比背一组优化 API 更有说服力。这里的教学案例可用于练习判断，实际项目成果必须来自本人真实参与和可核验数据。可继续阅读 [性能证据文章](#/article/performance-proof) 与 [测试边界](#/article/compose-testing)。

## 面试提炼

1. 重组次数为什么不能代替卡顿指标，输入反馈和结果可见时间为何要分开？（回看第 1、2 节）
2. remember 为什么不能省掉首次排序，缺失 key 和原地修改各会怎样失效？（回看第 3 节）
3. mapLatest 为什么不保证 CPU 排序立即停止，后台化有什么代价？（回看第 3 节）
4. 怎样识别稳定性或缓存带来的错误更新，Baseline Profile 又能解决什么？（回看第 4、5 节）
5. 一份可以复核的性能报告要保留哪些证据，如何防止收益归因错误？（回看第 6 节）

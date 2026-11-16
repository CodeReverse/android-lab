## 1. 从五千条结果推导按需准备

搜索结果只有十条时，`Column` 加 `verticalScroll` 很直接。后来服务端一次返回五千条，首屏却仍只显示八条；若仍把所有行都写进 Column，组合和测量会为远远看不到的内容付出成本。仅仅裁剪屏幕外的像素，不能省掉前面的准备工作。

Lazy 容器改变的是内容准备协议：先提供数据数量和“某项需要时怎样创建”的描述，布局再根据视口、滚动位置等信息请求需要的内容。

```kotlin
@Composable
fun ArticleResults(articles: List<ArticleUi>, onOpen: (String) -> Unit) {
    LazyColumn {
        items(
            items = articles,
            key = { it.id },
            contentType = { "article" },
        ) { article ->
            TextButton(onClick = { onOpen(article.id) }) {
                Text(article.title)
            }
        }
    }
}
```

这里假设 `ArticleUi` 是具有唯一 String id 和 title 的不可变数据模型，使用的是 `androidx.compose.foundation.lazy.items` 扩展。`items` 这层描述整个区间，行内容 lambda 由容器按需调用；不能因为看到外层有五千个数据，就推断五千行都已经创建。

用一个简化布局循环理解其必要性，下面不是源码：

```text
已知：有限视口、起始项及偏移、数据提供者
从锚点项开始请求内容 → 组合 / 复用 → 测量
把测量结果放进视口，继续下一项，直到覆盖所需区域
处理滚动边界，并维护后续可复用 / 预取的内容
```

真实实现还会准备视口外项目、预取和保留部分内容，因此不能保证“恰好八行被组合”。滚动动画和缓存策略也会改变准备范围。只显示十个固定设置项时，普通 Column 可能更简单；需要大量或分页数据时，Lazy 的收益才明显。它降低的是 UI 准备成本，不会自动减少已经下载到内存的五千条业务数据。

## 2. 用 key 表达身份，用 contentType 表达形态

列表能滚动后，插入广告，再给文章增加输入框，就会遇到新的问题：容器怎么知道“这是旧文章移动了”，以及“这个旧内容结构适合谁复用”？这两个问题不能用同一个标记回答。

```text
数据：        A 文章       B 文章       C 广告
key：        article:A    article:B    ad:C
contentType：article      article      advertisement
```

key 表达具体项目身份，A 和 B 必须不同；contentType 表达可兼容的内容形态，A 和 B 可以相同。把唯一 ID 同时当 contentType，会把本可复用的同类项拆散；把所有文章的 key 统一为 `article` 则直接丢掉唯一性。

如果列表有标题、正文和追加错误，可以这样组织。片段中的 `ArticleRow`、`RetryRow` 是已有展示组件：

```kotlin
LazyColumn {
    item(key = "header:results", contentType = "header") {
        Text("搜索结果")
    }
    items(articles, key = { "article:${it.id}" }, contentType = { "article" }) {
        ArticleRow(it)
    }
    if (appendFailed) {
        item(key = "footer:retry", contentType = "retry") {
            RetryRow(onRetry)
        }
    }
}
```

命名空间避免标题 ID 恰好与业务 ID 相同。key 应在同一列表内唯一且稳定，不要每次随机生成。它还需要符合相关保存机制支持的类型；这里用 String，便于 Android 的状态保存。contentType 是复用提示，不是保证永不重新组合，也不是像 RecyclerView ViewHolder 那样要求业务手动执行一套 bind/reset。

当文章形态差异很大，例如纯文本与视频项，可以按实际结构分型。分太细会减少复用机会，分太粗会让替换成本增大，最终要以正确性和测量结果决定。身份与结构匹配的底层问题在 [组合树与 SlotTable](#/article/compose-slots?section=4) 第 4、6 节继续说明。

## 3. 通过头插实验看见状态归属

给 B 行输入草稿“周末阅读”，再在头部插入 X。若使用默认位置身份，位置 1 原来代表 B，现在代表 A，局部记忆可能被新项目沿用。正确业务 key 让容器知道 B 是从位置 1 移到了位置 2，而不是把 B 的状态交给 A。

| 操作 | 位置 0 | 位置 1 | 位置 2 |
| --- | --- | --- | --- |
| 原数据 | A | B：周末阅读 | — |
| 头插后期望 | X | A | B：周末阅读 |
| 按位置误认风险 | X 沿用旧位置 0 | A 沿用旧位置 1 草稿 | B 新建 |

但“key 正确”不等于“草稿永久保留”。滚出视口后，局部组合可能被移出；删除该项、返回上一页、进程死亡又分别改变保存范围。需要明确地选择状态所有者。

若短期草稿只属于当前页面，可以按 ID 提升到页面状态，而不是赌某行还在缓存中：

```kotlin
val drafts = remember { mutableStateMapOf<String, String>() }
LazyColumn {
    items(articles, key = { it.id }) { article ->
        TextField(
            value = drafts[article.id].orEmpty(),
            onValueChange = { drafts[article.id] = it },
            label = { Text(article.title) },
        )
    }
}
```

这个 Map 由 Snapshot 可观察，某行被重新准备时仍按业务 ID 取草稿；它不是跨进程存储。页面退出后也想保留，就需要合适的 ViewModel、SavedStateHandle 或持久化仓储，取决于恢复期限和数据大小。Map 还要有删除策略，不能因为用户浏览了十万项就永久保存十万份临时 UI 状态。

替代方案是在有稳定 key 的项中使用 `rememberSaveable`，让列表与保存机制按支持的身份恢复行状态；适合少量可保存的 UI 数据。重要草稿应进持久层，不应把可恢复 Bundle 当数据库。为什么 remember 与 rememberSaveable 的寿命不同，见 [State 学习文章](#/article/compose-state)。

## 4. 恢复索引不等于回到同一条文章

草稿没有串行了，用户从详情返回列表却发现阅读位置错了。`rememberLazyListState()` 保存的是列表滚动相关状态，常见恢复依据为索引与偏移；如果数据顺序变了，原来的第 20 项不一定仍是同一篇文章。

```kotlin
val listState = rememberLazyListState()
LazyColumn(state = listState) {
    items(articles, key = { it.id }) { article -> ArticleRow(article) }
}
```

同一列表活动期间，稳定 key 可以帮助维护可见项在数据插入后的关联。但跨页面重建、重新分页、排序规则变化后，若产品要求“回到文章 A”，应明确保存业务锚点：`articleId + 项内偏移 + 查询条件/排序版本`。数据重新到齐后查找 A 的新索引，再发起滚动。不能在数据为空时先强行滚到 20，再认为恢复已经完成。

```text
保存：query=compose，sort=newest，anchor=A，offset=12px
恢复查询 → 加载到能够判断 A 是否存在
A 存在：定位新 index，应用偏移（必要时重新限制）
A 被删除：按产品规则定位相邻项或列表顶部
```

字体、窗口和内容高度改变后，旧像素偏移也未必对应相同阅读位置。这是产品语义，不是 LazyListState 能自动推断的事实。手动恢复还应避免在每次数据刷新时重复抢滚动控制；一旦用户主动滚动，应按策略结束恢复任务。

再看内容复用：监听、图片请求、视频资源必须随当前 ID 更新，不能把前一项的副作用留给新项。组合身份只帮助 Runtime 匹配结构，外部资源的释放依然需要 [Effect 生命周期](#/article/compose-effects)。

## 5. 分页依赖合理占位和有限视口

结果可能有几十万条时，Lazy 仍然无法替代数据分页。Paging 管理数据加载和失效，Lazy 管理 UI 准备，两层合作但不互相取代。

使用 `paging-compose` 时，下面是接入核心结构；`pagingFlow` 是外部提供的 `Flow<PagingData<ArticleUi>>`，`LoadingArticle` 与 `ArticleRow` 是页面已有组件，扩展 `itemKey` 来自 Paging Compose：

```kotlin
val paged = pagingFlow.collectAsLazyPagingItems()
LazyColumn {
    items(
        count = paged.itemCount,
        key = paged.itemKey { it.id },
        contentType = { "article" },
    ) { index ->
        val article = paged[index]
        if (article == null) LoadingArticle() else ArticleRow(article)
    }
}
```

访问 `paged[index]` 参与按需加载提示；空值可能表示占位，并不一定是业务数据损坏。`LoadingArticle` 应提供接近最终内容的合理尺寸。如果每个占位只有 0px 高，一个 600px 视口可能“装下”大量占位，驱动过多准备或加载；图片到达后所有项目又突然变高。给图片明确宽高比、为文本保留合理空间，是分页行为的一部分。

加载状态也要区分：`refresh` 首次失败且没有内容，适合页面级重试；已有内容时 `append` 失败，通常保留列表并在底部重试。不要每次追加都用整页 Loading 替换列表，否则滚动、输入与生命周期一起被扰动。请求重试应走 Paging 的 retry，数据源已失效时则评估 refresh，不能把两个语义混用。公共接入见 [Paging 与 Compose](https://developer.android.com/topic/libraries/architecture/paging/v3-paged-data#jetpack-compose)。

最后检查容器空间。把 LazyColumn 放进 `Column.verticalScroll()` 且不给有限高度，外层可能沿垂直方向给出无界约束，Lazy 就没有明确视口。嵌套滚动协议再正确也不能补上这个尺寸。通常把标题、筛选、结果做成同一个 LazyColumn 的不同项；确有两个独立滚动区域时，给子区域明确约束并验证手势。横向列表嵌在垂直列表里是另一种轴关系，不能把所有嵌套一概判为错误。

## 6. 从一次卡顿定位到可接受的证据

按需准备已经建立，滚动仍可能卡顿：每次重组排序五千条、图片在主线程解码、文本测量复杂、透明图层合成过重，都不会因为换成 LazyColumn 自动消失。

沿一次滚动观察完整因果链：输入到达 → 滚动状态变化 → 准备或复用项目 → 测量和放置 → 绘制与合成。若 trace 显示大块排序 CPU 时间，先改变计算边界；若新项出现时图片请求密集，检查尺寸与预取；若只有重排后草稿错误，先修身份，不应把它当性能问题用缓存掩盖。

设计同一组数据的对照：初次打开、长距离滚动、头插 X、交换 A/B、删除当前锚点、离开后恢复。记录帧分布、准备工作和内存，同时断言草稿所属 ID、滚动锚点以及错误重试入口。优化后只是组合次数更少、但行状态串了，应直接判为失败。

源码可以从项目对应版本的 `LazyList`、`LazyListMeasure`、item provider 和 key 映射入口阅读：[AndroidX Lazy 源码目录](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/foundation/foundation/src/commonMain/kotlin/androidx/compose/foundation/lazy/)。链接是移动开发分支，研究时要切换为与依赖匹配的提交，不能把其中预取策略当成所有版本的保证。性能实验的配置和报告方式见 [性能治理](#/article/compose-performance)；本文没有把这些验证设计冒充已运行的基准结果。

## 面试提炼

1. Lazy 为什么能减少首屏准备成本，为什么仍可能准备视口外项目？（回看第 1 节）
2. key 与 contentType 分别回答什么问题，设置错误各有什么后果？（回看第 2 节）
3. 稳定 key 为什么不能保证草稿永久存在，应怎样选择状态所有者？（回看第 3 节）
4. 恢复索引和恢复业务锚点有什么差别，占位尺寸又怎样影响分页？（回看第 4、5 节）
5. 如何区分业务计算、项目准备与图形成本，并同时验证正确性？（回看第 6 节）

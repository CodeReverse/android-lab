## 1. 从一个旧页面选出清晰的迁移边界

已有 Fragment 搜索页需要换成 Compose，但地图仍依赖供应商 View，返回栈也由现有 Fragment 导航管理。若同时重写地图、页面、导航和业务数据层，出现回归时很难归因。先把所有权画清：Fragment 拥有页面 View，ComposeView 嵌入新的 UI，地图作为 AndroidView 放在 Compose 内容中。

```text
Fragment / View 宿主
  └─ ComposeView：承载 Composition
       ├─ 搜索框与结果面板：Compose
       └─ AndroidView：承载供应商地图 View
```

两个名字描述的是相反方向：ComposeView 让 View 体系容纳 Compose；AndroidView 让 Compose 容纳 View。它们不是换一种写法创建同一种对象，生命周期桥接与状态同步责任也不同。

选择这条边界的理由是保留现有地图能力和导航契约，先验证页面展示与状态模型。代价是同时维护主题、输入、无障碍和生命周期的桥接。若只是简单自定义 View，直接改写为 Compose 可能比长期包装更低成本；若是地图、广告、复杂 SDK，则需要依据支持情况评估，不能把全量重写当作高级工程师的默认答案。

下面沿这一个页面依次处理宿主销毁、状态同步、复用与回滚。每一处都先问“哪个对象仍然活着，是否还属于同一份业务内容”，避免把页面暂时看不见与资源可以永久释放混为一谈。

## 2. 让 Composition 跟随 Fragment 的 View 寿命

Fragment 进入返回栈后，Fragment 对象可能仍在，但旧 View 已经销毁。如果组合和外部监听继续持有旧 View，就会出现资源泄漏或重复回调。释放边界应跟随 View 生命周期，而不是简单跟随 Fragment 对象。

下面展示典型接入。`R.id.search_compose` 应在资源中声明为稳定 ID，例如 ids.xml 中的 `<item name="search_compose" type="id" />`；`SearchRouteContent` 是已有页面入口。

```kotlin
class SearchFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View = ComposeView(requireContext()).apply {
        id = R.id.search_compose
        setViewCompositionStrategy(
            ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
        )
        setContent {
            MaterialTheme { SearchRouteContent() }
        }
    }
}
```

策略把组合释放关联到视图树提供的 LifecycleOwner；在正常 Fragment View 宿主中，对应正确的 View 生命周期边界。它不要求此刻直接读取尚未建立好的 viewLifecycleOwner。组合被释放后，其 Effect 才有相应的取消与清理机会，外部资源仍需在 Effect 中正确配对注册/解绑。

多个 ComposeView 参与保存恢复时，需要不同且稳定的 View ID，让保存状态能归回相同宿主。运行时每次随机产生一个新 ID 虽然避免当下重复，却不等于跨重建身份稳定。若 Fragment 持有 ViewBinding，也仍要在 onDestroyView 清理自己的引用，Composition 策略不会替所有外部字段解除引用。

为什么不能所有 detach 都立即 dispose？某些池化容器把暂时离屏与真正释放分开，框架的默认策略也考虑相关场景。应按宿主选择策略，不能把 Fragment 结论直接套到 RecyclerView 池。当前策略表与例子见 [Compose in Views](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/compose-in-views)。

## 3. 把 View 创建、配置更新与用户事件拆开

地图接入时，最常见的错误是在 `update` 中重新创建对象或不断添加监听。`factory` 用于创建本次 View 实例；`update` 把最新配置同步到它，可能被多次调用。一次创建不等于一个业务页面永远只创建一次，移除、重建和复用都会改变生命周期。

先用 TextView 缩小到能完全解释的代码。这里 `articleId`、`title` 和 `onOpen` 是组件输入：

```kotlin
@Composable
fun LegacyArticleLabel(articleId: String, title: String, onOpen: (String) -> Unit) {
    val latestOpen = rememberUpdatedState(onOpen)
    AndroidView(
        factory = { context -> TextView(context) },
        update = { view ->
            if (view.text.toString() != title) view.text = title
            view.setOnClickListener { latestOpen.value(articleId) }
        },
        onReset = null, // 本例不启用 View 复用
        onRelease = { view -> view.setOnClickListener(null) },
    )
}
```

`setOnClickListener` 替换单个监听，并非 add 型注册，因此放在 update 中不会累计多个监听；闭包使用本次 articleId，回调通过 latestOpen 读取最新函数。若是 `addTextChangedListener` 这种添加 API，同样写法就可能反复注册，必须建立明确的持有和解除协议。

输入框还多一层反馈：用户编辑 → TextWatcher 发事件 → Compose 状态变化 → update 调用 setText → TextWatcher 又发事件。只加 debounce 会延迟循环，不会修复协议。对程序写入需要区分来源，并避免等价重复写入。下面是协议伪代码，省略 Android 监听器三个方法：

```text
创建 View 时注册一个 watcher；保存 watcher 引用
watcher(newEditing):
  如果 applyingFromState 为 true：返回
  发出用户编辑事件，并附当前绑定身份

update(editing):
  如果 View 编辑状态已相同：返回
  applyingFromState = true
  try：同步文本、选区和必要编辑信息
  finally：applyingFromState = false

最终释放：removeTextChangedListener(watcher)
```

普通布尔保护适用于同步程序写入回调；如果 SDK 异步回调，还要使用绑定代次或来源标识。对复杂文本，仅比较 String 不能保留选区和输入法 composition，不能把伪代码直接当作完整编辑器。相关编辑边界见 [输入篇](#/article/compose-input?section=5) 第 5 节。公共创建/更新契约见 [Views in Compose](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/views-in-compose)。

## 4. 用绑定代次区分复用和最终释放

将地图或视频 View 放进 Lazy 列表后，View 对象还活着，业务项却可能从 A 变成 B。仅改标题会留下 A 的播放会话和回调，之后 A 的进度可能显示在 B 上。

支持复用的 AndroidView 重载通过非空 `onReset` 表明 View 可以重置后复用，`onRelease` 则处理最终退出。二者不是“滚出”和“滚入”的简单对应，onReset 后也不应假定一定马上执行 update；临时停用可能持续一段时间。具体契约以 [AndroidView API](https://developer.android.com/reference/kotlin/androidx/compose/ui/viewinterop/package-summary) 为准。

以供应商视频适配器为例，可以设计下面的协议。`VideoAdapter` 是我们要实现的适配层，不是 AndroidX 类型；伪代码中的 bindIfChanged、resetBinding、release 分别承担明确职责：

```text
factory：创建 VideoAdapter 和内部 View，初始化一次长期资源
update(item)：bindIfChanged(item.id, item.url, currentCallbacks)
onReset：resetBinding()
onRelease：release()

bindIfChanged：
  同一业务绑定 → 仅更新必要配置与回调
  新绑定 → 取消旧请求；generation++；保存新 ID
           发起请求，闭包捕获 expectedGeneration
回调：
  若 released 或 expectedGeneration != generation：丢弃
  否则才更新当前 View / 发出当前项事件
resetBinding：generation++；取消旧请求；清除旧画面和瞬态状态
release：resetBinding；幂等释放播放器/监听/长期资源；标记 released
```

为什么既取消又检查代次？取消未必阻止已经排队的 SDK 回调。代次校验保护的是提交边界；它要求绑定和回调校验在同一受控线程/串行上下文执行，若 SDK 任意线程回调，应先切到约定上下文再校验，不能以普通字段访问宣称线程安全。

不能把播放器永久 release 塞进每次 onReset，除非 update 明确能够重新创建全部必要资源，否则复用到 B 时只得到一个已经销毁的对象。反过来，只清空画面而不解除旧订阅，会把内存和业务事件泄漏到下一项。复用是否值得还需衡量初始化成本、重置复杂度和资源峰值；资源特别重且 SDK 语义不清时，禁用复用并控制创建数量也可能更可靠。

## 5. 把回滚做成业务契约的一部分

前面的接入稳定后，试点范围可以是整个搜索页面，也可以只是搜索栏。页面级迁移更容易比较完整路径，但一次变化更大；组件级能分阶段推进，却增加新旧体系长期共存成本。技术评审应记录备选方案与放弃原因，而不是仅宣布“采用 Compose”。

一个可回滚的边界是：新旧 UI 接收同一页面状态，发送同一业务事件，使用同一持久数据和深链接契约。功能开关只选择一个展示实现，不能同时启动两套状态生产者各自请求和提交。

```text
业务与数据层保持同一份事实
     ↓ UiState / Events
  开关选择一次
   ├─ 旧 View 页面
   └─ 新 Compose 页面
```

如果用户正在编辑，切换实现也要定义交接：先保存草稿，再替换宿主，还是只在下次进入时生效。随时切换一个布尔值不代表安全回滚；旧实现必须仍能解释新版本已保存的数据。导航参数、数据库格式和业务协议若同时改变，会把回滚难度提升到 UI 之外。

验收按故障价值排序：输入与焦点、收藏与错误处理、返回栈与恢复、监听清理与复用，最后比较同条件下的启动、滚动、内存和包体。出现业务错误时不能用平均帧时间更好作为放行依据。具体测试分层见 [Compose 测试](#/article/compose-testing)。

## 6. 用一次完整时序留下可复核的迁移证据

为试点安排一条能覆盖所有权变化的路径：进入搜索 → 输入 → 打开详情使旧 View 销毁 → 返回重建 → 滚动使视频 A 被复用为 B → 投递 A 的迟到回调 → 切账号 → 再退出。提前规定每一步应保留什么、取消什么、拒绝什么。

| 观察点 | 预期证据 | 能揭示的问题 |
| --- | --- | --- |
| Fragment View 销毁 | 组合解绑与 View 引用释放记录 | 宿主寿命不匹配 |
| 相同状态重复 update | 不新增监听、不重复启动播放器 | 更新不幂等 |
| A 复用于 B | 旧绑定取消，旧代次回调被拒绝 | 状态串项 |
| 最终退出 | 长期资源释放且不会再提交事件 | 只重置未释放 |
| 回滚到旧实现 | 草稿、路由与业务事实可解释 | 契约不兼容 |

这些是验收设计，不是本文已经采集的运行日志。真正上线时保留构建 SHA、设备、依赖版本、trace 和回归结果；发生回退也记录触发条件。编译器、Runtime、导航与设计系统升级尽量可独立归因，检查源码/二进制兼容和构建成本，不只验证一个样例能编译。

团队推广需要组件接口负责人、废弃策略和调用方迁移支持。衡量收益既包括性能，也包括开发与维护成本；不要凭一页代码减少就断言整个团队提效。把个人实际决策、试点证据和取舍整理到 [项目成果证据](#/article/project-evidence)，面试时才能说明为什么选择渐进迁移、什么时候停止推广，以及如何证明没有遗留两套相互冲突的状态系统。

## 面试提炼

1. ComposeView 与 AndroidView 的宿主方向和生命周期责任有什么区别？（回看第 1 节）
2. Fragment 对象仍在时为何需要释放其 View 内的组合，稳定 View ID 又解决什么？（回看第 2 节）
3. factory、update 与用户回调怎样分工，为什么 TextWatcher 容易形成反馈？（回看第 3 节）
4. onReset 与 onRelease 为什么分开，取消后为什么还要校验绑定代次？（回看第 4 节）
5. 什么样的 UI 迁移真正可回滚，应保留哪些验收与成果证据？（回看第 5、6 节）

## 1. 从可点击的收藏按钮开始建立交互契约

文章行支持横滑，行内有收藏操作。最初用 `pointerInput` 检测抬手，然后调用收藏接口，手指测试看起来正常；开启读屏后却找不到“收藏”动作，拖动时又偶尔误触。原来我们实现的只是一个坐标事件，没有实现完整的按钮。

先从高层交互开始。下面使用 Material 3 的 `IconToggleButton`，`favoriteIcon` 是项目已有的图标资源，`label` 是根据状态本地化后的“收藏文章”或“取消收藏文章”：

```kotlin
@Composable
fun FavoriteAction(
    saved: Boolean,
    label: String,
    favoriteIcon: Painter,
    onSavedChange: (Boolean) -> Unit,
) {
    IconToggleButton(checked = saved, onCheckedChange = onSavedChange) {
        Icon(painter = favoriteIcon, contentDescription = label)
    }
}
```

`checked` 描述当前事实，回调提出修改请求。组件提供切换状态、动作语义、交互反馈及相应输入行为；图标描述让用户知道动作含义。业务是否真正收藏成功仍由外部状态决定，不能只因为按钮被按下就假定服务端完成了操作。

为什么不直接使用 `detectTapGestures`？它解决手势识别，不会替我们补齐所有角色、键盘焦点、读屏动作和视觉反馈。只有高层 API 无法表达的需求，例如自由绘图、多指旋转或特殊拖拽协议，才需要下探。技术评审应先说清缺少哪项能力，再接受自己维护更低层输入逻辑的成本。

## 2. 同一次手势怎样在父子之间协作

高层按钮仍要与横滑行协调。手指按在收藏按钮上，再横向移动超过拖动阈值：行希望开始拖动，按钮需要撤销点击，不能等 UP 后各自提交一次行为。

指针初次按下时，系统通过命中测试确定相关接收节点。后续同一指针通常继续沿这条命中链分发，即使坐标已经离开最初区域；悬停等事件有不同规则。这里的命中区域来自布局与输入节点，不是“哪里画了颜色哪里就能点”。

一个事件可经历 Initial、Main、Final 三个 pass。简化到父行与子按钮：

```text
Initial：父 → 子     父有机会先观察或消费
Main：   子 → 父     子优先处理常见手势
Final：  父 → 子     观察前面 pass 的消费结果，调整/取消自身行为
```

消费是共享事件变化上的标记，不是把事件从传播链删除。低层处理者仍要检查 `isConsumed`，尊重别人已接管的变化。拖动识别通常还涉及 touch slop：小范围抖动不能立即当作拖动，否则按钮几乎点不准。不要在每次 DOWN 就全量消费，除非产品明确要求父级拦截。

发生误收藏时，记录 pointer ID、pass、位移、消费状态、识别器取消和最终业务动作。若按钮取消已发生却仍提交收藏，问题可能在自己写的“任何结束都调用 onClick”逻辑；若父根本没识别拖动，则检查阈值和事件处理。公共分发模型见 [理解手势](https://developer.android.com/develop/ui/compose/touch-input/pointer-input/understand-gestures)，它与 View 的 `onInterceptTouchEvent` 不应机械一一对应。

## 3. 不让拖动数据反过来取消拖动协程

明确手势以后，还可能出现“刚拖一点就停”。看看这段看似会更新最新位置的代码：

```kotlin
// 反例：offset 每次变化都可能重启输入处理。
Modifier.pointerInput(offset) {
    detectDragGestures { change, amount ->
        change.consume()
        offset += amount.x
    }
}
```

`pointerInput` 的 key 不是“让我观察这个数值”，而是“这些输入变化后，旧处理逻辑应失效并重启”。把每次拖动都会改变的 offset 当 key，就让手势取消了自己。

改用业务身份控制手势寿命，回调更新则另行处理。下面是拖动区的核心代码，使用 Foundation 的 `detectDragGestures` 和 Runtime 的 `rememberUpdatedState`：

```kotlin
@Composable
fun ArticleDragArea(
    articleId: String,
    onDragX: (Float) -> Unit,
    modifier: Modifier = Modifier,
) {
    val latestOnDrag = rememberUpdatedState(onDragX)
    Box(modifier.pointerInput(articleId) {
        detectDragGestures { change, amount ->
            change.consume()
            latestOnDrag.value(amount.x)
        }
    })
}
```

ID 不变时，已有手势继续；回调可以读取最新值而不要求重启。ID 改变或节点离开后，应终止旧手势。这个组件只是拖动区域，不自带收藏语义，也没实现边界、速度和吸附；后者在 [动画控制权](#/article/compose-graphics-animation?section=4) 第 4 节展开。

还有一个协程陷阱：在同一个 `pointerInput` 块中先调用长期运行的 `detectTapGestures`，下一行再调用 `detectDragGestures`，后者通常没有执行机会。应采用适合需求的组合方案，例如独立 Modifier 或自行组织一套手势状态机，而不是把几个挂起识别器当作依次注册的普通函数。

稳定 key 也不能代替业务隔离：账号切换后 articleId 恰好相同，若旧手势不应继续，可以把 accountId 也纳入身份；网络提交还需要请求身份与幂等约束。输入取消只管理输入生命周期。

## 4. 用有符号预算实现折叠标题与列表协作

横滑行稳定后，再加一个随列表上滑折叠的标题。这里双方不是争夺整个手势，而是分享一段滚动距离。约定屏幕 y 向下为正，标题 offset 范围为 `[-collapseRange, 0]`：0 完全展开，负值逐渐折叠。

假设标题还可向上移动 10px，用户本次位移为 −30px：父预消费 −10，剩余 −20 给列表；列表若只能消费 −15，还剩 −5 进入后消费阶段。消费量必须对应实际变化，否则会吞掉本应交给下一级的距离。

下面的 `NestedScrollConnection` 实现一种策略：上滑先折叠标题；下拉先让列表回到顶，再用其未消费的正向距离展开标题。代码仅展示距离协商，`rangePx` 是已换算的正数，`offset` 是 `MutableFloatState`，应在组合中按 range 创建并 `remember` 这个 connection。

```kotlin
val connection = object : NestedScrollConnection {
    fun moveHeader(delta: Float): Float {
        val old = offset.floatValue
        val next = (old + delta).coerceIn(-rangePx, 0f)
        offset.floatValue = next
        return next - old
    }

    override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
        val consumedY = if (available.y < 0f) moveHeader(available.y) else 0f
        return Offset(0f, consumedY)
    }

    override fun onPostScroll(
        consumed: Offset,
        available: Offset,
        source: NestedScrollSource,
    ): Offset {
        val consumedY = if (available.y > 0f) moveHeader(available.y) else 0f
        return Offset(0f, consumedY)
    }
}
```

把它通过 `Modifier.nestedScroll(connection)` 安装在参与协作的容器上，标题再按 offset 放置。列表本身已能参与相应的嵌套滚动链。`moveHeader` 返回实际 offset 差值，所以到达边界后自然只报告剩余可移动部分，而不会谎报整个 available。

这还不是完整的产品折叠栏：fling 需要协商速度，吸附要定义终止状态，窗口变小后需重新限制 offset，触摸与非触摸来源也可能有不同政策。优先评估 Material 现成的 TopAppBar 滚动行为；自定义的理由应是产品规则确实不同。

协议与 API 可继续查 [嵌套滚动指南](https://developer.android.com/develop/ui/compose/touch-input/scroll/nested-scroll-modifiers)。它解决距离和速度的分配，不解决布局无界问题；LazyColumn 的有限视口要求在 [列表与分页](#/article/compose-lazy?section=5) 第 5 节展开。

## 5. 把编辑过程与搜索请求分开

搜索框看似只是一个 String，实际还包含光标、选区和输入法正在组合的文本。用户输入拼音时，业务查询可以尚未完成，但 UI 必须及时保留编辑过程；让网络响应驱动输入框回填，会造成旧结果覆盖新输入。

先用广泛存在的 value/onValueChange 方案理解这个边界，下面依赖 `TextFieldValue` 及其 Saver，不混用状态式 TextField API：

```kotlin
@Composable
fun QueryEditor(onQueryText: (String) -> Unit) {
    var editing by rememberSaveable(stateSaver = TextFieldValue.Saver) {
        mutableStateOf(TextFieldValue(""))
    }
    TextField(
        value = editing,
        onValueChange = { next ->
            editing = next
            onQueryText(next.text)
        },
        singleLine = true,
        label = { Text("搜索文章") },
    )
}
```

首先接纳 `next`，保留此次编辑的选区与组合信息；然后把文本交给外部查询逻辑。`onQueryText` 应快速提交输入，不在回调里阻塞网络；防抖、取消和旧结果校验在外部完成，见 [副作用](#/article/compose-effects?section=2) 第 2、6 节。

错误写法是每次都 `editing = TextFieldValue(next.text)`。新对象默认的选区与 composition 不等于输入法给出的编辑状态，用户在句中修改时可能跳光标或丢失组合过程。即便使用 copy，若对文本做删字符、插分隔符等转换，也要正确映射选区，不能保留已经不对应新文本的位置。

现在的状态式文本 API 以 `TextFieldState` 持有编辑状态，并提供输入与输出转换的专用机制。它们是否在项目所用 Material 版本稳定可用，应按实际依赖核验；不要把两套状态源同时绑定同一输入框。无论选哪套，编辑态与服务端搜索结果都应各有所有者。详见 [文本输入文档](https://developer.android.com/develop/ui/compose/text/user-input) 与 [TextFieldValue API](https://developer.android.com/reference/kotlin/androidx/compose/ui/text/input/TextFieldValue)。

## 6. 让焦点与 Insets 跟随真实窗口

编辑模型正确后，用户点进搜索页，希望自动聚焦一次。`FocusRequester` 表示请求目标，不是把 `requestFocus()` 写在组合函数体就能安全完成；函数体可能重复执行，持续抢焦点。

```kotlin
val requester = remember { FocusRequester() }
LaunchedEffect(Unit) { requester.requestFocus() }
TextField(
    value = query,
    onValueChange = onQueryChange,
    modifier = Modifier.focusRequester(requester),
)
```

这个片段假设 TextField 随当前内容同时出现。若搜索框由加载状态稍后插入，应把请求放到它真正出现的生命周期中；重新进入该组合身份会再次请求，是否符合产品需求需要明确。焦点是输入路由，键盘是否展示还受系统和窗口状态影响，二者不能视为同一件事。

键盘出现后，可用空间改变。`imePadding()` 等 Insets Modifier 根据当前系统 Insets 调整布局，并参与相应的消费规则；不能在多个层级再手工叠加同一份“键盘高度”。Scaffold 提供的 innerPadding 也应按布局职责应用一次，并按需要声明已消费的内容 Insets。否则看起来像键盘 bug，实际是同一空间被扣了两遍。

画一张边界图通常比尝试不同 padding 更有效：窗口边界 → 系统栏 → Scaffold 内容区域 → 列表可视区 → 当前输入框。记录每层负责哪部分；外接键盘时 IME 高度可能为零，但焦点仍存在。分屏和折叠只改变约束，不该让代码继续使用启动时缓存的“全屏高度”。可结合 [Insets](https://developer.android.com/develop/ui/compose/system/insets) 和 [焦点行为](https://developer.android.com/develop/ui/compose/touch-input/focus/change-focus-behavior) 核对。

## 7. 用所有权变化设计交互 Spike

先测普通点击只能证明最容易的一条路径。真正能区分实现质量的输入包括：按下后滑出区域、拖动中删除文章、手势中切账号、拼音组合中旋转、列表到顶继续下拉、IME 打开时缩小窗口、用 Tab 和读屏触发收藏。

为每个操作提前写下预期所有者。例如拖动中删除文章后，该项的识别器应取消，不能提交旧项位移；下拉预算只有未被列表消费的部分才能展开标题；旋转后的编辑恢复不能被迟到查询响应覆盖。再采集消费量、取消日志、编辑状态和最终业务动作，而不是只录一段“看起来正常”的视频。

若问题是真机偶发丢事件，应同时查看主线程阻塞；事件处理延迟与消费逻辑错误不是一个修复方向。若手指操作正常而读屏不可达，应检查语义树，不是继续调整触摸坐标。测试层次与语义断言在 [测试教程](#/article/compose-testing) 展开。本文的数值和序列是可复现的验证设计，尚未作为设备实测结果报告。

## 面试提炼

1. 一个能识别抬手的区域，还缺少哪些按钮交互契约？（回看第 1 节）
2. 三个事件 pass 与消费标记如何协作，为什么消费不等于停止传播？（回看第 2 节）
3. pointerInput 为什么不该用每帧位移作为 key，更新回调怎样处理？（回看第 3 节）
4. 标题只剩 10px 可折叠时收到 −30px，父子应怎样分配？（回看第 4 节）
5. 如何区分编辑态、业务结果、焦点与键盘空间，避免相互覆盖？（回看第 5–7 节）

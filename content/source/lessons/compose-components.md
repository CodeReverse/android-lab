把搜索结果行复用到收藏页时，如果它自己创建 ViewModel、读取账号并导航，就得把整个搜索页面一起搬过去。本篇从这个复用困难出发，把状态、事件、Modifier、主题和环境依赖逐步放到合适位置。

前置：[最小声明式页面](#/article/compose-foundations)。示例用 Material 3 与 Foundation，省略通用 imports；业务 Article、仓储与资源文件按示例说明提供。代码是教学片段，未在 Android 工程执行。

## 1. 先拆输入与事件，再讨论拆成几个函数

最初可以把一行所需内容全部写在页面里。但它搬到收藏页后还应该能使用。先让行只接受显示所需的值与动作：

```kotlin
@Composable
fun ArticleRow(
    title: String,
    saved: Boolean,
    onOpen: () -> Unit,
    onToggleSaved: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier.clickable(onClick = onOpen)) {
        Text(title, modifier = Modifier.weight(1f))
        TextButton(onClick = onToggleSaved) {
            Text(if (saved) "取消收藏" else "收藏")
        }
    }
}
```

RowScope 中的 weight 表达标题使用分配给它的剩余空间；这里不是让 ArticleRow 自己决定全页布局。onOpen 和 onToggleSaved 把意图交给调用方，行组件不需要知道具体导航控制器或数据库。

为什么不在行内再 remember 一个 saved？上层收藏结果与本地副本可能互相矛盾：服务器拒绝后，上层改回 false，行里仍显示 true。只有一份权威状态，回滚就沿相同数据流到达所有消费者。

局部临时状态仍可以保留，比如提示气泡是否展开；它与服务端收藏结果的寿命、所有者不同。组件拆分的依据是职责、复用和状态边界，不是每十行代码必须提取一个函数。

Route 层可以取 ViewModel、收集状态和连接导航，Screen/Row 则接收输入。状态提升的完整取舍见 [State 第 5、7 节](#/article/compose-state?section=5)。

## 2. 用状态模型避免不可能的界面组合

搜索页还要显示加载、失败、空结果。三个独立 Boolean `loading/error/empty` 能组合出“同时首次加载、错误、空成功”，其中很多状态没有产品意义。

先用一个只处理首次请求的最小模型：

```kotlin
sealed interface SearchResult {
    data object Idle : SearchResult
    data object Loading : SearchResult
    data class Ready(val titles: List<String>) : SearchResult
    data class Failed(val message: String) : SearchResult
}

@Composable
fun ResultBody(result: SearchResult, onRetry: () -> Unit) {
    when (result) {
        SearchResult.Idle -> Text("输入关键词开始搜索")
        SearchResult.Loading -> CircularProgressIndicator()
        is SearchResult.Ready -> {
            if (result.titles.isEmpty()) Text("没有匹配结果")
            else Column { result.titles.forEach { Text(it) } }
        }
        is SearchResult.Failed -> Column {
            Text(result.message)
            Button(onClick = onRetry) { Text("重试") }
        }
    }
}
```

空结果由 Ready 的空列表推导，而不是另一份需要同步的标记。`when` 覆盖模型分支，也迫使新增状态时重新检查 UI。

这个模型还没表达“保留旧数据同时刷新”。新需求出现时，可在拥有数据的状态中加入明确刷新状态，而不是退回任意 Boolean 拼接。要处理刷新失败仍展示旧数据，也要明确错误提示属于刷新过程还是整页结果。

基础组件应匹配语义：显示文本用 Text，编辑用 TextField，标准操作优先 Button。Scaffold 是组织槽位的布局，不会让内容自动正确处理所有边距：

```kotlin
Scaffold { contentPadding ->
    ResultBodyContainer(Modifier.padding(contentPadding))
}
```

ResultBodyContainer 是本例内容占位组件。关键是消费宿主给出的 padding；若内部又自行重复处理同一 Insets，就会多出留白。大数据量不能沿用上面的演示 Column 全量组织，进入 [Lazy 教程](#/article/compose-lazy) 再扩展。

## 3. Modifier 顺序表达包裹关系

现在给行加边距和点击，为什么换一下顺序行为就变了？先把链看作逐层包裹，而不是一个无序 CSS 属性对象。

```kotlin
Modifier.clickable(onClick = onOpen).padding(16.dp)
Modifier.padding(16.dp).clickable(onClick = onOpen)
```

第一种 clickable 在外层包裹带 padding 的内容；第二种先留出外层空间，clickable 在内层。绘制背景作辅助，更容易观察边界：

```kotlin
Modifier.background(Color.LightGray).padding(16.dp)
Modifier.padding(16.dp).background(Color.LightGray)
```

在相同父约束下，前者背景覆盖内部留白，后者背景只作用在留白内侧的内容范围。点击还涉及最小触达目标等机制，不能只根据背景像素测出所有实际命中边界；应配合触摸测试。

组件对外提供 modifier 时，调用者通常期待它作用于组件整体。如果 ArticleRow 只把 modifier 贴在内部 Text 上，调用方的 padding、尺寸或测试标识就偏离契约。也不要把同一 modifier 在根和每个子节点重复使用。

weight 等父数据修饰符不是任何位置都有效。它传递的是供特定父布局解释的信息；在错误作用域或错误父子关系下，不能仅凭链里存在 weight 就推断分配成功。

进一步把约束逐层画出来见 [布局第 1、2 节](#/article/compose-layout?section=1)。[Modifier 顺序与作用域](https://developer.android.com/develop/ui/compose/modifiers)。

## 4. 主题与语义让同一组件适应不同用户

行已经能复用，但硬编码黑字白底在深色模式下可能失去对比。应优先使用主题中的语义角色：

```kotlin
Text(
    text = title,
    color = MaterialTheme.colorScheme.onSurface,
    style = MaterialTheme.typography.bodyLarge
)
```

onSurface 描述放在 surface 上的内容角色，不是“所有文字永远用这一色”。错误提示、禁用与选中状态应有各自适用角色。主题调整集中管理，也避免每个组件重新判断深色模式。

同样，字符串应来自资源而不是在所有代码里写中文。复数、格式化参数和 RTL 需要资源与布局一起设计；start/end 能表达阅读方向，left/right 是物理方向。

收藏动作除了外观，还要能被读屏和键盘理解。若用选择组件表达，可以显式把标签和状态交给语义：

```kotlin
Checkbox(
    checked = saved,
    onCheckedChange = { onToggleSaved() },
    modifier = Modifier.semantics {
        contentDescription = "收藏文章" // 产品代码换成已解析的本地化字符串
    }
)
```

Checkbox 已有选择状态的标准语义，不必再添加互相矛盾的手工状态。整行打开文章与内部收藏是两个动作，应分别验证可达性，不应让读屏只读到一个含糊的“按钮”。如果使用带文字的控件，避免重复添加相同描述导致重复朗读。

字号增大和长标题会改变测量；仅颜色适配无法解决裁切。下一步用 Preview 与语义测试检查这些变化。[Material 3 主题](https://developer.android.com/develop/ui/compose/designsystems/material3)、[语义](https://developer.android.com/develop/ui/compose/accessibility/semantics)。

## 5. 环境依赖可以隐式传递，业务输入保持可见

标题、收藏值通过参数传入很清楚，但每一层都传颜色、密度和间距会很繁琐。CompositionLocal 允许某个组合子树提供环境，让深处消费者读取最近的提供值。

以自定义间距为例：

```kotlin
data class AppSpacing(val small: Dp = 8.dp, val content: Dp = 16.dp)
val LocalAppSpacing = staticCompositionLocalOf { AppSpacing() }

@Composable
fun CompactArea(content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalAppSpacing provides AppSpacing(small = 4.dp, content = 8.dp)
    ) { content() }
}

@Composable
fun SpacedTitle(title: String) {
    Text(title, Modifier.padding(LocalAppSpacing.current.content))
}
```

同一个 SpacedTitle 放在 CompactArea 内外，会读取不同环境。提供值沿组合范围生效，不是进程全局单例；离开该提供范围，会回到外层值。

为什么例子使用 staticCompositionLocalOf？间距通常很少变，这类提供方式不做同样的逐读跟踪，提供值改变会使对应内容区域重组。compositionLocalOf 则跟踪读取，以消费者关系响应变化。static 不是“永远不更新”，也不能只凭名字断言它更快。

把 ViewModel 整个放进 Local 虽然省参数，却让 ArticleRow 隐式依赖页面环境，Preview 和跨页面复用又回到起初的困难。评审时问：这是环境属性，还是具体业务输入？只有为了绕过正常参数传递而新增 Local，通常应先重新看组件边界。

代价包括依赖不在函数签名里显现、默认值设计和测试环境构造。工具不是禁止使用隐式依赖，而是要求隐式的理由清楚。[CompositionLocal 契约与选择](https://developer.android.com/develop/ui/compose/compositionlocal)。

## 6. 用同一个组件做静态与动态验证

纯 UI 的价值可以立刻体现在 Preview：

```kotlin
@Preview(showBackground = true, fontScale = 1.5f)
@Composable
fun ArticleRowPreview() {
    MaterialTheme {
        ArticleRow(
            title = "一篇很长的文章标题，用于观察换行和按钮空间",
            saved = true,
            onOpen = {},
            onToggleSaved = {}
        )
    }
}
```

需要 tooling-preview，预览宿主应提供主题与自定义 Local。这里传固定输入和空回调，不从 Preview 发真实网络请求。分别观察加载、空结果、失败、长文本、深浅色、RTL 和大字体，但无需为每个内部 Box 创建一张截图。

本例固定输入的 Preview 用于检查该状态的外观，不能证明事件交给了正确文章。工具也支持交互或动画预览，但这仍不能替代对业务数据流、恢复和宿主行为的验证。下一层组件测试记录 onToggleSaved，再由集成测试验证状态层成功或失败后输出什么。不要要求无状态行点击后自己修改传入 saved。

Spike 可以先删除所有 ViewModel 与导航依赖，仅用固定数据展示行；如果仍必须启动整个应用，说明组件边界还没有真正独立。反过来，也不要为了“纯粹”拆出大量没有复用和职责价值的小组件。

测试同步、语义合并和恢复的具体代码在 [测试教程](#/article/compose-testing)。这一步完成后，应能从输入和环境解释组件外观，从事件解释业务如何接入，而不必猜内部隐藏了哪个单例。

## 面试提炼

1. 状态与事件怎样帮助组件复用，什么局部状态仍可保留？（回看第 1 节）
2. sealed 状态模型避免了哪些矛盾，刷新旧数据的新需求怎样加入？（回看第 2 节）
3. Modifier 为什么有顺序，调用方传入的 modifier 应作用在哪里？（回看第 3 节）
4. 主题、无障碍和 CompositionLocal 各解决什么，隐式业务依赖的代价是什么？（回看第 4、5 节）
5. Preview 通过以后还有哪些行为必须用其他验证方式证明？（回看第 6 节）

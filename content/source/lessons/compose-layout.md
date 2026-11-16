## 1. 从三个标签推导约束协议

搜索页要显示“Android”“Compose”“性能”三个标签。固定写三个横坐标很容易，直到窗口变窄、用户放大字体，第三个标签被挤出屏幕。问题不在坐标算得不够精确，而是我们还不知道可以使用多少空间、每个标签实际需要多大。

Compose 用约束把这两件事连接起来。父布局下发 `Constraints(minWidth, maxWidth, minHeight, maxHeight)`，子布局在允许范围内报告尺寸；父布局拿到尺寸后决定放置位置。测量返回的 `Placeable` 同时携带尺寸和放置能力，尚未测量的子项由 `Measurable` 表示。

```text
父级给标签容器：宽 0..100，高 0..200（单位 px）
容器给各标签：宽 0..100，高 0..200，最小值清零
标签返回：40×20、45×24、30×18
容器决定：哪些同一行 → 自己多高 → 每项坐标
```

为什么清除传给子项的最小尺寸？如果父要求容器至少宽 100，而容器把这个最小宽度原样传给每个标签，每个标签都可能被迫占满一行。父对整个容器的要求，不一定是对每个子项的要求。容器最后还要用父约束限制自己的尺寸，不能因为子项小就忽略父要求。

这里的数字是像素，业务代码里的 `dp` 要在测量作用域按密度转换。`maxWidth` 也可能无界，例如横向滚动内容；“无穷宽”表示没有这个上限，不是可以返回的实际宽度。标签需要换行时必须先有一个有限的行宽，本篇实现会明确拒绝无界宽度。

## 2. 先确认常用布局是否已经足够

既然父负责分配空间，为什么不直接使用 `Row`？因为 Row 的主规则是横向排放，不是放不下就换行。若需求只是“标题占剩余宽度，右边收藏按钮保持自然宽度”，Row 已经能表达：

```kotlin
Row(Modifier.fillMaxWidth()) {
    Text(title, Modifier.weight(1f), maxLines = 2)
    TextButton(onClick = onFavorite) { Text("收藏") }
}
```

`weight` 是提供给 Row 的父数据，不是 Text 自己按百分比改变宽度。Row 会为非权重项测量并留出空间，再按权重分配剩余宽度。默认 `fill = true` 使权重项占据分给它的份额；改为 false 后它可以更小，但不能据此假定剩余部分必然重新分配给其他权重项。没有有限总宽时，“剩余空间”也不能按屏幕宽度想当然计算。

再加一个需求：价格“99”和单位“元”的字号不同，要看起来对齐。按外框居中并不能保证文字基线相同，可给 Row 内两个 Text 都设置 `Modifier.alignByBaseline()`。这让布局比较的是字体提供的对齐线，而不是某个机型上试出来的 padding。

因此，真正值得自定义的部分是常规布局无法表达的测量关系。本篇用换行实现练习协议；实际产品若标准 `FlowRow` 已满足需求，应先使用并验证它，避免无必要地维护布局算法。接下来写代码，是为了能解释标准组件背后的决策过程。

## 3. 把换行规则写成一次测量算法

假定行宽 100px、水平间隔 8px、行距 6px。记录当前行已用宽、当前行高和当前 y；只有“当前行非空，而且加上新标签会超宽”时换行。

| 子项 | 尝试位置 | 判断 | 最终位置 | 当前行高 |
| --- | --- | --- | --- | --- |
| 40×20 | x=0 | 第一项直接放置 | (0,0) | 20 |
| 45×24 | x=40+8=48 | 48+45=93≤100 | (48,0) | 24 |
| 30×18 | x=93+8=101 | 101+30>100 | (0,30) | 18 |

最终内容高度是 `30 + 18 = 48px`。这不是把三个高度相加：同一行高度取最大值。下面是对应的教学实现，使用 `androidx.compose.ui.layout.Layout`、`IntOffset` 和 `Dp` 等常规 Compose API；适用于有限宽度、内容数量较少且不滚动的标签容器。

```kotlin
@Composable
fun TagFlow(
    modifier: Modifier = Modifier,
    horizontalGap: Dp = 8.dp,
    verticalGap: Dp = 6.dp,
    content: @Composable () -> Unit,
) {
    Layout(content = content, modifier = modifier) { measurables, constraints ->
        require(constraints.hasBoundedWidth) { "TagFlow needs a finite width" }
        val gapX = horizontalGap.roundToPx().coerceAtLeast(0)
        val gapY = verticalGap.roundToPx().coerceAtLeast(0)
        val childConstraints = constraints.copy(minWidth = 0, minHeight = 0)
        val children = measurables.map { it.measure(childConstraints) }
        val positions = ArrayList<IntOffset>(children.size)
        var x = 0
        var y = 0
        var rowHeight = 0
        var rowHasItem = false

        children.forEach { child ->
            val start = if (rowHasItem) x + gapX else 0
            if (rowHasItem && start + child.width > constraints.maxWidth) {
                y += rowHeight + gapY
                x = 0
                rowHeight = 0
                rowHasItem = false
            }
            val placedX = if (rowHasItem) x + gapX else 0
            positions += IntOffset(placedX, y)
            x = placedX + child.width
            rowHeight = maxOf(rowHeight, child.height)
            rowHasItem = true
        }
        val height = constraints.constrainHeight(y + rowHeight)
        layout(constraints.maxWidth, height) {
            children.forEachIndexed { index, child ->
                val p = positions[index]
                child.placeRelative(p.x, p.y)
            }
        }
    }
}
```

每个子项只 `measure` 一次，放置使用已记录的结果。`rowHasItem` 没有用 `x != 0` 替代，因为一个零宽子项仍然是已放入行中的项目。`placeRelative` 把 x 理解为相对起始方向，使 RTL 下的起点能镜像；硬编码 `place` 左起坐标就没有这层语义。

这段代码刻意选择占满可用宽度，让行宽和容器宽一致。空内容仍可宽 100、高 0；若父要求最小高度 40，`constrainHeight` 会使结果高 40。若内容需要 48 而父最多允许 40，它报告 40，但子项仍可能画到外部：限制报告尺寸不等于裁剪，也不等于支持滚动。产品必须选择裁剪、限制行数或允许更大父空间，不能默默把被截断内容当作布局成功。

## 4. 从单次测量走到 Intrinsic 与 Subcompose

代码先把每项测量一次再决定换行。一个自然的改进念头是：先测自然宽，太宽就缩小后再测。普通 Layout 不允许在同一测量轮次任意重复测量同一子项；如果每层都反复试探，嵌套布局可能把工作成倍放大。这个约束迫使布局在测量前决定要下发什么限制。

但“双列文本之间的分隔线跟较高文本一样高”又确实需要先知道高度。`Intrinsic` 提供的是尺寸需求查询，不是第二次正常 measure。例如 Row 的 `height(IntrinsicSize.Min)` 会先询问在相应宽度下需要的最小固有高度，再按得到的高度正式测量。查询有自己的计算路径，自定义布局的默认近似未必符合换行语义；若要支持，应为给定宽度实现正确的固有高度计算，不能随便返回某个子项高度。

还有一种依赖并不是“多高”，而是“该创建什么内容”：剩余宽度足够就显示完整操作按钮，否则显示更多菜单。普通 Layout 的 content 已经在测量前组合，拿到测量结果时再临时添加另一段组合并不属于它的职责。`SubcomposeLayout` 为这种需求提供测量期间组合内容的能力。以下是协议伪代码，不是可粘贴的源码：

```text
measure(constraints):
  titleNodes = subcompose(slot = Title) { Title(...) }
  title = measure(titleNodes, titleConstraints)
  remaining = maxWidth - title.width
  actionNodes = subcompose(slot = Actions) {
    if remaining >= threshold: FullActions() else: MoreButton()
  }
  actions = measure(actionNodes, constraintsFor(remaining))
  return layout(title, actions)
```

slot 标识两份内容的身份，剩余宽度来自本次测量，避免先用 `onSizeChanged` 写状态再等下一帧改结构。代价是组合与测量发生更紧密的耦合，固有尺寸查询也不能照普通布局假定支持。只需要按父约束选大屏布局时，还可评估 `BoxWithConstraints`；只需要固定规则排标签时，前面的 Layout 已经足够。

可对照 [单次测量与自定义布局](https://developer.android.com/develop/ui/compose/layouts/custom)、[Intrinsic 查询](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements) 和 [SubcomposeLayout API](https://developer.android.com/reference/kotlin/androidx/compose/ui/layout/package-summary#SubcomposeLayout(androidx.compose.ui.Modifier,kotlin.Function2)) 阅读公共契约，不能把上述伪代码当成 AndroidX 实现。

## 5. 用占位需求区分测量、放置与绘制

标签展开时，要让下面的列表下移，还是仅让标签内容浮动？这决定了“动画优化”是否改变功能。容器高度由 24 变 48，需要父布局重新安排后续内容；只在绘制层把标签下移 24，列表占位不变，可能发生覆盖。

同理，一个位置指示点沿标签移动，不需要每帧改变自身尺寸。可以使用 `Modifier.offset { IntOffset(x.value, 0) }` 在放置阶段读取偏移；如果先在组合中写 `val position = x.value` 再传普通值，读取依赖已经提前建立，后面的 lambda 无法抹去它。

这里优化的是因果关系，不是语法长度：尺寸变化影响测量结果，位置变化影响放置结果，颜色变化影响绘制结果。具体失效传播和 Recomposer 的协调职责在 [刷新与调度](#/article/compose-phases?section=2) 第 2、6 节展开。本篇只需要记住，换行数变了是真正的布局变化，不能靠延迟读取逃避必要测量。

## 6. 从 Modifier 描述走到可复用的行为节点

多个标签都要一条调试边框。最初可以用 `drawBehind`；若团队要封装复用的底层行为，则需要理解 `Modifier.Node` 如何把“本次配置”和“长期行为对象”拆开。

下面用不改变占位的细边框演示。涉及 `ModifierNodeElement`、`DrawModifierNode`、`ContentDrawScope`、`Stroke` 与 `InspectorInfo`；省略 import，代码是自定义 Modifier 的最小结构。

```kotlin
fun Modifier.debugOutline(color: Color) = this.then(OutlineElement(color))

private data class OutlineElement(val color: Color) : ModifierNodeElement<OutlineNode>() {
    override fun create() = OutlineNode(color)
    override fun update(node: OutlineNode) { node.color = color }
    override fun InspectorInfo.inspectableProperties() {
        name = "debugOutline"
        properties["color"] = color
    }
}

private class OutlineNode(var color: Color) : Modifier.Node(), DrawModifierNode {
    override fun ContentDrawScope.draw() {
        drawContent()
        drawRect(color, style = Stroke(width = 1.dp.toPx()))
    }
}
```

当颜色从蓝变红，新的 Element 表达新配置；在兼容的节点位置更新旧 Node，而不是要求每次都销毁行为对象。`data class` 的相等比较包含 color，使配置变化可被识别；漏掉影响行为的参数，可能造成更新被错误跳过。这里保留默认自动失效行为，Node 更新后需要的绘制失效由框架处理；若主动关闭自动失效，就必须按职责触发相应失效，不能只改字段。

绘制描边沿矩形边缘居中，超出边缘的部分是否可见取决于裁剪。本例只用于说明 Node 协议，不是带内容内边距和完整形状支持的产品边框。如果线宽需要占位，应再承担布局职责，而不是期待 DrawModifierNode 改变测量尺寸。

Node 可以保存生命周期相关的行为状态，但仍需在附着、脱离时成对管理订阅。普通边框优先用现成 Modifier；只有行为复用、生命周期或性能需求明确时，才值得自己维护节点。可对照 [自定义 Modifier](https://developer.android.com/develop/ui/compose/custom-modifiers) 核验当前版本的更新与失效接口。

## 7. 用可解释的输入定位布局问题

现在回到标签被裁切的故障，记录四份证据：父约束、每项测量尺寸、放置坐标、最终裁剪区域。如果容器报告 40 高而内容算出 48，问题已经发生在约束与内容策略之间；如果尺寸正确却在 RTL 排反，检查放置坐标；如果首帧正确、后一帧跳动，检查是否把测量结果回写状态形成反馈。

为前面的算法设计一组可以手算的用例：宽 100 得到两行和 48 高；宽 70 时三项分别成行，内容高 `20+6+24+6+18=74`；空列表高度受最小高度控制；第一项零宽不应破坏间隔判定；无界宽度应明确失败。再覆盖字体放大、RTL 和内容超过最大高度的产品策略。

这些是验证输入与预期，本文没有把它们描述为已运行的设备测试。真正进入项目时，应先通过尺寸/坐标断言，再看截图、触摸和无障碍区域。布局算法算对了，并不自动代表用户能点到正确区域；输入命中规则接着看 [输入、滚动与焦点](#/article/compose-input)。

## 面试提炼

1. 为什么父的最小宽度不能直接要求每个标签都满足，测量与放置各解决什么？（回看第 1、3 节）
2. weight 和基线对齐为什么需要父布局参与？（回看第 2 节）
3. 单次测量、Intrinsic 和 Subcompose 分别处理哪一种依赖，代价是什么？（回看第 4 节）
4. Element 与 Node 为什么分离，漏掉配置相等性会有什么后果？（回看第 6 节）
5. 标签裁切或动画覆盖后续内容时，如何用约束和坐标区分原因？（回看第 5、7 节）

## 1. 先让进度拥有一个可解释的坐标空间

给下载按钮加一个环形进度条。最容易想到的是“进度乘 360 度，再画圆弧”，但第一次实现就可能遇到描边被切掉：画布宽 48，圆直径也用 48，描边的一半已经伸出边界。先把布局空间、几何空间和像素边界分清，后面的缓存与动画才有依据。

下面使用 Compose 的 `Canvas`、`DrawScope.drawArc` 和 `Stroke`。调用者传入 `State<Float>`，约定进度为有限数值；传 State 而非提前读出的 Float，是为了稍后观察“读取发生在哪里”。

```kotlin
@Composable
fun ProgressRing(progress: State<Float>, modifier: Modifier = Modifier) {
    Canvas(modifier.size(48.dp)) {
        val stroke = 4.dp.toPx()
        val diameter = (size.minDimension - stroke).coerceAtLeast(0f)
        val origin = Offset(
            (size.width - diameter) / 2f,
            (size.height - diameter) / 2f,
        )
        val arcSize = Size(diameter, diameter)
        drawArc(
            color = Color.LightGray, startAngle = -90f, sweepAngle = 360f,
            useCenter = false, topLeft = origin, size = arcSize,
            style = Stroke(stroke),
        )
        drawArc(
            color = Color.Blue, startAngle = -90f,
            sweepAngle = 360f * progress.value.coerceIn(0f, 1f),
            useCenter = false, topLeft = origin, size = arcSize,
            style = Stroke(stroke),
        )
    }
}
```

假设密度恰为 1，画布为 48×48px，线宽 4px。圆弧路径边界从 (2,2) 到 (46,46)，描边向两侧各延伸 2px，正好落在画布范围。实际设备按 `toPx()` 换算，不应把这个算例中的像素当作固定 dp。`startAngle=-90` 让起点位于上方，进度 0.25 对应 90 度，`useCenter=false` 表示不连到圆心形成扇形。

为什么仍需要 `.size(48.dp)`？Canvas 的绘制指令不会反过来申请布局尺寸。画一个 200px 的圆，只会产生更大的绘制范围，不会自动把旁边文字推开。尺寸仍取决于父约束和 Modifier；若父给了更小尺寸，代码使用的是实际 `size`。非常小的空间还要另定最小可用尺寸或隐藏策略，不能只靠把直径压到零保证视觉可用。

## 2. 先区分缓存对象、绘制指令与最终像素

圆环只有几个数值计算，直接绘制已足够。现在产品把它改成带波形的下载卡片：背景曲线由数百个点组成，尺寸不变时曲线不变，播放光标却每帧移动。如果每帧都重建 Path，重复工作才值得缓存。

先用一个三点路径说明依赖关系，生产环境可以替换成采样点生成算法。下面是 Modifier 片段，`progress` 仍是 `State<Float>`：

```kotlin
Modifier.drawWithCache {
    val path = Path().apply {
        moveTo(0f, size.height * 0.5f)
        lineTo(size.width * 0.4f, size.height * 0.2f)
        lineTo(size.width, size.height * 0.7f)
    }
    val lineWidth = 2.dp.toPx()
    onDrawBehind {
        drawPath(path, Color.Gray, style = Stroke(lineWidth))
        val x = size.width * progress.value.coerceIn(0f, 1f)
        drawLine(Color.Blue, Offset(x, 0f), Offset(x, size.height), lineWidth)
    }
}
```

外层负责构建可复用的对象，内层负责绘制。尺寸改变后路径需要重建；进度在内层读取，其改变只需要让使用它的绘制工作更新。如果把 `val x = ...progress.value` 提到外层，缓存构建就依赖进度，进度每次变化都可能让它重建。缓存是否有效由依赖决定，不由函数名字决定。

`drawWithCache` 缓存的是这些对象，不是把最后一帧存成位图。`drawBehind` 适合无需特殊缓存的背景；`drawWithContent` 允许控制原内容绘制前后的顺序。若要在文字上覆盖进度遮罩，应在 `drawWithContent` 中先 `drawContent()` 再画遮罩；不调用它就没有这一步的原内容输出。具体 API 契约见 [Graphics modifiers](https://developer.android.com/develop/ui/compose/graphics/draw/modifiers)。

还有一个容易忽略的输入：波形点集合。如果它是普通可变 List，原地修改不会因为使用了 Cache 就自动被观察。应传入可观察且版本明确的数据，或在新数据到达时替换输入。缓存只能减少已被正确建模的重复工作，不能修复数据变化不可见的问题。

## 3. 从绘制内容走到图层合成

波形本身不变，整个卡片需要淡出。重新构造路径没有意义，但“给每一笔都乘透明度”和“先画完整卡片再整体变透明”也不一定等价。

设两块不透明图形互相重叠，目标透明度是 0.5。如果对每块分别使用 alpha=0.5，重叠处的有效覆盖率在简化 alpha 模型下为 `0.5 + 0.5×(1−0.5)=0.75`。如果先把两块合成一个整体，再给整体 0.5，重叠处仍是整体的 0.5。颜色空间与具体混合还会影响最终像素，但这个算例已经说明，改变合成策略可能改变画面。

`graphicsLayer` 提供一层可独立配置的绘制隔离与变换。下面在图层属性块读取动画状态：

```kotlin
val opacity = animateFloatAsState(
    targetValue = if (visible) 1f else 0f,
    label = "download-card-opacity",
)
Box(Modifier.graphicsLayer { alpha = opacity.value }) {
    DownloadCardContent() // 当前页面已有的内容组件
}
```

图层并不保证永远分配独立纹理；是否需要离屏缓冲取决于属性、合成策略和平台。`CompositingStrategy.Offscreen` 可以明确要求离屏合成；`ModulateAlpha` 可能减少某些离屏成本，却不适合把所有重叠图形当成视觉等价替代。

评审时还要估算代价：一个 1080×2400 的 RGBA8888 缓冲仅像素存储约为 `1080×2400×4≈9.9MiB`，不包含额外缓冲、对齐和驱动开销。不能据此声称某张 Compose 卡片实际分配了这么多，这是理解大范围离屏合成成本的算例。先测实际图层和帧时间，再决定是否值得隔离。

图层缩放、平移通常也不改变兄弟的布局占位。需要下面的内容让位，就要回到 [布局与测量](#/article/compose-layout?section=5) 第 5 节，而不是把视觉变换当成尺寸变化。

## 4. 让动画 API 对应明确的控制权

现在进度从 0.2 跳到 0.8，希望平滑过渡。若业务只给目标、不需要手动停止，先使用目标驱动的 API：

```kotlin
val displayed = animateFloatAsState(
    targetValue = serverProgress.coerceIn(0f, 1f),
    animationSpec = tween(durationMillis = 300),
    label = "download-progress",
)
ProgressRing(progress = displayed)
```

它产出一系列中间值，绘制读取这些值。目标在动画中途变化时，新动画从当前动画状态继续调整，并不是每次重新从零开始。这里 tween 的 300ms 是教学选择，不是通用产品参数；实时数据若持续比动画更快更新，展示值会持续追赶，应评估是否直接展示或缩短平滑窗口。

需求再变：按钮被拖动，松手后吸附到边缘，再按下要立即接管。这时只有目标值不足以表达控制权，`Animatable` 更合适，因为它允许显式 `stop`、`snapTo`、`animateTo`。下面是输入控制器的时序伪代码，省略指针识别，不是可以并发随意调用的成品：

```text
同一个拖动控制器管理 position: Animatable<Float>
按下：取消上一段吸附协程；等待 position.stop 完成
拖动：按顺序 position.snapTo(clamp(position.value + dx))
松手：根据位置与速度计算 target；启动 position.animateTo(target)
再次按下：重复接管，旧协程的后续动作不得继续提交
离开页面：取消控制器作用域
```

`Animatable` 的互斥动画机制避免同一值同时被两个动画推进；被中断的挂起调用会收到取消。不要把“停止后还要发业务成功事件”放在无条件 finally 里，否则用户接管也可能触发错误成功。位置更新的串行性由控制器保证；给每个 MOVE 随意 launch 一个协程，会重新引入竞争。

若“收起/展开”同时控制颜色、尺寸和圆角，`updateTransition` 可以让多个属性共享同一个离散状态转换；如果要处理内容进入退出，则应看 `AnimatedVisibility`、`AnimatedContent` 的生命周期。选择依据是目标、控制权和内容寿命，不是 API 看起来是否高级。可对照 [值动画](https://developer.android.com/develop/ui/compose/animation/value-based) 与 [Animatable API](https://developer.android.com/reference/kotlin/androidx/compose/animation/core/Animatable) 核验中断契约。

## 5. 把每帧数值留在真正需要它的阶段

最初传 `State<Float>` 的理由现在完整了：如果写成 `ProgressRing(progress = displayed)`，并在 Canvas 绘制中读 `value`，进度依赖建立在绘制阶段。若在调用处写 `val p = displayed.value` 再传 Float，组合函数已经读取状态，需要随变化重新参与相应组合工作。

```text
动画时间 → 数值变化
  ├─ 组合体读取 → 对应组合范围失效 → 后续必要工作
  ├─ offset 放置块读取 → 位置更新
  └─ 绘制 / 图层属性块读取 → 相应绘制或图层更新
```

这不是承诺“后两种永远不会重组”，其他输入仍可让它重组；它只说明这一个高频读依赖放在哪里。也不是所有动画都该延后读取：进度数字长度变化可能需要文本排版，面板真实高度变化需要重新安排兄弟，必要工作不应该被优化掉。

机制由状态读取观察与各阶段失效连接起来。Snapshot 负责状态版本和观察，Recomposer 协调组合失效，布局与绘制有各自的更新入口；不要把全部变化统称为“刷新整棵树”。细节在 [Snapshot](#/article/compose-snapshot?section=8) 第 8、9 节和 [刷新与调度](#/article/compose-phases?section=2) 第 2、6 节继续展开。

## 6. 用中断序列和成本分布检验实现

先验证正确性：0.2→0.8 的中间帧应在合法范围；中途改为 0.1 后最终应到新目标；拖动接管后不能被旧吸附拉回；离开页面后不应再提交成功动作。这些断言比“最后截图是对的”更能暴露控制权错误。

再验证收益。对波形保留同一输入轨迹，分别记录路径构建、绘制次数、帧时间和内存。合理预期是进度变化时绘制继续、路径不重复构建；窗口尺寸变化时路径允许重建。没有复杂路径时 Cache 版本可能没有收益，这应是允许得到的实验结论，而不是为了证明选型而选择性报告。

图层对照要同时检查像素，尤其是重叠透明区、阴影和裁剪；不能只记录 CPU 时间下降。帧耗时还受 GPU、图片解码和其他线程影响，某个 draw 块短不代表整帧达标。用受控测试时钟验证动画中间态的方法见 [测试与恢复](#/article/compose-testing?section=4) 第 4 节，设备实验流程见 [性能治理](#/article/compose-performance)。本文给出推导与验证设计，没有声称运行过 Android 动画或测得性能收益。

## 面试提炼

1. 为什么圆弧直径要扣除描边宽度，绘制范围为什么不自动成为布局占位？（回看第 1 节）
2. drawWithCache 缓存什么，把进度读取移到外层会发生什么？（回看第 2 节）
3. 整体透明度与逐笔透明度为何可能不同，图层的成本怎样估算与实测？（回看第 3 节）
4. animateAsState、Animatable 和 Transition 分别对应什么控制需求？（回看第 4 节）
5. 如何证明动画优化减少了必要范围外的工作，同时没有破坏中断和视觉语义？（回看第 5、6 节）

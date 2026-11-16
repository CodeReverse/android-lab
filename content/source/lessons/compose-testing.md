## 1. 从找不到收藏按钮理解语义树

页面上的收藏图标明明存在，测试却 `onNodeWithText("收藏")` 找不到。先不要增加等待时间：图标未必带 Text，测试观察的也不是像素。Compose 的常用 UI 查询通过 Semantics 识别用户可感知的名称、状态和动作。

先给一个最小组件，以下代码使用 Material 3 与 Compose UI，省略常规 import：

```kotlin
@Composable
fun SaveButton(saved: Boolean, onToggle: () -> Unit) {
    Button(onClick = onToggle) {
        Text(if (saved) "已收藏" else "收藏")
    }
}
```

Button 提供点击动作，内部 Text 提供文字语义，合并后的语义树可能把它们表现为一个可操作节点。它不与组合调用次数或 LayoutNode 数量一一对应。查询 `onNodeWithText("收藏").assertHasClickAction()`，是在表达“用户能找到名为收藏的动作”，而不是“第二层第三个 Box 包含一个 Text”。

若查询失败，先 `rule.onRoot().printToLog("Semantics")`，必要时查看 `useUnmergedTree = true` 的树。若组件使用 `clearAndSetSemantics` 重定义了语义，内部视觉文字可能不再是外部查询依据；强行依赖未合并内部结构会使测试随重构频繁失效。

图标按钮则应该通过明确的内容描述或动作语义定位。`testTag` 适合没有稳定用户标签的测试边界，但不要为了测试给所有内部布局加标记。语义设计既影响测试，也影响无障碍，公共模型见 [Semantics](https://developer.android.com/develop/ui/compose/accessibility/semantics)。

## 2. 用两条测试分开事件输出与状态更新

现在能找到按钮，点击后该不该立刻显示“已收藏”？如果传入的是固定 `saved=false`，按钮没有修改这个外部参数的能力。先验证它把事件送出去，再验证宿主如何把事件转成新状态。

下面是可放入 Android 仪器测试的最小结构，依赖 `ui-test-junit4`、JUnit4 及测试宿主所需的 `ui-test-manifest` 配置。断言与动作来自 `androidx.compose.ui.test`，`assertEquals` 来自 JUnit；被测组件就是上一节的 SaveButton。

```kotlin
class SaveButtonTest {
    @get:Rule val rule = createComposeRule()

    @Test fun clickEmitsEventWithoutInventingState() {
        var calls = 0
        rule.setContent {
            MaterialTheme { SaveButton(saved = false, onToggle = { calls++ }) }
        }
        rule.onNodeWithText("收藏").performClick()
        rule.runOnIdle { assertEquals(1, calls) }
        rule.onNodeWithText("收藏").assertExists()
    }

    @Test fun hostFeedsNewStateBackToButton() {
        rule.setContent {
            var saved by remember { mutableStateOf(false) }
            MaterialTheme { SaveButton(saved) { saved = !saved } }
        }
        rule.onNodeWithText("收藏").performClick()
        rule.onNodeWithText("已收藏").assertExists()
    }
}
```

第一条保护组件契约：点击输出一次事件，但不能伪造已完成的外部状态。第二条验证最小单向数据流闭环：事件 → 宿主修改 State → 新值驱动显示。两个测试失败的含义不同，不能只保留第二条后把所有问题都叫“按钮失效”。

生产环境如果收藏需要仓储确认，应单独测试乐观更新、失败回滚或等待态。结果行还应验证输出的是业务 ID，而不是当前位置；头插后下标变化，事件不能指向另一篇文章。真正的网络响应顺序交给下一层受控测试，组件测试不必每次启动网络与导航。

## 3. 把异步完成变成可控输入

搜索 A 比 B 慢时，旧响应可能覆盖新查询。等待两秒再看结果只能碰运气，因为机器快慢会改变顺序。应让测试控制“什么时候完成哪一次请求”。

下面是一个可用于状态层测试的 fake；它只是返回数据，不替生产逻辑做版本校验：

```kotlin
class ControlledSearch {
    private val replies = mutableMapOf<String, CompletableDeferred<List<String>>>()

    fun prepare(query: String): CompletableDeferred<List<String>> =
        CompletableDeferred<List<String>>().also { replies[query] = it }

    suspend fun search(query: String): List<String> = replies.getValue(query).await()
}
```

测试先 prepare A/B，再触发 A、B，完成 B 后断言显示 B，最后完成 A 再断言仍是 B。与受控协程调度器配合时，推进启动任务和结果投递所需的调度，不靠真实网络时间。

还要问清这个 fake 验证了什么：`await()` 本身可取消，若实现依赖 `mapLatest`，A 可能已被取消，因此这个测试验证了取消路径，却没有覆盖“外部 SDK 忽略取消，迟到回调仍到达”。要验证请求版本防线，应另用可主动投递旧回调的 fake，在取消后仍投递 A，然后检查提交前的 ID 校验。不能用一个永远不产生迟到回调的 fake 宣称防竞态完全通过。

Compose 测试默认会同步它认识的 UI 工作；它不自动掌控所有后台线程、网络和平台异步任务。外部工作可使用明确条件、idling resource 或可控 fake。例如等待业务结果对应的语义出现：

```kotlin
rule.waitUntil(timeoutMillis = 5_000) {
    rule.onAllNodesWithText("B 的结果").fetchSemanticsNodes().isNotEmpty()
}
rule.onNodeWithText("B 的结果").assertIsDisplayed()
```

超时应输出当前查询、请求版本和语义树。增加超时只适合已知更慢的工作，不应掩盖错误同步。测试时钟、外部调度器与平台工作边界详见 [测试同步](https://developer.android.com/develop/ui/compose/testing/synchronization)。

## 4. 用受控时钟观察动画转向

默认同步适合等待稳定 UI，却会让我们错过动画中间态。假设面板宽度从 40dp 动画到 140dp，测试只看最终 140dp，无法证明中途关闭没有跳变。

为了把例子缩到可测量的行为，使用线性 tween，给 Box 一个稳定测试标记。以下测试片段使用前文的 rule，`expanded` 由测试控制：

```kotlin
val expanded = mutableStateOf(false)
rule.mainClock.autoAdvance = false
rule.setContent {
    val width by animateDpAsState(
        targetValue = if (expanded.value) 140.dp else 40.dp,
        animationSpec = tween(1_000, easing = LinearEasing),
        label = "panel-width",
    )
    Box(Modifier.width(width).height(20.dp).testTag("panel"))
}
rule.runOnIdle { expanded.value = true }
rule.mainClock.advanceTimeByFrame() // 处理目标变化
rule.mainClock.advanceTimeByFrame() // 让动画获得起始帧时间
rule.mainClock.advanceTimeBy(500)
rule.waitForIdle()
val middle = rule.onNodeWithTag("panel").getUnclippedBoundsInRoot().width
assertTrue(middle.value in 80f..100f)

rule.runOnIdle { expanded.value = false }
rule.mainClock.advanceTimeByFrame()
rule.mainClock.advanceTimeByFrame()
rule.mainClock.advanceTimeBy(1_100)
rule.waitForIdle()
rule.onNodeWithTag("panel").assertWidthIsEqualTo(40.dp)
```

范围断言允许帧量化和动画启动时机带来的差异，避免把刚好 90dp 当作跨设备契约。代码测的是布局宽度，所以适合 bounds 断言；如果动画只修改 graphicsLayer 的透明度，这个宽度断言没有意义，应选择视觉结果或合适的可观察行为。

测试时钟推进不等于所有 Android 测量、绘制和外部调度器同步推进，`waitForIdle` 仍用于等待相关平台工作。该示例不包含无限动画；关闭自动推进后，也不能再期待框架替我们把所有动画运行到终点。具体规则见 [动画测试](https://developer.android.com/develop/ui/compose/animation/testing)。本文展示测试设计，未在 Android 工程中执行这些片段。

## 5. 用恢复测试区分 remember 与可保存状态

旋转后搜索词还在，不代表进程回收后也能恢复；ViewModel 在配置变化中保留，但不能跨进程存活。先从最小的可保存组合状态验证：

```kotlin
@Test fun savedQuerySurvivesCompositionRestoration() {
    val restoration = StateRestorationTester(rule)
    restoration.setContent {
        var query by rememberSaveable { mutableStateOf("") }
        TextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.testTag("query"),
        )
    }
    rule.onNodeWithTag("query").performTextInput("compose")
    restoration.emulateSavedInstanceStateRestore()
    rule.onNodeWithTag("query").assertTextEquals("compose")
}
```

该测试放在持有同一 rule 的测试类中。它模拟可保存状态注册表的保存与恢复；如果改成普通 remember，应无法依靠它恢复 query。它并不真正杀死进程，也没有重建数据库、网络客户端或整个导航栈，因此不能把通过结果写成“进程死亡场景全部通过”。API 边界见 [StateRestorationTester](https://developer.android.com/reference/kotlin/androidx/compose/ui/test/junit4/StateRestorationTester)。

完整恢复应分层：Saver 是否输出支持的数据；宿主重建后 ID 与保存所有者是否对应；进程重新启动后能否凭 ID 和持久层重建；恢复账号是否仍有权访问目标资源。正在进行的请求不是可持久事实，恢复后应重新判断并发起必要工作，不能恢复一个 Loading 标志后永久等待已经不存在的协程。

用这条因果链设计测试，比把“旋转一次”作为全部恢复验收更准确。状态所有者的选择见 [State](#/article/compose-state?section=8) 第 8、9、11 节，返回栈所有者见 [导航](#/article/compose-navigation?section=3) 第 3 节。

## 6. 让语义、像素与真实操作互相补证

语义测试通过，仍可能出现文字被裁切；截图正常，也可能读屏把收藏按钮读成无意义图标。证据之间不能相互替代。

对收藏行建立三层检查：语义上有名称、可用动作与正确状态；视觉上在长标题、大字体、RTL、深色和窄窗口中不遮挡；实际键盘或读屏能按合理顺序到达并触发操作。文字颜色和背景过近、焦点陷入隐藏区域，都可能在最小业务点击测试通过时存在。

截图回归应固定字体、密度、语言、动画时间和数据，并为合理的渲染差异设定策略。更新基准图必须解释变化来自哪个需求；“全部接受新截图”不能当作修复。对于圆环动画的混合差异，截图或像素检查比语义合适；对于收藏事件到底对应哪篇文章，状态断言更直接。

不要为每个排列组合保存一张图。优先覆盖容易改变布局或交互的边界，再按缺陷记录扩展。无障碍检查和真实用户路径也应成为组件接口评审的一部分，避免把它们推迟到功能完成后才补。

## 7. 把失败定位能力作为测试分层目标

状态转换、请求版本校验和结果合并可以用快速单元测试；单组件输入输出、语义、局部恢复放 Compose UI 测试；导航、混合 View 生命周期与关键业务链用少量集成测试；性能则用独立受控基准。选择依据是风险在哪层出现，而不是哪种测试工具最熟悉。

例如“返回列表后收藏丢失”：若状态层持久化测试失败，先修保存；若仓储正确但组件固定接到旧值，查状态接线；若只在 Fragment View 重建后失败，查宿主与保存边界。分层让每个失败提供信息，而不是最后只得到一个端到端截图不一致。

发布前保留与本次改动相关的保护：列表身份、过期响应、恢复、动画中断或资源释放。偶发失败先归类为产品竞态、同步缺陷还是设备环境，保留第一次失败证据；反复重跑直到绿色不能证明可靠。本文中的代码是学习用测试案例，不代表本站已经执行了 Android 仪器测试；本站自身的内容与路由测试是另一层验证。迁移场景继续看 [互操作与迁移](#/article/compose-interop)。

## 面试提炼

1. 语义树与布局树为何不同，找不到可见内容时应先检查什么？（回看第 1 节）
2. 纯组件点击测试为什么不应要求它修改外部参数？（回看第 2 节）
3. 可取消 fake 能否证明迟到回调安全，测试时钟为什么不能替代外部完成条件？（回看第 3 节）
4. 怎样测试动画中断和状态恢复，又分别不能证明什么？（回看第 4、5 节）
5. 语义、截图、真实辅助操作和状态层测试如何分工？（回看第 6、7 节）

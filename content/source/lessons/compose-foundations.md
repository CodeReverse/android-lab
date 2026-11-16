先做一个最小收藏页面：显示当前收藏状态，点击按钮提出切换意图。我们暂时不追 Snapshot 和 SlotTable，先把代码、界面结构、状态输入与工程环境连起来。遇到后续要展开的机制，会给出它在这里的职责和阅读链接。

示例使用 Android 上的 Compose 与 Material 3。代码用于教学，未在本仓库构建 Android 应用；本仓库本身是资料网站。依赖版本以你的 Android 工程为准，不把开发分支的最新实现当成所有项目的既定行为。

## 1. 先把界面写成状态的函数

传统命令式写法常在事件后分别改按钮文字、图标和标题。一旦失败回滚只更新了其中两个，页面就会互相矛盾。先尝试让它们只根据同一个输入计算：

```kotlin
@Composable
fun FavoriteScreen(saved: Boolean, onToggle: () -> Unit) {
    Column {
        Text(if (saved) "文章已收藏" else "文章未收藏")
        Button(onClick = onToggle) {
            Text(if (saved) "取消收藏" else "收藏")
        }
    }
}
```

依赖 Runtime 的 Composable、Foundation 的 Column、Material 3 的 Button/Text。`saved` 是输入，`onToggle` 是用户意图输出。调用 `FavoriteScreen(false, ...)` 和 `FavoriteScreen(true, ...)`，同一份描述根据不同输入得到不同内容。

点击 Button 并不会自动修改 saved，因为它是调用方传进来的值。应由状态所有者处理事件，再让 UI 读取新状态。这种分工允许上层加入服务器失败、乐观更新或权限判断，而不用让按钮自己取数据库。

声明式不等于没有内部可变状态，也不等于所有东西每次都销毁重建。它首先改变的是业务表达方式：描述当前输入对应什么界面，运行时决定怎样复用已有内容。

为什么不是直接改 Text？因为当显示有多个来源时，统一输入更容易保持一致。简单静态界面使用传统 View 同样可以正确实现；是否迁移应比较工程成本，不能把 API 风格当成所有场景的性能证明。[声明式思维](https://developer.android.com/develop/ui/compose/mental-model)。

## 2. 一段代码同时形成几种不同的结构

对上面的页面，源码调用看起来像一棵树。但我们至少需要从三个角度观察它：

```text
调用与记忆：FavoriteScreen → Column 内容 → Text / Button → Text
布局：决定标题、按钮及按钮内部内容的尺寸与位置
语义：用户能读到的收藏状态，以及一个可执行的按钮动作
```

第一种用于解释调用身份和状态保存；第二种用于解释像素几何；第三种用于解释读屏与测试如何操作界面。它们相关，但不要求节点一一对应。

例如再加一层 MaterialTheme：

```kotlin
MaterialTheme {
    FavoriteScreen(saved = false, onToggle = {})
}
```

主题主要向下提供环境，不应仅因为多调用一个函数就推断屏幕多了一个矩形。Button 内部又可能包含多层布局，而测试和读屏通常把它理解为一个合并后的可点击语义对象。

这种区分有实际诊断价值：测试找不到内部 Text，先查语义合并；按钮位置错了，查约束与放置；备注串项，查组合身份。用同一张“View 树”解释三类故障，很容易找错层。

组合身份在 [SlotTable 第 1–5 节](#/article/compose-slots?section=1) 展开；语义查询在 [测试第 1 节](#/article/compose-testing?section=1) 展开。这里先记住每种结构解决哪一个问题。[语义树说明](https://developer.android.com/develop/ui/compose/accessibility/semantics)。

## 3. 输入变化以后，不是每层都从头重做

让页面真正拥有一份状态：

```kotlin
@Composable
fun FavoriteDemo() {
    var saved by remember { mutableStateOf(false) }
    FavoriteScreen(saved = saved, onToggle = { saved = !saved })
}
```

这段还需要 `remember`、`mutableStateOf`、`getValue/setValue` imports。先给它们最少职责：MutableState 提供可观察读写，remember 让同一组合身份重新执行时找回对象，by 把读写转给状态容器。为什么要组合使用，在 [State 第 1–4 节](#/article/compose-state?section=1) 逐步试错，这里不提前塞入全部内部机制。

点击的流程可以手工走一遍：

```text
用户点击 → onToggle → saved 写入 true
已有读取关系使相关工作失效
再次描述所需内容 → 标题和按钮采用新的文字
如果内容尺寸变化 → 需要相应布局与绘制
```

组合回答“有哪些内容和参数”；布局计算尺寸与位置；绘制生成画面内容。修改一个只在绘制回调读取的颜色，可能无需重新组合；修改文字通常又与文本测量相关。

所以“刷新了”只是用户看到的结果。排障时要进一步说清组合、测量、放置还是绘制发生了什么。源码函数执行日志，也不自动等于一帧已经呈现。[阶段与读取位置](#/article/compose-phases)用移动圆点做完整对照。

## 4. 工程配置需要对齐编译侧与运行侧

理解页面以后，准备在自己的 Android 工程验证。先列需要什么，而不是从网上复制一组互相不兼容的版本号：

| 配置层 | 职责 | 缺失或混用的典型后果 |
| --- | --- | --- |
| Android Gradle Plugin、JDK、SDK | Android 编译、打包与平台能力 | 构建环境或 API 范围不满足 |
| Kotlin 与 Compose Compiler 插件 | 将可组合源码转换为协议 | 编译配置失败或产物规则不同 |
| Runtime、UI、Foundation、Material 3 | 状态、UI 基础、布局与组件 | API 不存在或库组合不匹配 |
| Activity Compose | 将组合内容接入 Android 宿主 | 没有相应 setContent 扩展 |
| BOM | 协调其覆盖的一组 Compose 库版本 | 不等于自动添加库或升级 Kotlin 插件 |

Kotlin 2.x 项目通常应用与 Kotlin 对齐的 Compose Compiler 插件。下面只演示依赖关系，前提是 version catalog 已定义相应 aliases：

```kotlin
dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.activity.compose)
}
```

`libs...` 不是 Gradle 内建变量：catalog 需要将它们映射到真实坐标和已选版本。Material 3 常见坐标为 `androidx.compose.material3:material3`，Activity 为 `androidx.activity:activity-compose`；BOM 不能代替 Activity 等独立依赖的版本管理。

宿主通常在 ComponentActivity.onCreate 中用 activity-compose 的 setContent 接入 MaterialTheme 与 FavoriteDemo。UI 线程、窗口和 Activity 生命周期仍然存在，Compose 并没有替换这些平台职责。

记录可复现环境时至少保存 Kotlin/Compiler、各库、AGP/JDK、设备 API 和构建类型。要研究源码，先从实际依赖版本定位，不能拿滚动开发分支与旧项目逐行对照后宣称行为一致。[BOM 的职责](https://developer.android.com/develop/ui/compose/bom)、[编译器迁移配置](https://kotlinlang.org/docs/compose-compiler-migration-guide.html)。

## 5. 让一个未解现象决定源码阅读路线

假设按钮能正常工作，你现在想知道“没有注册监听，为什么写入会让标题变化”。不要从 Runtime 目录第一行开始读，可以先写出待验证的职责链：

```text
状态读写入口 → 记录哪个范围读过它 → 有效变化通知
→ 相关组合工作失效 → 协调执行 → 应用到目标节点
```

从 MutableState 的 getter/setter 进入能解释第一步；Snapshot 解释版本和观察入口；组合与调度层再解释后面的执行。哪一步没有证据，就将它保留为假设，去找对应入口。

如果问题换成“列表头插后备注换人”，链路重点应转到调用身份、key 和记忆记录，而不是继续研究 setter。若问题是“父参数没变为什么子还运行”，应检查直接状态失效和编译协议。

| 眼前疑问 | 继续阅读 |
| --- | --- |
| 同一 State 为什么能有不同可见值 | [Snapshot 第 3–5 节](#/article/compose-snapshot?section=3) |
| remember 保存在哪里，重排怎样匹配 | [组合结构第 2–7 节](#/article/compose-slots?section=2) |
| 哪些运行时代码由编译器补入 | [编译器第 1–3 节](#/article/compose-compiler?section=1) |
| 失效怎样转成组合或布局工作 | [刷新第 2、6 节](#/article/compose-phases?section=2) |

这不是要求先学会所有底层再写页面，而是为遇到的具体问题准备可继续深入的入口。理解应沿因果推进，不按源码文件大小衡量。

## 6. 用一个最小页面检查基础模型

第一轮 Spike 只保留一个按钮，不接网络和导航。先画出输入、事件与状态所有者，再执行三组对照：

1. 直接给 FavoriteScreen 固定 false：点击会输出事件，但输入不会自行变化。
2. 在外层用可观察状态并更新：标题与按钮都应由同一新值驱动。
3. 把状态改成普通局部变量：预测为什么普通赋值没有建立相同通知，以及创建位置重执行后为什么会初始化。

第三项的完整修复过程在 State 样章，不需要在这里再背一遍最终写法。继续把按钮放到两处，检查两份独立状态与共享状态的区别，就能知道自己是否真正理解了所有权。

再换字号、主题与父宽度，观察哪些是输入逻辑、哪些是布局问题。用测试工具查看语义树，确认用户动作可被识别。不要把 Preview 能显示当作宿主恢复、请求取消和系统输入都已正确。

这一轮的完成标准是能解释“值从哪里来、事件往哪里去、哪种结构负责当前问题”。后续进入 [组件与主题](#/article/compose-components)，再系统读 State；不必因为暂时说不出内部类字段就回头死记 Runtime 全貌。

## 面试提炼

1. 声明式 UI 改变的是哪一种职责分配，点击为什么不自动修改传入参数？（回看第 1 节）
2. 组合、布局与语义结构为什么不能一一对应？（回看第 2 节）
3. 一次状态变化为什么不必执行全部阶段？（回看第 3 节）
4. Kotlin/Compiler、Runtime 与 BOM 各控制什么，如何固定验证环境？（回看第 4 节）
5. 怎样由一个可复现现象组织源码阅读和最小实验？（回看第 5、6 节）

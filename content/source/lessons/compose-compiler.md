写一个 `Title(label)`，我们没有传 Composer，没有手写参数比较，也没保存“稍后从这里再执行”的回调。Compose 却能记住调用结构、重启某些范围并跳过一些工作。那些没有出现在业务源码里的协议从哪里来，是本篇要逐步解开的线索。

前置：[组合身份与记忆位置](#/article/compose-slots)。正文用 Kotlin 源码加原创协议伪代码推演；伪代码不是反编译产物，不用于承诺某版本的参数数量、位布局和优化顺序。真实验证需固定 Kotlin/Compose Compiler 与 Runtime 版本，本篇未执行 Android 编译实验。

## 1. 从普通调用走到运行时协议

先看最小函数：

```kotlin
@Composable
fun Title(label: String) {
    Text(label)
}
```

如果它只是普通函数，调用后只能按代码继续执行。Runtime 无从单靠这个签名知道：本次调用属于哪个组合位置、历史参数在哪里、某个状态变化后从哪里重启。

可以手工在每个函数里传一个上下文对象，再包围开始/结束记录，但这会让业务代码承担大量一致性约束。另一种方向是把 UI 表达为单独的描述树，运行时解释或对比。Compose 采用编译插件与 Runtime 协作：业务仍写 Kotlin，编译阶段为可组合调用补充协议。

先只增加一个概念参数，暂不讨论优化：

```text
源代码：Title(label)
协议示意：Title(label, composer)

Title 内部调用 Text 时，继续把 composer 传下去
```

Composer 是与当前组合执行关联的运行时协作对象，不是一个替代 Activity 的全局 UI 控制器。参数在业务语法中隐含，不代表运行时凭空猜出了上下文。

编译器能静态分析函数与调用结构，却不能提前知道用户下一次点击写了什么状态；Runtime 能观察实际值，却需要编译后的结构信息来组织执行。这种分工解释了为什么两者缺一不可。Kotlin 2.x 的 Compose 编译插件与 Kotlin 配套，Runtime 则是运行库。[编译器配置入口](https://kotlinlang.org/docs/compose-compiler-migration-guide.html)。

## 2. 调用方已经知道的信息不必每层重算

假设页面还有一个计数器，每次计数变化会使父函数重新执行，但标题始终是同一个字符串：

```kotlin
@Composable
fun Page(count: Int, title: String) {
    Text("点击：$count")
    Title(title)
}
```

如果 Title 每次都重新运行，语义通常可以正确，但可能做重复工作。要决定能不能复用，至少要知道 title 相比上次是否改变。

朴素办法是每个被调用函数各比较一次全部参数。调用链很深时，父层已经确定未变的信息就被反复检查。变化标记把“调用方知道什么”传给下一层：

```text
关于 title 的信息：
  未确定 → Title 需要按适用规则比较
  已知未变 → Title 可利用这个判断
  已知变化 → Title 需要按变化处理
```

实际实现会编码为位信息，并有强制执行、默认参数等相关信息；这里不假设某三个二进制值永远代表相同含义。

变化标记不等于 UI 输出缓存。它只是执行决策的输入。即使参数未变，函数内部直接读取的 State 已使该范围失效，也不能仅凭 title 相等就宣告无需执行。

先把“参数信息从上往下传”与“状态失效从观察关系进入”两条路径分开，后面才能正确理解跳过。[变化检测协议设计](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/design/how-compose-works.md)。

## 3. 给最小函数逐步补上分组与重启

有了上下文和变化信息，还要告诉运行时记录的边界在哪里。对具备相应资格的 Title，可以用下面的教学伪代码组合这些职责：

```text
Title(label, composer, incomingChange):
    scope = 开始一个可重启范围(编译位置标识)
    localChange = incomingChange

    如果 label 的变化未知：
        localChange = 用历史参数与当前 label 比较

    如果该范围需要执行，或不满足跳过条件：
        执行 Text 的组合调用协议
    否则：
        跳过并复用这一范围已有内容

    结束该范围
    按需要保存重启入口：以后携带正确参数重新进入 Title
```

开始/结束范围让 Runtime 能关联参数、读取与记忆记录；保存重启入口让将来的失效有执行入口。重启不表示所有祖先都必须完整重跑，也不等于重建整页控件。

再加入默认参数：

```kotlin
@Composable
fun Title(label: String = "收藏") { Text(label) }
```

调用方省略 label，与显式传入某个字符串，需要有信息帮助确定默认值是否应求值。默认参数标记与“上次相比是否改变”的标记解决不同问题，不应把两者都叫 dirty flag 后混为一谈。

编译器在 Kotlin IR 等阶段做 lowering：把高层构造变成更接近执行协议的形式，后端再生成目标代码。它不是先生成一个 View 类再调用 XML inflate。内联、返回值、注解、分支和编译选项会改变具体产物，不能把本节模板套到所有 `@Composable`。

现在仍有一个空缺：上面的“比较”到底凭什么安全？这就进入稳定性。

## 4. 稳定性首先是可依赖的行为契约

把字符串换成业务对象：

```kotlin
class Article(var title: String)

@Composable
fun ArticleTitle(article: Article) {
    Text(article.title)
}
```

若同一个 article 的 title 被普通赋值改变，引用仍然相同。仅比较引用可能错过变化；但每次深度遍历所有对象也代价高昂，还可能遇到循环和并发修改。因此必须明确对象对外提供什么保证。

可以先做两种合理建模：

```kotlin
// 方案一：不可变值；变化时由外部可观察状态提交新实例
@Immutable
data class ArticleUi(val title: String)

// 方案二：对象身份可保留，属性变化本身可观察
@Stable
class ArticleState(initialTitle: String) {
    var title by mutableStateOf(initialTitle)
}
```

需导入 `Immutable`、`Stable`、`mutableStateOf` 和委托操作符；两个类是对照，不要求同时使用。注解只是开发者承诺，不会把普通 var 改写为 MutableState。方案二 title 的可观察性来自委托状态，而不是 @Stable。

稳定性涉及相等关系的一致性、公开属性类型以及属性变化的可观察性；不可变又有更强的值不变承诺。`val list: List<T>` 只有引用与接口层面的限制，不自动证明底层集合和元素整个对象图都不可变。

错误注解最危险的结果是画面停留在旧值，而不是单纯性能不佳。选择建模方式应先保证语义，再查看编译器如何推断。[稳定性契约](https://developer.android.com/develop/ui/compose/performance/stability)。

## 5. 强跳过改变资格，却不修复不可观察修改

旧教程经常写“不稳定参数导致函数不能跳过”。这句话依赖编译模式。官方说明 Kotlin 2.0.20 起强跳过默认开启：符合条件的可重启函数即使含不稳定参数，也可具备跳过资格；稳定参数通常按 equals 比较，不稳定参数按实例身份比较。

因此拿两个内容相同的新 Article 实例传入，与反复传入同一个实例，不是同一种输入变化：

```text
old = Article("收藏")
new = Article("收藏")

old !== new：对不稳定参数，身份比较会认为不同
old.title 被原地修改：old 仍是 old，但普通修改没有状态通知
```

强跳过不会遍历对象内部为我们发现这种普通字段变化。它减少某些重复执行的机会，同时更要求开发者遵守可观察状态建模。

还要满足函数具备资格且没有独立失效等条件。返回值、特定注解与编译变换都可能影响结果；“强”不表示所有调用无条件跳过。

自动记忆 lambda 是强跳过的另一个相关变化，稍后第 7 节单独解释。项目应记录实际 Kotlin/Compiler 与配置，而不是只凭 Runtime 版本推断启用了什么。[强跳过规则及版本](https://developer.android.com/develop/ui/compose/performance/stability/strongskipping)。

## 6. 用四组输入走一遍执行判断

固定强跳过开启、目标函数可跳过，且排除无关失效后，对照四种输入：

| 改动 | 比较信息 | 不能漏掉的条件 |
| --- | --- | --- |
| 新建内容相等的稳定值对象 | equals 可为 true | 稳定契约与 equals 必须真实成立 |
| 新建内容相等的不稳定对象 | 实例不同 | 内容相等不等于此处采用内容比较 |
| 同一不稳定对象普通字段改了 | 实例相同 | 没有通知可能显示旧内容，并非优化正确 |
| 参数完全相同，内部 State 变化 | 参数可判未变 | 自身读取失效是另一条执行理由 |

最后一项可以用如下组件理解：

```kotlin
@Composable
fun ArticleTitle(article: ArticleState) {
    Text(article.title) // 实际读取可观察属性
}
```

article 对象没换，内部 title 的 State 发生有效变化，依赖读取仍会让相关范围需要工作。参数比较不能抵消自身失效。

反过来，父页面因 count 变化重执行，并不代表标题自身失效。若标题输入可判未变，Runtime 又允许跳过，便可能复用原来的内容。

判断时依次问：调用为什么被考虑执行？参数比较得到什么？自身有无读取失效？函数具有何种资格？这样比看一个日志就断言“Compose 整页刷新”更可靠。调度如何到达这些入口见 [刷新第 6、7 节](#/article/compose-phases?section=6)。

## 7. 回调也是参数，捕获值也是输入

父函数中一个看似不变的 lambda，重新执行时可能产生新对象：

```kotlin
@Composable
fun ArticleRow(article: ArticleUi, onOpen: (String) -> Unit) {
    Button(onClick = { onOpen(article.title) }) {
        Text(article.title)
    }
}
```

回调捕获 article 和 onOpen。若每次都创建新函数实例，子组件的回调参数身份可能变化，即使用户看到的内容没变。这是编译器记忆化 lambda 的动机之一。

强跳过模式下，对相应 lambda 的自动记忆会考虑捕获值。可以用概念模型理解：

```text
捕获输入仍按相应规则匹配 → 复用之前的 lambda
捕获输入变化 → 创建能使用新输入的 lambda
```

不能简单把实际编译规则写成与手工 `remember(captures)` 永远等价；手工 keys 和编译器对稳定/不稳定捕获的比较规则存在区别。

为什么不能把回调永久 remember，彻底不让它变？因为闭包可能保存旧文章或旧账号。复用是有条件的，业务语义优先。长时间 Effect 希望任务不重启、回调又保持最新时，需用另一种最新值模式；它不是编译器跳过的替代品，见 [Effect 第 3 节](#/article/compose-effects?section=3)。

## 8. 编译器升级要拆开几个版本轴

如果换了编译器后重组行为改变，应先确认改动来自哪里，而不是直接给所有模型补注解。

```text
Kotlin + Compose Compiler 插件 → 编译协议与优化
Compose Runtime / UI         → 运行时与 UI 实现
BOM                          → 协调其覆盖的库版本
构建选项与 variant           → 实际启用的配置
```

BOM 不会自动替你把 Kotlin 编译插件升级，也不会添加所有 Compose 依赖。升级实验先保持业务输入不变，再分别改变编译配置和库版本，避免一次“大升级”把原因混在一起。

若要在支持的 Kotlin 2.x 配置中做强跳过对照，使用所选插件支持的 featureFlags，而不是从旧博客复制已经弃用的开关：

```kotlin
// 已应用 Compose Compiler 插件的模块 build.gradle.kts；对照实验用
composeCompiler {
    featureFlags = setOf(ComposeFeatureFlag.StrongSkipping.disabled())
}
```

需导入插件 DSL 的 `ComposeFeatureFlag`，并核对插件版本支持范围。这不是建议生产默认关闭强跳过，而是建立可解释对照的手段。[官方编译选项 DSL](https://kotlinlang.org/docs/compose-compiler-options.html)。

## 9. 用 reports 把推测变成编译证据

运行日志告诉你某次执行发生了什么，编译报告解释函数和类型被赋予了哪些能力。二者不能互相替代。在已经启用插件的模块配置：

```kotlin
composeCompiler {
    reportsDestination = layout.buildDirectory.dir("compose-reports")
    metricsDestination = layout.buildDirectory.dir("compose-metrics")
}
```

执行项目实际的 release Kotlin 编译任务，找到 composables、classes 与汇总输出，具体文件名以插件版本为准。不要把 debug 的推断与 release 的执行直接混比。

先只读 ArticleTitle 的信息：是否 restartable、是否 skippable、参数如何分类。再读 ArticleUi/ArticleState 的稳定性原因。如果类型来自未被相应编译分析覆盖的模块，推断信息也可能不同；此时先检查模块与配置，再判断需不需要稳定性配置文件或调整模型。

报告里 skippable 增多，只表示更多调用具备跳过资格，不含真实设备帧耗时。还需要检查实际状态变化是否显示正确、比较成本是否值得。不要让报告数字成为优化的唯一目标。[报告解读](https://developer.android.com/develop/ui/compose/performance/stability/diagnose)。

## 10. 以一个可证伪实验结束源码阅读

建立三组模型：不可变值对象、普通可变对象、属性可观察的稳定对象。分别测试新建相同内容、原地修改、内部 State 修改，以及父级无关状态修改。

每组保存四份材料：源代码与输入、编译器版本与配置、报告、实际行为记录。若推测“这次可以跳过”，同时写出反例条件：内部读取失效、新回调身份或稳定契约错误都可能改变结论。

源码再按问题进入 Kotlin 仓库的 Compose compiler lowering：函数体如何转换、参数变化如何传播、类型稳定性如何推断。JVM 反编译便于观察输出，但不等于完整 IR，也不代表其他目标平台同样生成 JVM 字节码。[Kotlin Compose 编译器源码入口](https://github.com/JetBrains/kotlin/tree/master/plugins/compose)。

技术评审时，选择“拆组件、改状态建模、调整稳定性配置或暂不优化”，都应基于这组证据。把每个 Text 单独包装并不自动形成有价值的边界；如果本来执行很便宜，增加接口与比较反而可能不值得。性能归因继续读 [Compose 性能教程](#/article/compose-performance)。

## 面试提炼

1. 不依赖编译插件也能构建声明式 UI，Compose 为什么让编译器与 Runtime 协作？各自掌握什么信息？（回看第 1、2 节）
2. 变化标记、默认参数标记、分组和重启入口分别解决什么问题？（回看第 2、3 节）
3. 稳定性承诺什么，为什么 @Stable 不能修复普通 var 的不可观察性？（回看第 4 节）
4. 强跳过下四组参数变化该如何推演，lambda 捕获又怎样影响复用？（回看第 5–7 节）
5. 怎样用配置、报告和运行对照验证编译行为，而不拿重组次数替代性能？（回看第 8–10 节）

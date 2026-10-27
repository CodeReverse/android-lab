## 1. 编译插件的输入与产物

Compose 编译插件识别可组合调用，在 Kotlin 编译流程中进行相应变换，向函数与调用路径传递 Composer 及变化信息，生成组边界、可重启入口和条件跳过等代码。实际生成形式由函数性质、优化与版本决定，不是所有函数都一模一样地追加固定数量参数。

可以用概念伪代码理解：进入重启组 → 结合调用方变化标记和当前参数判断是否需要执行 → 执行函数体或跳过已有组 → 保存可能的重启入口。这里不是可直接复制的 Kotlin 源码，也不是承诺每个 @Composable 都可重启、可跳过。

## 2. 变化信息的调用链传递

调用方若已经知道参数未变或属于可确定常量，可把信息传给被调用方，减少重复比较。变化位掩码还要区分尚未确定、已变化等状态；参数多时可能需要多组标记。源码阅读应以具体编译器版本的 IR lowering 和输出报告为依据，不用网上某段旧反编译代码推断所有情况。

默认参数、内联、返回值和控制流都会影响生成代码。Compose Compiler 与 Runtime 是合作关系：编译器提供结构和变化检查，Runtime 在运行期间管理状态读依赖与失效。编译阶段不能提前知道每次点击后的所有数据变化。

## 3. 函数转换协议示意

原始概念函数：`@Composable fun Title(label: String) { Text(label) }`。对于符合可重启/可跳过条件的形式，可按下面伪代码理解；它不是可编译代码，也不承诺实际 lowering 顺序、参数个数或位布局。

```text
接收 label、Composer 和调用方变化信息
进入相应组合分组
如果调用方信息不足：按适用规则比较 label
如果本范围需要执行：运行 Text 的调用协议
否则：跳过可复用的组内容
离开分组；按需要登记后续重启入口
```

changed 信息是执行决策输入，不是“缓存好了整个 UI”。默认参数还需要表达哪些参数未显式提供；直接状态读取造成的失效又是另一条触发路径。一个函数是否形成独立重启边界，要结合内联、返回值、注解和编译变换判断，不能套用所有 @Composable 都同构的反编译模板。

## 4. 稳定性与跳过条件

稳定性涉及相等判断一致性、属性变化的可观察性，以及公开属性类型等约束。Stable、Immutable 不是性能装饰品；标注者需保证承诺成立。把含普通可变字段的对象强行标为稳定，可能使 UI 因错误跳过而停留在旧状态。

Kotlin 的 val 与 List 只读接口也不自动证明整个对象图不可变。跨模块的类型推断与编译设置可能影响报告，应该查看编译器给出的实际稳定性和可跳过结果，再决定是否需要不可变模型或模块配置。

## 5. 强跳过与版本边界

官方文档说明从 Kotlin 2.0.20 起强跳过默认启用。在该模式下，更多可重启的函数具备跳过资格；不稳定参数通常采用实例相等比较，稳定参数采用 equals；编译器也对组合中的 lambda 做更多自动记忆化。具体例外与配置应查当前项目编译器，不能只背“参数不稳定就永不跳过”的旧规则。

强跳过并不修复原地修改对象而没有状态通知的设计。若同一实例内部悄悄变了，实例相等仍成立，反而更需要正确状态建模。lambda 自动记忆化也不意味着可以忽略捕获值变化和副作用生命周期。

## 6. 参数比较与跳过矩阵

前提是所选版本强跳过启用、目标函数具有相应资格、没有自身失效等其他强制执行条件。稳定参数通常使用 equals，不稳定参数按实例身份比较。

| 输入变化 | 应先检查的事实 | 推理方向 |
| --- | --- | --- |
| 新建但内容相等的稳定模型 | equals 与稳定契约是否成立 | 参数比较可判未变 |
| 新建但内容相等的不稳定模型 | 实例是否相同 | 不应仅凭内容相等推断能跳过 |
| 同实例普通 var 被改 | 是否有可观察通知 | 没通知可能显示旧值，不能当优化成功 |
| 参数相同但内部 State 失效 | 该范围是否实际订阅 | 参数未变不排除本范围重执行 |

`@Stable`、`@Immutable` 约束数据行为，错误承诺可能破坏 UI。集合接口只读与整个对象图不可变也不同。矩阵是教学推理条件，不是各构建版本的实测结果。[强跳过规则](https://developer.android.com/develop/ui/compose/performance/stability/strongskipping)。

## 7. lambda 的记忆化

强跳过下编译器会对组合中的 lambda 做记忆化处理，捕获值参与键比较；稳定与不稳定捕获按相应规则处理。普通手写 remember keys 使用对象相等规则，不能把源码中的概念转换当成两者在所有情况下完全等价。lambda 本身的稳定性与它每次是否为新实例也是两个问题。

原创建模：回调捕获当前 Article 对象；数据层每次创建一个新的不稳定实例，即使 ID 相同，捕获身份仍可能变化。解决是否改成捕获稳定 ID，应基于实际语义，不能忽略回调确实需要的其他数据。需要计时不中断但读取最新回调时，使用 Effect 的最新值模式，而非盲目冻结 lambda。

## 8. 编译器升级验证

Kotlin 2.x 的 Compose 编译器插件与 Kotlin 版本配套配置，Runtime、UI 和 BOM 则是相关但不同的依赖轴。升级要同时检查插件配置、生成报告、release 构建表现与实际页面行为，不能只把 BOM 升级成功当作编译器已升级。

## 9. reports 与 metrics 的读取

使用与 Kotlin 配套的 Compose 编译插件，在目标模块配置报告目录。下面是 Kotlin 2.x 插件 DSL 的示意，需要置于已启用插件的模块中；它不是本网站执行过的 Android 构建。

```kotlin
composeCompiler {
    reportsDestination = layout.buildDirectory.dir("compose-reports")
    metricsDestination = layout.buildDirectory.dir("compose-metrics")
}
```

在该项目真实的 release variant 执行 Kotlin 编译任务，检查 composables/classes 报告和汇总指标；名称按插件版本核对。关注目标函数的 restartable/skippable、参数稳定性及类型推断，再对照运行行为。报告不包含真实帧耗时，不能仅凭 skippable 数增加宣布优化成功。

从 Kotlin 仓库 Compose compiler 的 lower 目录定位函数体变换、参数与类型处理，并固定到项目版本；生成字节码/反编译结果用于观察协议，不等同全部 IR。资料：[编译器选项 DSL](https://kotlinlang.org/docs/compose-compiler-options.html)、[编译器报告解读](https://developer.android.com/develop/ui/compose/performance/stability/diagnose)。

## 10. 编译产物与运行对照

固定 Kotlin/插件/Runtime 版本，对不可变模型、普通可变模型和正确可观察模型生成 compiler reports。比较配置差异，再用 release 场景验证显示正确性与性能。先验证语义正确，再接受“更少执行”的结果。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [强跳过模式与版本](https://developer.android.com/develop/ui/compose/performance/stability/strongskipping)
- [稳定性契约](https://developer.android.com/develop/ui/compose/performance/stability)
- [编译器迁移配置](https://kotlinlang.org/docs/compose-compiler-migration-guide.html)

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. Compose 编译插件识别什么，生成什么？（回看第 1 节）
2. changed 信息为什么沿调用链传递？（回看第 2 节）
3. 稳定与不稳定参数，怎样用对照矩阵回答跳过问题？（回看第 6 节）
4. 怎样生成 reports/metrics 并读出可验证结论？（回看第 9 节）
5. 怎样对照编译产物与运行表现验证机制？（回看第 10 节）

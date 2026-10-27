## 1. 状态驱动的 UI

Compose 用组合函数根据输入与状态描述界面。可观察 State 的读取会进入相应观察机制，写入变化让依赖的工作失效，之后在调度中重新执行必要部分。State 不是 View，也不保证每次赋值都重建全部界面；状态所有权、可观察性、变更等价判断和生命周期要分开讨论。

## 2. 记忆值与可观察状态

remember 保存组合中某个位置的计算结果；mutableStateOf 创建可观察状态。只有普通变量，重组时可能重新初始化，也没有状态写入通知；只有 remember 保存普通可变对象，字段变化仍可能不可观察；二者组合才是常见的局部响应式状态模式。

```kotlin
@Composable
fun Counter() {
    var count by remember { mutableStateOf(0) }
    Button(onClick = { count++ }) { Text("$count") }
}
```

这段示意中，remember 让同一组合身份下复用状态对象，读取 count 会触发 State 的 getter，写入经过 setter。实际订阅到哪个重启作用域取决于读取位置与编译结果，不要机械地说“整个 Counter 和全页面必然一起刷新”。

## 3. 写入、失效与重组

点击回调修改 state；写入根据 mutation policy 判断是否有有意义变化；Snapshot 系统记录修改并在相应应用/通知流程中让观察者知道；组合中读取过该状态的相关作用域被标为失效，Recomposer 在调度中重执行所需部分。布局或绘制阶段读取的状态可以直接使对应阶段失效，不必全部经过重组。

因此，“state 变化会立刻重绘屏幕”至少漏掉等价判断、读依赖、调度和阶段四个条件。多次状态写入也不意味着必须产生同样次数的可见帧。

## 4. 集合变更的可观察性

普通 MutableList 的 add 不会自动通知 Compose。即使它放在 mutableStateOf 中，直接修改列表对象内部，可能没有经过状态赋值或产生可判定的新值。可以用不可变 List 快照替换，或按需求使用 snapshotStateList 等可观察容器。容器可观察不代表内部元素的任意普通字段都自动可观察。

remember(key) 在 key 改变时重新计算，其目的不是替代数据流。若每次传入不稳定且总变化的 key，会丢失原本应保留的局部状态；若把应该更新的数据错误封在无 key 的 remember 中，又可能读到过期值。先定义状态身份，再选择 key。

## 5. 状态所有权与存活范围

多个组件共享同一个事实时，将状态移到能够协调它们的最低共同所有者；不必把所有局部焦点、展开状态都塞进全局 ViewModel。组件接受不可变输入和事件回调，更容易测试，也能避免子组件偷偷修改外部对象。

remember 在离开组合后不保证保留；rememberSaveable 能参与可保存状态机制，但要遵守可保存类型、大小与恢复条件。ViewModel 适合页面级业务状态，却不能独自应对进程死亡。永久草稿仍应使用持久存储。

## 6. 搜索页状态恢复矩阵

先区分“重新计算便宜”“用户输入不能丢”“属于业务真相”三类，再选择持有者，而不是给所有字段套 rememberSaveable。

| 数据 | 建议所有者 | 何时恢复、怎样恢复 |
| --- | --- | --- |
| 搜索词与筛选 | 屏幕状态层 | 保存少量输入，重建后重新查询 |
| 当前网络结果 | 仓储/屏幕业务状态 | 缓存或重新加载，避免把大列表塞 Bundle |
| 行内临时展开 | 行或按 ID 的 UI 状态 | 明确离开页面后是否需要保留 |
| 滚动位置 | 列表 UI 状态 | 保存索引/偏移；数据变化时另考虑业务锚点 |
| 未提交长草稿 | 草稿仓储 | 持久化，不能只期待系统 saved state |
| 一次性提示 | UI 事件/待确认状态 | 按业务决定丢弃或重建，不能盲目重放 |

这份矩阵是案例设计，项目可能有不同要求。重点是每个事实只有一个权威来源，以及恢复之后如何重新建立依赖。ViewModel 保留不代表数据库持久化，进程死亡后需从 SavedStateHandle 和仓储重新构造状态。[状态保存](https://developer.android.com/develop/ui/compose/state-saving)。

## 7. 保存表示、子树与业务输入

Saver 定义自定义对象怎样转换成可保存表示、怎样恢复；不要存线程、Context、请求句柄或大位图。SaveableStateHolder 可以按稳定身份保存子内容内的可保存状态，再在相同身份恢复，适合需要保留离开组合子内容状态的场合；它不是无限寿命数据库，应清理已永久移除项。

SavedStateHandle 属于 ViewModel 的保存状态接口，适合恢复业务处理所需的少量输入。三个工具分别解决表示、子树身份和屏幕状态入口，不能互相当替代品。自定义 Saver 改字段时，要考虑旧状态恢复失败后的默认策略，保存成功也不承诺所有退出方式都必然恢复。

## 8. 计算缓存与组合身份

`remember(articleId) { Draft() }` 表达在当前位置 articleId 改变时重新计算该记忆值；`key(articleId) { ArticleEditor(...) }` 为一块内容建立相应组合身份。前者针对一个缓存计算，后者影响块内状态与副作用随业务项对应的方式。两者都不是全局 Map，也不凭空提供持久化。

推演列表重排：外层按 ID 识别编辑器，里面无参 remember 保存其临时草稿；若 ID 变了，业务已经是另一篇文章，旧草稿不应自动继承。再考虑同一 ID 的服务端标题更新：不应因为标题变化而把用户正在编辑的草稿随意清空。key 的选择表达业务身份，而不是“哪个字段变化最多”。

## 9. 生命周期收集与上游任务

UI 生命周期感知收集控制当前消费者何时订阅；生产者是否停止由 Flow 类型、共享策略和作用域决定。一个在应用作用域持续运行的热流，不会因为某个页面停止收集就自动关闭传感器。StateFlow 的最新状态语义也不同于逐条可靠事件投递。

对搜索页先画查询输入、共享状态与 UI 三个生命周期。取消 UI 订阅后，业务是否应该继续加载？若继续，结果归仓储还是页面？若停止，再进入时是否重复请求？这些问题由状态层设计解决，不是选了一个收集 API 就结束。进一步阅读[Flow](#/article/flow-state)和[生命周期感知收集](https://developer.android.com/develop/ui/compose/state)。

## 10. 读取阶段和恢复验证

比较普通变量、remember 普通对象、remember mutableStateOf 三种计数器；再把状态读取移到绘制 lambda，观察重组与绘制计数变化。日志计数会受调试行为影响，应配合工具解释，不能用函数打印次数直接等同屏幕刷新次数。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [Compose 状态管理](https://developer.android.com/develop/ui/compose/state)
- [SnapshotState 源码入口](https://github.com/androidx/androidx/blob/androidx-main/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SnapshotState.kt)
- [Compose 各阶段读取](https://developer.android.com/develop/ui/compose/phases)

## 面经选题来源

原帖仅支持选题，不代表本文全部内容是公司原题，也不用于估算行业频率。

- [MetaApp 一面 · 2026-07-01](https://www.nowcoder.com/feed/main/detail/ffabbdfbab1a49c0a8a1c99b7d121535)：原帖涉及 Compose 与 State；本文将状态问题展开成学习正文。

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. Compose 为什么围绕状态组织 UI？State 是什么？（回看第 1 节）
2. remember 和 mutableStateOf 分别提供什么能力？（回看第 2 节）
3. 搜索页的状态所有权和恢复矩阵应该怎么画？（回看第 6 节）
4. collectAsStateWithLifecycle 停止收集，上游就一定停吗？（回看第 9 节）
5. 怎样验证读取位置、重组与状态恢复？（回看第 10 节）

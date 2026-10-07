## 阅读方式

按定义、结构、运行过程、实现细节、故障与验证逐层阅读。问题顺序由本站编写；文末面经映射只证明相应主题被问过，不代表原帖出现了本篇全部追问。每问下方即为对应讲解。

## 第 1 问：Compose 为什么围绕状态组织 UI？State 是什么？

Compose 用组合函数根据输入与状态描述界面。可观察 State 的读取会进入相应观察机制，写入变化让依赖的工作失效，之后在调度中重新执行必要部分。State 不是 View，也不保证每次赋值都重建全部界面；状态所有权、可观察性、变更等价判断和生命周期要分开讨论。

## 第 2 问：remember 和 mutableStateOf 分别提供什么能力？

remember 保存组合中某个位置的计算结果；mutableStateOf 创建可观察状态。只有普通变量，重组时可能重新初始化，也没有状态写入通知；只有 remember 保存普通可变对象，字段变化仍可能不可观察；二者组合才是常见的局部响应式状态模式。

```kotlin
@Composable
fun Counter() {
    var count by remember { mutableStateOf(0) }
    Button(onClick = { count++ }) { Text("$count") }
}
```

这段示意中，remember 让同一组合身份下复用状态对象，读取 count 会触发 State 的 getter，写入经过 setter。实际订阅到哪个重启作用域取决于读取位置与编译结果，不要机械地说“整个 Counter 和全页面必然一起刷新”。

## 第 3 问：一次状态写入怎样走到重组？

点击回调修改 state；写入根据 mutation policy 判断是否有有意义变化；Snapshot 系统记录修改并在相应应用/通知流程中让观察者知道；组合中读取过该状态的相关作用域被标为失效，Recomposer 在调度中重执行所需部分。布局或绘制阶段读取的状态可以直接使对应阶段失效，不必全部经过重组。

因此，“state 变化会立刻重绘屏幕”至少漏掉等价判断、读依赖、调度和阶段四个条件。多次状态写入也不意味着必须产生同样次数的可见帧。

## 第 4 问：MutableList 内容改了为什么界面不一定更新？

普通 MutableList 的 add 不会自动通知 Compose。即使它放在 mutableStateOf 中，直接修改列表对象内部，可能没有经过状态赋值或产生可判定的新值。可以用不可变 List 快照替换，或按需求使用 snapshotStateList 等可观察容器。容器可观察不代表内部元素的任意普通字段都自动可观察。

remember(key) 在 key 改变时重新计算，其目的不是替代数据流。若每次传入不稳定且总变化的 key，会丢失原本应保留的局部状态；若把应该更新的数据错误封在无 key 的 remember 中，又可能读到过期值。先定义状态身份，再选择 key。

## 第 5 问：状态提升、rememberSaveable 与 ViewModel 怎样分工？

多个组件共享同一个事实时，将状态移到能够协调它们的最低共同所有者；不必把所有局部焦点、展开状态都塞进全局 ViewModel。组件接受不可变输入和事件回调，更容易测试，也能避免子组件偷偷修改外部对象。

remember 在离开组合后不保证保留；rememberSaveable 能参与可保存状态机制，但要遵守可保存类型、大小与恢复条件。ViewModel 适合页面级业务状态，却不能独自应对进程死亡。永久草稿仍应使用持久存储。

### 逐层追问与回答支点

- remember 是按变量名存储吗？不是；它依赖组合中的位置与身份，变量重命名不是关键。
- 写入同一个值会怎样？由等价策略决定是否形成有效变化，不能承诺每次赋值都重组。
- StateFlow 能直接替代 Compose State 吗？UI 需要通过收集桥接，生命周期和上游订阅成本仍要设计。

## 第 6 问：怎样验证读取位置、重组与状态恢复？

比较普通变量、remember 普通对象、remember mutableStateOf 三种计数器；再把状态读取移到绘制 lambda，观察重组与绘制计数变化。日志计数会受调试行为影响，应配合工具解释，不能用函数打印次数直接等同屏幕刷新次数。

## 原理依据与适用边界

本文是结合机制与工程约束的原创讲解。官方资料用于核对机制，工程方案是可讨论的设计建议；文中的推演与实验步骤不是已运行的测试结果。实现细节应以项目锁定的依赖版本为准。

- [Compose 状态管理](https://developer.android.com/develop/ui/compose/state)
- [SnapshotState 源码入口](https://github.com/androidx/androidx/blob/androidx-main/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SnapshotState.kt)
- [Compose 各阶段读取](https://developer.android.com/develop/ui/compose/phases)

## 面经如何映射到本篇

下列原帖只证明曾考察相应主题，不证明本文答案，也不代表该公司所有团队或资深岗位的统一要求。样本不足以计算行业频率。

- [MetaApp 一面 · 2026-07-01](https://www.nowcoder.com/feed/main/detail/ffabbdfbab1a49c0a8a1c99b7d121535)：原帖涉及 Compose 与 State；本文将状态问题展开成学习正文。

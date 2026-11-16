在收藏列表里给每篇文章写一段备注，然后在头部插入新文章。如果备注跟错了文章，我们首先需要理解的不是 TextField，而是 Compose 怎样辨认“这还是上次那一段内容”。

本篇沿两次函数调用、条件切换和列表重排，逐步推导组合身份与存储结构。前置：[State 中 remember 的职责](#/article/compose-state)。代码为教学片段，使用 Runtime 与 Material 3，省略通用 imports；未执行 Android 实验。内部协议均明确标为伪代码，不冒充编译器逐字输出。

## 1. 函数返回后，局部状态需要一个外部位置

先写一个允许编辑备注的小组件：

```kotlin
@Composable
fun NoteEditor() {
    var note by remember { mutableStateOf("") }
    TextField(value = note, onValueChange = { note = it })
}

@Composable
fun TwoNotes() {
    Column {
        NoteEditor()
        NoteEditor()
    }
}
```

第一次打开，两处输入框都为空。在第一处输入“稍后看”，第二处仍为空。这是预期：两次调用需要两份独立状态。

普通函数的局部变量随调用执行；后续重新执行函数时，不能靠之前的局部变量槽自动找回对象。`remember` 的值必须保存在函数栈之外，而且必须能区分这两次调用。

最简单的候选是一个全局 Map：以函数名 NoteEditor 为键保存状态。但两次调用同名，它们会错误共享一份备注。改成源码行号仍不够：在同一个循环调用点可以执行很多次，还可能在不同父调用中重复执行。

因此身份至少需要考虑它在本次组合调用结构中的位置。**同一函数定义不等于同一组合实例**。这与 View 有具体实例身份的直觉不同：这里业务代码每次重新运行，运行时还要找回对应的历史记录。

## 2. 从两次调用推导位置记忆

先把 TwoNotes 的调用路径写出来：

```text
TwoNotes
  Column 的内容
    第一个 NoteEditor 调用位置 → 状态对象 S_A
    第二个 NoteEditor 调用位置 → 状态对象 S_B
```

首次执行到第一个位置，计算 remember 的 lambda，保存 S_A；首次执行到第二个位置，保存 S_B。下一次执行到匹配的身份，取回对应对象，不再运行那次初始化 lambda。

可以写一个职责模型，注意它不是 Runtime API：

```text
rememberAt(position, calculation):
    如果 position 已有可复用值：返回旧值
    否则：计算 calculation，记录结果，再返回
```

这里隐含两个难点。第一，position 不是屏幕坐标，组件平移不应丢状态。第二，position 不能是一个永不变化的平面序号，控制流会插入和删除调用。

组合记录需要保存分组、父子关系及每组内的值，使位置由结构来解释。编译器帮助标记调用与控制流边界，Composer 在运行时消费这些信息。并不是 Runtime 每次解析 Kotlin 源文件来猜结构。

官方将这种把调用位置也视为输入的记忆方式称为 positional memoization。[组合机制设计说明](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/design/how-compose-works.md)。下面用自己的例子追踪记录，图中的分组粒度只用于教学。

## 3. 首次组合怎样建立组与槽位

把页面扩展为搜索词、一个可选筛选区，以及备注列表。先只看首次执行的逻辑结构：

```text
Page
  slot：queryState
  条件组 showFilter
    Filter
      slot：expandedState
  Items
    NoteEditor A
      slot：noteA
    NoteEditor B
      slot：noteB
  Footer
    slot：footerState
```

group 表达一段组合结构；slot 保存属于相应结构位置的数据，例如记忆值。**slot 不是一个 UI 控件，group 也不保证对应一个 LayoutNode**。主题函数可能只提供环境，布局函数可能产生节点，其他调用只是组织逻辑。

首次组合可以按下面的过程推演：

```text
进入 Page 组
遇到 query 的 remember → 创建并记录 queryState
进入条件组 → 根据实际分支创建 Filter 的记录
进入 Items → 分别创建 A/B 的记忆记录
执行产生 UI 节点的调用 → 记录目标树变更
退出各组，完成本次结构
```

调用被记录，不等于节点已在每一步直接上屏。组合执行、应用变更、平台布局绘制有不同职责，后文第 8 节再接起节点变化。

假如把 Filter 看作布局树中的一个矩形，会无法解释为什么不生成 UI 的 remember 仍有保存位置。先建立这三种区别，才不会把 SlotTable、组合调用树和 LayoutNode 树全叫成“那棵 UI 树”。

## 4. 列表顺序变化让位置身份暴露边界

现在用同一个循环调用点绘制 A、B。下面省略 Article 定义，仅假设它有稳定 id：

```kotlin
articles.forEach { article ->
    NoteEditorFor(article)
}

@Composable
fun NoteEditorFor(article: Article) {
    var note by remember { mutableStateOf("") }
    TextField(value = note, onValueChange = { note = it })
}
```

在 B 的输入框里写“准备复习”，再把 X 插到头部。只按重复调用点的执行顺序识别时，可以这样理解风险：

| 顺序身份 | 原来展示 | 原来保存的备注 | 头插后展示 |
| --- | --- | --- | --- |
| 0 | A | 空 | X |
| 1 | B | 准备复习 | A |
| 2 | 不存在 | 不存在 | B |

参数 article 换了，不必然意味着 remember 所属身份也被替换。运行时能够看到新数据，但它没有业务知识证明“这份备注属于文章 B”。要表达这种关系，需要显式业务 key：

```kotlin
articles.forEach { article ->
    key(article.id) {
        NoteEditorFor(article)
    }
}
```

此时 X 获得新身份，A/B 可以按原业务身份匹配。key 的唯一性是在相应组合上下文内讨论的，不要求全球所有页面的 ID 都不重复；同一组兄弟却不能用重复 key 混淆身份。

另一种写法 `remember(article.id) { ... }` 只在当前记忆位置的 key 变化时重新计算。它能让位置换数据时重置备注，却不等价于让整个重复调用分组携带身份移动。`key(...)` 管结构身份，`remember(keys)` 管计算缓存的有效性，必须分开。[组合生命周期中的 key](https://developer.android.com/develop/ui/compose/lifecycle)。

## 5. 条件删除为何不能只把槽位整体左移

列表头插需要业务身份，控制流还需要编译器提供结构边界。考虑：

```kotlin
@Composable
fun SearchPage(showFilter: Boolean) {
    if (showFilter) {
        FilterPanel() // 内部有 remember
    }
    Footer()          // 内部也有 remember
}
```

第一次 showFilter=true，Filter 和 Footer 都有记忆值。第二次 false，只剩 Footer。如果把值无分组地存成 `[filterState, footerState]`，第二次第一个 remember 就可能读到 filterState。这正说明一个简单的全局递增槽位索引不足以处理任意控制流。

编译变换为条件结构提供可匹配的组边界，Runtime 根据实际路径进入、跳过或移除对应范围：

```text
旧：Page [条件范围 {Filter:F}] [Footer:T]
新：Page [条件范围 {}]         [Footer:T]
操作：删除条件内部记录；保留 Footer 的身份和值 T
```

把 showFilter 再改为 true，普通条件内容离开组合后不承诺继续保存原来的 F。若产品希望折叠后再打开仍保留输入，应把数据提升到更长寿命所有者，或采用明确保存方案。不能把内部暂时残留内存当作业务保存契约。

这也解释了为什么“隐藏”和“移除”要区分：画成透明或不显示某种视觉内容，与根本不再调用该组合内容，可能有不同的生命周期和资源代价。

## 6. 新执行如何与旧结构匹配

现在可以把第二次组合视为一次受结构约束的增量更新。输入由 `[A,B]` 变为 `[X,B]`，都有稳定 key：

```text
旧组：A → noteA，B → noteB
新路径首先遇到 X：没有匹配身份 → 插入组与新状态
新路径随后遇到 B：找到原身份 → 复用 B 的状态
旧 A 未再出现：移除 A，安排遗忘与相关清理
```

不是每次重新执行都把所有 remember 初始化；也不是所有未执行的内容都已被删除。满足跳过条件的组会复用现有信息；子范围如果独立失效，还需按运行时规则处理，不能用“父跳过”推断所有后代永远不执行。

为什么不做一遍全量 Virtual DOM 对比？那是一种可行 UI 架构，但 Compose 已从编译器获得调用结构信息，又在运行时记录实际状态读取，可以利用这些信息定位工作。两者具体成本要看实现和负载，不能从“有编译器”直接推出所有场景更快。

这里将执行协议与存储实现分开：身份匹配是语义问题；用什么结构高效保存和移动记录，是下一个问题。参数变化、跳过和重启入口在 [编译器第 2–6 节](#/article/compose-compiler?section=2) 详细展开。

## 7. 经典 SlotTable 为什么使用紧凑数组与空隙

要存下这些组，可以为每个组创建对象、维护子列表和父指针，直观但会增加对象和引用管理；也可以把树按遍历顺序扁平存放，通过父关系和子树范围解释结构。经典 SlotTable 使用分组元数据与槽位数据的紧凑存储。

扁平数组的困难是插入。假设存着 A、B、C，在 B 前插入 X，普通连续数组要移动后面的元素。gap buffer 在当前编辑附近预留一段空隙：

```text
逻辑内容：A B C
物理内容：A [空隙 空隙] B C
插入 X： A X [空隙] B C
```

连续在同一位置附近插入，能复用空隙，减少反复移动尾部。若下一次去很远的位置编辑，则需要移动空隙；所以不能回答“所有插入都是 O(1)”。容量扩张、删除和移动也有自己的成本。

逻辑索引与物理数组位置因此不同。某个重启范围若长期保存旧物理下标，移动空隙后就可能找错对象；anchor 等定位机制用于在结构编辑中维持引用。它保存的不是屏幕坐标，也不是业务 articleId。

进一步读源码时，带着三件事查：组范围如何表达、逻辑地址如何换算、anchor 在插入删除时如何更新。[经典 SlotTable 固定源码](https://github.com/androidx/androidx/blob/9427d828d411efd95deab638a8cfdec23421987a/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SlotTable.kt)。这里刻意使用确定的历史提交；不要把该数组布局外推为所有未来 Runtime 的唯一实现。

## 8. 组合记录怎样落实到节点与资源生命周期

到这里我们一直在维护“调用结构和记忆值”。用户还需要看到真实文字和输入框，相关节点变化通过 Applier 等协议作用于目标树。

以移除 A 为例，逻辑上可以分开看：

```text
组合结构：A 的分组不再出现在新路径
目标节点：移除 A 对应的节点范围
记忆资源：遗忘属于 A 的记忆对象
副作用：按各自生命周期取消任务或解绑监听
```

一个组可能没有节点，也可能包含多个节点，所以不能拿组数当 View 数量。Runtime 能配合不同 Applier 工作，也说明组合机制不等同于直接操作 Android View。

创建了对象却没最终成为成功应用的一部分，与曾经被记住后来离开组合，是不同情形。RememberObserver 的记住、遗忘、放弃回调表达这类区分。因此不要把打开文件、启动不可回收请求等动作随手放进 remember 计算块，并期待“函数肯定只跑一次”。

需要配对资源时，在 UI 层选契约明确的 Effect。其启动与清理过程见 [副作用第 4、7 节](#/article/compose-effects?section=4)。本节只建立资源为什么与组合身份关联的理解，不把每种 Effect 的实现挤进槽位文章。[RememberObserver 契约](https://developer.android.com/reference/kotlin/androidx/compose/runtime/RememberObserver)。

## 9. 读源码先锁定实现，不把数据结构当永久契约

在本次核查的 AndroidX 开发提交中，经典 gap-buffer 实现已经发生包路径调整；运行时还存在其他表结构的演进。文件找不到不能直接推导“Compose 不再保存组合身份”，也不能拿早年字段结构回答所有版本。

源码阅读分三层：

1. 公共行为：相同身份可复用记忆，移除内容会触发生命周期变化。
2. 编译与 Runtime 协议：哪些控制流进入组，如何保存变化信息与重启入口。
3. 选定实现：组记录如何存储、定位、移动和回收。

为了避免版本混读，本篇第 7 节固定在 `9427d828…` 的经典实现；其他机制以公开契约为主。项目采用哪个实现，应查看自己 Runtime 的源码与构建配置。[Runtime 发布说明](https://developer.android.com/jetpack/androidx/releases/compose-runtime)用于发现变化，再固定对应发布源码继续研究。

如果评审时考虑替换内部存储，核心不是争论数组或链表名字，而是比较典型编辑局部性、内存局部性、定位开销及生命周期正确性。业务学习首先应掌握能跨实现保留的身份语义。

## 10. 用重排实验验证身份，而非只观察画面是否刷新

建立 A/B/C 三行，B 中输入独特备注，给各行注册一个可观察的进入/清理记录。依次做头插 X、交换 A/B、删除 B、重新加入 B，分别比较无 key、下标 key、业务 ID key。

先写预期：

| 操作 | 业务 ID key 下重点观察 |
| --- | --- |
| 头插、排序 | B 的备注应跟随 B，而不是原下标 |
| 参数内容变更但 ID 不变 | 状态是否按产品要求保留；不应误认为 ID 正确就自动更新不可观察字段 |
| 删除 B | 组合相关任务和监听是否清理 |
| 再加入 B | 普通 remember 不承诺恢复；若要求恢复，验证状态持有者或保存机制 |

为什么不只测重组次数？次数不能告诉你备注是否串项，也不能证明旧监听已解绑。这个实验的主要验收是身份与资源归属；性能是之后另一组指标。

普通 keyed Column 与 LazyColumn 的项管理不同，本例先用于理解一般组合身份。大列表的按需组合、contentType、滚动恢复见 [Lazy 列表教程](#/article/compose-lazy)。掌握这里的身份规则以后再进入 Lazy，才不容易把 key、复用和永久存储混成一个开关。

## 面试提炼

1. 为什么不能按函数名或一个全局顺序表实现任意 remember？（回看第 1–3 节）
2. `key(id)` 与 `remember(id)` 在列表头插时分别改变什么？（回看第 4 节）
3. 条件分支消失后，后续组件如何保持身份，消失组件的状态是否永久保留？（回看第 5、6 节）
4. gap buffer 优化哪种编辑成本，anchor 又为什么需要存在？（回看第 7 节）
5. 组合记录、目标节点和资源生命周期怎样配合，如何用重排实验验证？（回看第 8–10 节）

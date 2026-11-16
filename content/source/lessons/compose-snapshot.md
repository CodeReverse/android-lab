这一篇从一个问题开始：收藏列表正在被读取时，另一项工作修改了它，读者应该看到哪个版本？先尝试不用 Snapshot 的方案，再用小实验建立快照的使用模型，最后进入状态记录、冲突和观察机制。

前置阅读：[State：先理解可观察读写](#/article/compose-state)。下面独立函数使用 Compose Runtime，不需要 Composable；依赖、imports 按代码说明配置。输出是根据 API 契约的推演，尚未在 Android 工程执行。源码观察固定到 AndroidX 提交 `b8f12c706099a47e1e44d9772d03e14a4ae37146`，它是开发提交，不代表项目已使用该版本。

## 1. 先制造一次前后不一致的读取

收藏页有一份文章列表和一个选中 ID。要求很简单：有选中项时，它必须仍在列表里。起初数据为：

```text
items = [A, B]
selectedId = A
```

取消收藏 A 后，我们希望新状态为 `[B]` 与 `B`。假设这是两个普通可变字段，读者和写者可以交错执行：

```text
读取任务 R                         修改任务 W
读取 selectedId，得到 A
                                   items 改成 [B]
                                   selectedId 改成 B
读取 items，得到 [B]
用 A 在 [B] 中查找 → 找不到
```

W 最终写出的状态完全合理，R 却把旧 ID 和新列表拼在了一起。错误来自“一次逻辑读取使用了不同时间的数据”，不是 `find` 算法写错。这种现象在这里称为混合版本读取。

这只是一个允许交错的模型，**不表示 Android 主线程连续执行的两行赋值之间必然插入一次重组**。同一主线程中不让出执行权的普通代码有自己的串行保证。我们引入交错，是为了明确一个状态系统在存在多执行上下文时需要解决什么问题。

先把目标写清：R 开始读取后，希望在它的读取范围内看到一致视图；W 又希望先完成一组修改，确认成功后再让外部看到。除此之外，UI 还要知道哪些读取依赖受到了影响。隔离、成组提交和变化观察是相互配合但不同的需求。

如果只为这个收藏页解决问题，完全可以选更简单的状态建模。不能从这个例子直接跳到“所以所有应用必须使用多版本系统”。

## 2. 先评审串行、锁与不可变状态

第一种办法是串行化：读写全部交给同一个执行器，不在逻辑操作中间让出执行权。代码简单，数据的所有者也明确。但后台任务想参与修改时，需要通过队列提交；若一次读取或计算很长，其他工作就要等它完成。串行化不是错误方案，很多页面业务非常适合它。

第二种办法是对整个逻辑操作加锁。注意锁的范围必须覆盖“同时读取两个字段”：

```kotlin
// 说明同步边界的 Kotlin/JVM 片段；items/selectedId 为受同一锁保护的字段
val snapshotForReader = synchronized(lock) {
    Pair(items.toList(), selectedId)
}
// 接下来只使用这份副本，不再返回原对象读取第二个字段
```

如果读 selectedId 加一次锁、读 items 再加一次锁，W 仍能插在两次加锁之间。复制列表以后，还要确认列表元素本身不可变；`toList()` 不会深拷贝所有对象。锁可以解决一致读取，但参与者都必须遵守同一协议，持锁计算还会扩大等待时间。

第三种办法是把相关数据放进一个不可变对象，每次提交一整个值：

```kotlin
data class Favorites(
    val items: List<String>,
    val selectedId: String?
)

val favorites = mutableStateOf(Favorites(listOf("A", "B"), "A"))
// 修改时创建新值，而不改变旧值内部结构
favorites.value = Favorites(listOf("B"), "B")
// 读取一次，后续两项都从同一个对象取
val current = favorites.value
val selected = current.items.find { it == current.selectedId }
```

这里用了 MutableState 承载不可变值，以便继续接入 Compose；不可变聚合思想本身也能配合其他通知机制。列表只读接口并不保证深度不可变，本例使用不可变字符串且不保留可变列表别名。

为什么不把整个应用都收进一个大对象？可以做，但需要考虑状态拥有者、更新复制、依赖粒度，以及多个模块如何协作。持久化数据结构能降低复制成本，选择器也能缩小通知范围，因此不能简单宣称它一定慢。

Snapshot 提供另一组取舍：保留状态对象身份，在内部管理可见版本，让不同读取范围使用各自视图，再处理写入发布和观察。它付出版本维护、冲突处理和观察跟踪的成本。这里是基于行为的工程比较，**不是对 Compose 团队历史决策过程的猜测**。接下来用实际 API 看这组能力如何工作。

## 3. 同一个 State 在两个视图里读出不同的值

暂时把两个业务字段缩小成一个收藏计数。以下函数只依赖 `androidx.compose.runtime.mutableStateOf` 和 `androidx.compose.runtime.snapshots.Snapshot`：

```kotlin
fun readDifferentViews() {
    val count = mutableStateOf(10)
    val oldView = Snapshot.takeSnapshot()
    try {
        count.value = 20
        println(count.value)                  // 预期：20
        println(oldView.enter { count.value }) // 预期：10
        println(count.value)                  // 预期：20
    } finally {
        oldView.dispose()
    }
}
```

先逐步解释，而不是把 `takeSnapshot` 当成一种截图函数：

- 创建 count 时，它的初值为 10。创建 oldView 时，快照保留这个时点可见的状态视图。
- 在 `oldView.enter` 外赋值为 20，修改的是外部当前环境里的状态；旧快照的视图不会因此直接变成 20。
- `enter` 让代码块内的快照状态读取按 oldView 的可见性执行。它没有换一个 count 变量，也没有另起线程。
- 离开代码块后恢复原来的快照上下文，所以最后一次外部读取仍为 20。
- `dispose` 结束对旧视图的保留；它不是把全局值回滚成 10，也不是删除 count 对象。

为什么这里没有 `remember`？因为这个函数不在组合里重复创建状态，研究的是 Runtime 的值视图。`remember` 管对象在组合身份下的保留，Snapshot 管状态读写；二者不是同一层能力。两者的联系见 [State 第 3、12 节](#/article/compose-state?section=3)。

`takeSnapshot` 创建的是只读快照。若试图在它的 `enter` 中写入，会违反只读契约。要做隔离修改，需要下一节之后介绍的 MutableSnapshot。[Snapshot API：enter、takeSnapshot 与释放](https://developer.android.com/reference/kotlin/androidx/compose/runtime/snapshots/Snapshot)。

现在问题更具体了：同一个 count，怎么可能既保存 10 又保存 20？

## 4. 用 StateRecord 理解版本选择

如果 MutableState 只有一个普通字段 `value = 20`，旧值被覆盖以后，上面的旧快照就无从读出 10。实现需要把“这是哪个状态对象”和“这个状态的某个版本值”分开。

StateObject 表达状态的逻辑身份；StateRecord 保存参与快照机制的记录。对普通 MutableState，可以用下面的简化关系图理解：

```text
同一个状态对象 count
    ├─ 记录 R_new：值 20，带版本信息
    └─ 记录 R_old：值 10，带版本信息

外部当前视图 ──选择──> R_new
oldView      ──选择──> R_old
```

这是逻辑示意，不表示实现为每个快照完整复制所有状态，也不承诺每次写入都永久新建一条记录。记录可以在满足条件时复用；快照创建也不需要遍历应用的全部普通对象。

读取不是简单“取链表第一个节点”。它需要考虑当前快照的版本和无效版本集合，在该快照可见的记录中选择适当版本。可以先用职责伪代码理解：

```text
readValue(state, view):
    通知当前读取观察者：正在读取 state
    在 state 的记录中寻找对 view 可见的版本
    返回该记录中的值
```

版本号大小只是可见性判断的一部分。某个数值更大的记录，可能来自尚未对当前视图生效的其他修改；不能把“最新创建”当成“当前可读”。

把固定源码中的选择条件缩成下面的算法伪代码，省略线程重试、特殊版本与对象创建边界：

```text
candidate = 无
遍历记录链的每个 record：
  如果 record 的版本有效，且 record.id <= view.id，且不在 view.invalid：
    若 candidate 为空或 record.id 更大：candidate = record
返回 candidate；找不到时进入实现规定的重试 / 错误路径
```

用人为编号手算：记录版本为 4、7、9、11，当前视图上界为 10、无效集合包含 7。11 超过视图上界，7 被排除，4 与 9 可用，最终选择 9。若上界改为 8 而无效集合仍含 7，则选择 4。编号仅用于解释筛选条件，不是运行上节代码会打印出的真实版本。

为什么还要无效集合？某个较小编号可能属于创建当前视图时仍未对它生效的修改，单一“截止时间”无法表达这种空洞。固定源码的 `readable` 先尝试选择记录；在特定竞争条件下找不到时，会在同步保护下重新获取当前视图再读。这既解释了版本筛选，也说明不能把读路径概括成永远无锁、永远读取头节点。

写入也不能直接覆盖旧读者仍需要的记录。它要取得适合当前可写快照的记录，保存新值，并把对应状态列入修改集合。实现中的同步保护和记录复用属于必要细节，所以 **Snapshot 不能简单称作完全无锁系统**。

核对源码时，从 `SnapshotMutableStateImpl.value` 的 getter/setter 进入，再追 `readable` 与可写记录处理；不要先背内部字段位数。[固定提交中的状态实现](https://github.com/androidx/androidx/blob/b8f12c706099a47e1e44d9772d03e14a4ae37146/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SnapshotState.kt)、[快照与记录选择实现](https://github.com/androidx/androidx/blob/b8f12c706099a47e1e44d9772d03e14a4ae37146/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/snapshots/Snapshot.kt)。

这套表示解决了“不同读取范围看不同版本”。要让自己的修改先隔离、再一起发布，还需要明确的提交过程。

## 5. 在可变快照内修改，再显式提交

继续使用 count，但先不让修改对外生效：

```kotlin
fun stageThenApply() {
    val count = mutableStateOf(10)
    val edit = Snapshot.takeMutableSnapshot()
    try {
        edit.enter {
            count.value = 20
            check(count.value == 20)
        }
        check(count.value == 10) // 离开 enter 不等于提交
        edit.apply().check()    // 提交失败时抛出冲突异常
        check(count.value == 20)
    } finally {
        edit.dispose()
    }
}
```

`enter` 决定代码使用哪个视图；`apply` 尝试把该快照的修改应用到父快照，顶层快照则应用到全局。两个动作分开，调用者才能在发布前计算与检查，而不是一写就让其他视图看到半成品。

把这个过程还原成收藏业务：

```kotlin
val items = mutableStateOf(listOf("A", "B"))
val selectedId = mutableStateOf<String?>("A")

Snapshot.withMutableSnapshot {
    items.value = listOf("B")
    selectedId.value = "B"
}
```

`withMutableSnapshot` 封装创建、进入、尝试应用及释放。块不能挂起；提交可能失败，不能理解为系统自动无限重试。[可变快照的提交契约](https://developer.android.com/reference/kotlin/androidx/compose/runtime/snapshots/MutableSnapshot)、[withMutableSnapshot](https://developer.android.com/reference/kotlin/androidx/compose/runtime/snapshots/Snapshot)。

成组提交的意义是对外发布修改时不暴露“只提交一半”的结果。不过，若读者先在全局读 ID，再恰好跨过一次提交后读列表，它仍可能混用不同时间的数据。**写者原子发布与读者使用一致视图要配合**；前面的不可变聚合状态也能让读者通过一次读取抓住同一对象。

这个 API 只负责参与 Snapshot 的状态。普通对象字段、数据库事务和 HTTP 请求不会因此被纳入同一次提交。把网络扣款放进可重试块，可能重复扣款；这里的状态提交不能替代外部业务幂等。

## 6. 先确定什么算变化，再讨论提交冲突

现在把 20 再写成 20，是否需要让所有读者重新工作？对一个只显示计数的组件而言，没有新的可见结果。MutationPolicy 提供的 `equivalent` 就在表达这种等价关系。

```kotlin
data class Article(val id: String, val title: String)
val a = Article("A", "旧标题")
val b = Article("A", "旧标题")

val structural = mutableStateOf(a) // 默认结构相等策略
structural.value = b              // a == b，视为等价

val referential = mutableStateOf(a, referentialEqualityPolicy())
referential.value = b             // a !== b，不等价
```

这里需额外导入 `referentialEqualityPolicy`。对 data class，`==` 使用其 equals；`===` 判断是不是同一实例。结构相等策略适合把内容相同的新模型看作相同状态；引用策略适合确实以实例身份区分变化的场景。`neverEqualPolicy` 则始终认为赋值不等价，但不保证每次赋值都单独呈现一帧。

策略无法替普通字段补上观察入口。下面只有列表内部被改，外层 setter 没有被调用：

```kotlin
val rows = mutableStateOf(mutableListOf("A"))
rows.value.add("B")
```

即使改成永不相等策略，`add` 也不会自动变成对 rows.value 的赋值。应更换不可变列表，或使用可观察列表结构；完整推导见 [State 第 6 节](#/article/compose-state?section=6)。

等价关系还会参与两个快照结果的比较。为什么“相同写入可以接受”与“不同写入发生冲突”有关，接下来通过两个编辑者推演。[策略接口与标准策略源码](https://github.com/androidx/androidx/blob/b8f12c706099a47e1e44d9772d03e14a4ae37146/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SnapshotMutationPolicy.kt)。

## 7. 两个快照提交时，系统知道值却不知道意图

让 A、B 都从 count=0 开始，随后分别写入 1 和 2。以下依次执行，没有真实线程竞争，目的是隔离观察提交冲突：

```kotlin
fun conflictingWrites() {
    val count = mutableStateOf(0)
    val a = Snapshot.takeMutableSnapshot()
    val b = Snapshot.takeMutableSnapshot()
    try {
        a.enter { count.value = 1 }
        b.enter { count.value = 2 }
        a.apply().check()
        val resultB = b.apply()
        check(resultB is SnapshotApplyResult.Failure)
        check(count.value == 1)
    } finally {
        a.dispose()
        b.dispose()
    }
}
```

需导入 `SnapshotApplyResult`。在默认结构相等策略且无其他修改的前提下，B 的基线是 0，当前外部值为 1，B 自己想发布 2。直接覆盖会抹去 A 的结果；默认策略无法判断哪个业务意图更重要，因此失败是一个有意义的结果，调用者必须处理。

把三个值并排列出，合并接口的必要性就清楚了：

| previous：本次修改的基线 | current：外部当前结果 | applied：本次拟提交结果 | 默认结构相等策略下的解释 |
| --- | --- | --- | --- |
| 0 | 0 | 2 | 外部未对该状态形成冲突，发布本次结果 |
| 0 | 1 | 1 | 两方结果等价，可接受，结果仍是 1 |
| 0 | 1 | 2 | 两方都偏离基线且不等价，默认无法合并 |

这张表描述单个已存在状态的典型情形，记录身份、嵌套快照和特殊初始记录还由实现处理。固定源码的 `innerApplyLocked` 先为修改对象定位相关记录，必要时调用 `mergeRecords`；不能合并就返回 Failure。成功路径才推进可见性并通知 apply 观察者，观察者通知位于相关同步段之外，不是持锁递归刷新 UI。版本维护与状态消费因此仍是两步。

如果把 B 也改成写 1，两个结果等价，则不能期待最终变成 2。系统看到的是“把值设为 1”，不是可累加的操作日志“增加一次”。这也是两个隔离快照各做 `count++` 不自动等于正确并发计数的原因。

自定义 policy 可以提供 `merge(previous, current, applied)`。例如纯累计业务可根据各方相对 previous 的增量合并；但收藏布尔值、余额校验、库存扣减未必满足同一种代数规则。未经证明地给所有数值用加法合并，会保留数值却破坏业务。

更隐蔽的情况是两个快照修改不同 state：

```text
约束：A、B 至少一人值班；起初 A=true，B=true
快照 X：看到 B=true，所以把 A 改成 false
快照 Y：看到 A=true，所以把 B 改成 false
```

即使两个修改没有同一状态对象上的写冲突，也不能据此保证最终业务约束成立。Snapshot 不是任意跨对象事务的可串行化验证器。可将这个不变量放进同一聚合状态并设计冲突处理，或在业务层串行/加锁；外部权威库存仍由服务端事务负责。这里用的是反例推理，不是本文已运行的并发测试。

## 8. 从读取观察到实际依赖集合

版本与提交解决了值的可见性，UI 还有一个问题：这么多 state，哪些变化与当前界面有关？与其让每个组件手写订阅清单，不如在实际读取时记录对象身份。

可以先脱离 UI，观察两次读取了什么：

```kotlin
fun inspectReads() {
    val showPrice = mutableStateOf(true)
    val price = mutableStateOf(99)
    val placeholder = mutableStateOf(0)

    fun dependencies(): Set<Any> {
        val reads = mutableSetOf<Any>()
        val view = Snapshot.takeSnapshot(readObserver = { reads.add(it) })
        try {
            view.enter {
                if (showPrice.value) price.value else placeholder.value
            }
        } finally {
            view.dispose()
        }
        return reads
    }

    check(price in dependencies())
    showPrice.value = false
    val reads = dependencies()
    check(placeholder in reads)
    check(price !in reads)
}
```

第二次走了另一条分支，所以需要观察的对象变了。每次都把依赖加入一个永不清空的集合，会让历史上用过、现在已不用的数据持续影响这个消费者。

例子只展示读取观察，不是完整订阅器：它没有注册应用观察、安排回调、管理作用域或线程。完整观察系统还需要记录“哪个 scope 读了哪些对象”，在变更集合到来时找出相关 scope，并在下一次执行后更新依赖。

`SnapshotStateObserver.observeReads` 提供把观察范围与读取关联的机制，`start/stop/clear` 管理相应生命周期。不同 Compose 子系统不必通过完全相同的封装类订阅，不能将它说成所有 UI 更新唯一入口。[SnapshotStateObserver API](https://developer.android.com/reference/kotlin/androidx/compose/runtime/snapshots/SnapshotStateObserver)。

## 9. 把状态变化交给消费者，而不是直接刷新整页

假设页面只关心“收藏数是否大于 0”。count 从 3 变成 4，底层状态确实变了，派生的布尔结果却仍为 true。这里才有引入 `derivedStateOf` 的理由：把“输入发生变化”与“消费者关心的结果变化”区分开。

```kotlin
// Composable 中的片段；需导入 derivedStateOf、remember 和委托操作符
val hasFavorites by remember {
    derivedStateOf { count.value > 0 }
}
Text(if (hasFavorites) "已有收藏" else "暂无收藏")
```

派生状态仍需跟踪输入和有效性。它不是给任意表达式包一层就自动更快；如果输入和输出总是一起变化，跟踪成本可能没有换来收益。换分支后结果相同，也不能据此永久忽略依赖集合的变化。

从状态到画面，可以按职责串起来：

```text
State 写入/快照提交
    → 相关变更进入观察处理
    → 找到使用这些状态的作用范围
    → 消费者安排必要工作
        组合范围：由重组协调机制处理
        布局/绘制范围：进入对应阶段失效处理
```

Recomposer 在这里负责协调组合相关工作，不承担所有 StateRecord 选择，也不是每次赋值立即调用 Text。多次修改可能在处理前合并；中间值不一定逐一成为屏幕帧。详细调度、阶段读取和跳过见 [刷新与调度第 6、7 节](#/article/compose-phases?section=6)，本篇不把后续文章压缩成几个未经解释的函数名。

同样，`snapshotFlow` 把快照读取桥接成 Flow，它不是保存每次赋值的事件日志；与 `derivedStateOf` 的区别在 [副作用第 5 节](#/article/compose-effects?section=5) 展开。[派生状态实现入口](https://github.com/androidx/androidx/blob/b8f12c706099a47e1e44d9772d03e14a4ae37146/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/DerivedState.kt)。

## 10. 用一次小型 Spike 检验理解和选型

现在回到收藏页。若只需要维护列表与选中项，不必为了“用了高级机制”显式管理许多快照：不可变 Favorites 聚合状态可能就很清晰。学习 Snapshot 是为了解释 Compose 的状态语义，以及识别什么时候确实需要受控的一组状态修改。

可以按下面的顺序在自己的 Runtime 版本运行前面的独立函数，每次只改变一个条件：

| 实验 | 先预测什么 | 什么结果值得继续检查 |
| --- | --- | --- |
| oldView 建立后外部写 20 | 外部 20，旧视图 10 | 进入的视图、状态创建顺序或其他写入与预期不同 |
| 可变快照只 enter、不 apply | 外部仍为旧值 | 是否误在全局修改，或改了普通可变字段 |
| 两快照写不同值 | 后提交者可能冲突 | policy、父子关系或基线并非假设条件 |
| 两快照都写 1 | 不能解释成自动累计 2 | 是否把结果值与业务意图混淆 |
| 条件分支切换 | 实际读取集合发生变化 | 观察范围是否保留了过期依赖 |

再做一项反例：在状态容器里保存普通可变对象，直接修改其字段，检查它为何不满足前面的版本推理。机制的边界往往比正常路径更能检验理解。

最后检查资源：所有手动创建的快照都有 finally dispose；观察器在不再使用时停止并清理作用域；重试块不包含不可重复的外部操作。旧快照长期存活可能延长旧版本的保留，但不能由此推断每次存活必然复制整个应用堆。

本篇实验是验证设计，未宣称已执行。真正用于项目评审时，应记录 Runtime 版本、输入、预期与实际结果，再比较直接状态建模、串行化与显式快照的复杂度；不要把一个机制课题直接升级为整个应用的架构改造。

## 面试提炼

1. 只有一份可变状态时，怎样产生混合版本读取？串行化、锁和不可变聚合分别如何解决？（回看第 1、2 节）
2. 同一个 MutableState 为什么能在旧快照和外部读出不同值？StateObject 与 StateRecord 各负责什么？（回看第 3、4 节）
3. enter、apply、dispose 分别改变什么？原子提交为什么仍需与一致读取配合？（回看第 5 节）
4. 为什么两个快照各自加一不保证得到二？没有同对象写冲突是否足以保证业务不变量？（回看第 6、7 节）
5. 状态变化怎样找到消费者？读取观察、派生状态与 Recomposer 分别负责什么？（回看第 8、9 节）

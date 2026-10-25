## 阅读方式

本次补充：2026-10-25。先读前半篇建立概念，再读后半篇的具体推演、代码示意和验证方法。示例未在本网站执行 Android 编译或设备实验。

按定义、结构、运行过程、实现细节、故障与验证逐层阅读。问题顺序由本站编写；文末面经映射只证明相应主题被问过，不代表原帖出现了本篇全部追问。每问下方即为对应讲解。

## 第 1 问：Snapshot 是什么，StateRecord 保存了什么？

Snapshot 管理可观察状态的版本视图。一个 state 的逻辑值可以由多个 StateRecord 表示；读取时根据当前快照可见性选择记录。可变快照中的写入不应被理解为立即覆盖所有观察者正在读取的同一份全局值。这样才能对一组状态操作提供一致视图与受控提交。

这里讲的是 Compose Runtime 的状态快照，不是数据库 ACID 的完整替代，更不是 Android View 截图。普通对象的任意可变字段不会因处在 Snapshot 块里就自动得到这些能力；必须是参与该机制的可观察状态。

## 第 2 问：一次读、写和 apply 经历哪些阶段？

可以把流程抽象为：进入可变快照 → 读取当前可见记录 → 为写入得到可写记录 → 尝试 apply → 通知相关观察者。apply 可能发现从快照建立以来，父级或全局已有不兼容修改，从而需要合并或报告冲突。快照也有生命周期，不再使用时需要释放，避免长期保留版本资源。

Snapshot 的 readObserver 与 writeObserver 提供观察入口；Compose 利用状态读跟踪，把“读了哪个对象”与当前执行作用域联系起来。状态系统只知道数据修改，UI 层再把变化映射为组合、测量、放置或绘制失效。二者协作，但职责不同。

## 第 3 问：两个可变快照同时修改时怎样处理冲突？

假设两个独立可变快照都读到计数 0，各自执行加一得到 1。不能期望默认策略自动知道你想最终得到 2，因为系统看到的是状态值变化，不是业务意图“增加一次”。等价判断与 merge 策略影响最终处理；需要累计语义时，应选择明确支持它的合并策略或在更适当的并发边界串行更新。

即使单个 state 可安全参与快照，两项相互约束的数据也要考虑是否在同一可观察事务中修改。先改选中 ID、后改列表，若中间状态被观察，UI 就可能短暂不满足“选中项存在于列表”的不变量。不可变聚合状态或受控批量修改有助于维持这一关系。

## 第 4 问：mutation policy 怎样影响等价、变更与合并？

策略首先定义什么变化可视为等价，还可能参与冲突合并。结构相等、引用相等与永不相等策略适用场景不同。“永不相等”只是让写入更容易被当作变化，不会修复错误的数据所有权，反而可能增加无效工作。

derivedStateOf 用于派生可观察结果，在输入变化频繁而下游真正关心的结果变化较少时有价值。例如滚动位置每帧变化，但“是否显示返回顶部”只在阈值两侧切换。它本身有跟踪成本，不应替代所有普通字符串拼接或简单计算。

## 第 5 问：继续读源码时应追踪哪些记录与观察机制？

阅读时先找 Snapshot、MutableSnapshot、StateObject、StateRecord、SnapshotMutationPolicy 与 SnapshotStateObserver 的职责，再追调用。记录项目的 runtime 版本与源码 tag；不要把不断演进的 androidx-main 细节当作所有稳定版本的行为，也不要仅凭源码符号存在就声称项目已经使用它。

### 逐层追问与回答支点

- Snapshot 和 Recomposer 谁决定什么时候画？前者管理状态视图与通知，后者协调组合工作；最终绘制还受 UI 帧调度控制。
- 跨线程写入一定安全到业务层吗？状态框架能力不消除业务不变量、顺序与外部资源同步需求。
- 为什么 apply 失败不能直接忽略？丢弃失败会丢失用户意图，应重算、合并或明确失败策略。

## 第 6 问：怎样验证隔离视图、冲突与通知时序？

在隔离测试中创建两个可变快照修改同一 state，记录 apply 结果与不同 policy 的行为；再用两个关联 state 验证批量更新。以上是实验步骤，本知识库未声称已对你的依赖版本运行。

## 第 7 问：StateRecord 为什么需要版本选择，而不是一个全局 value？

设 S0 建立时 x=10，之后另一个修改把全局 x 变为 20。S0 内部若每次都直接读同一全局字段，就失去一致视图。参与 Snapshot 的状态保存带版本信息的记录；读取在当前快照可见性规则下选择可见记录，写入取得合适的可写记录，而不是无条件修改所有读者正在使用的那份值。

源码定位从 SnapshotMutableStateImpl 的 value getter/setter 开始，沿 readable、可写记录获取与策略判断进入 Snapshot 实现。StateObject 是逻辑状态身份，StateRecord 是其值版本，不要把每个记录当独立订阅对象。旧快照不释放会延长版本可访问性，资源生命周期同样重要。[状态实现入口](https://github.com/androidx/androidx/blob/androidx-main/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SnapshotState.kt)。入口链接为开发分支，实验须固定对应依赖版本。

## 第 8 问：冲突可以用一个确定的表格推演吗？

前提：两个顶层可变快照 A、B 在相同初始值 0 上创建，使用默认结构相等策略，无自定义 merge；先在各自快照内写入，再依次 apply。不是并发执行全局的普通 `count++`。

| A 写入 | B 写入 | A 成功应用后 B 的情况 |
| --- | --- | --- |
| 1 | 1 | 最终值等价，不应推断自动累计成 2 |
| 1 | 2 | 出现不兼容写入；无有效合并时 B 报告应用失败 |
| 只改 x | 只改独立 y | 无其他冲突时可分别应用；仍需检查 x/y 的业务不变量 |

这说明 Snapshot 保存的是状态变更，不记录业务操作“加一次”。若自定义累计合并，需要明确 previous/current/applied 的意义并证明适合业务，不能对任意对象做字段拼接。库存扣减还涉及外部权威数据，UI 合并无法替代服务端事务。[变更策略源码契约](https://github.com/androidx/androidx/blob/androidx-main/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SnapshotMutationPolicy.kt)。

## 第 9 问：读依赖为什么要随条件分支改变？

原创推演：`if (showPrice) price.value else placeholder.value`。本次执行实际读取 showPrice 和其中一个分支，观察者应记录实际路径。切换 showPrice 后重新执行，依赖集合随新路径调整；若永久保存曾读过的一切，会使已不使用的 price 更新继续造成无意义失效，甚至保留不必要引用。

跟踪读依赖与判定值相等是两件事。派生结果可能仍等于上次值，但其依赖来源已变，不能简单跳过依赖维护。派生状态本身的重新计算、观察范围失效以及最终消费者执行次数，也不是相同计数。验证时分别记录，避免由一次日志倒推整个算法。

## 第 10 问：为什么 Snapshot 不能替代所有锁或事务？

Snapshot 只管理接入它的状态记录，不管理文件句柄、数据库提交或普通对象内部字段。两个有关联的数据若在不同全局写入中暴露，仍可能破坏业务不变量；使用 MutableSnapshot 批量变更，也不保证外部请求失败时能回滚网络世界。

建议在隔离测试中明确创建、enter、apply 和 finally dispose 的顺序，记录 SnapshotApplyResult，而不是忽略失败。重试需要重读当前状态并重新计算，且被重试块不能包含不可重复外部副作用。随后用[阶段文章](#/article/compose-phases)理解观察者怎样把应用通知转成 UI 工作。

## 原理依据与适用边界

本文是结合机制与工程约束的原创讲解。官方资料用于核对机制，工程方案是可讨论的设计建议；文中的推演与实验步骤不是已运行的测试结果。实现细节应以项目锁定的依赖版本为准。

- [Snapshot API](https://developer.android.com/reference/kotlin/androidx/compose/runtime/snapshots/Snapshot)
- [MutableSnapshot API](https://developer.android.com/reference/kotlin/androidx/compose/runtime/snapshots/MutableSnapshot)
- [SnapshotMutationPolicy](https://developer.android.com/reference/kotlin/androidx/compose/runtime/SnapshotMutationPolicy)

## 为什么资深岗位需要掌握

本篇按岗位能力补充收录，不声称已在所收集面经中直接出现。面试准备应覆盖设计、故障恢复和长期维护，不能只围绕历史题目。

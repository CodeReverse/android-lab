## 1. 组合分组与 UI 节点

组合记录描述可组合调用、分组、remember 值和重启信息；LayoutNode 树描述参与测量与绘制的 UI 节点。一个可组合函数可以只组织逻辑，不产生布局节点，也可以产生多个节点。因此“编译器把每个 Composable 生成一个 View”从起点就不准确。

SlotTable 是经典 Runtime 实现中保存组合结构与槽位数据的结构。逻辑上有树形分组，存储上可以用扁平记录表达，并不是每个槽都 new 一棵对象树。官方设计说明中的 gap buffer 解释特定实现，文档本身也提醒实现持续演进；新版运行时还有结构替换实验，不能说所有版本都永远使用同一数组布局。

## 2. 首次组合与槽位记录

编译器在适当位置插入分组、参数比较、重启等调用。运行时 Composer 执行这些调用：进入 group，记录或复用 slot，遇到 UI 节点操作时经 Applier 等机制更新目标树，离开 group 后保留下一次组合需要的信息。remember 的缓存值就在对应组合身份的位置中关联保存。

例如父组件顺序调用两个相同的子组件，两处 remember 即使使用同样的函数与变量名，也应保存两份独立值。身份不仅来自函数名称，还与调用位置、执行顺序以及显式 key 等有关。

## 3. 首次组合的结构推演

以下为原创概念示例，不是编译器实际输出，G0 等标签只表示逻辑分组，不代表每个函数精确对应一个实际 group：

```text
Page(showFilter=true, ids=[A,B])
  G0 页面：remember 保存搜索框状态 Q
    G1 条件块：Filter（保存局部展开状态 F）
    G2 列表内容
      key(A)：Editor（保存草稿 DA）
      key(B)：Editor（保存草稿 DB）
    G3 Footer：remember 保存页脚状态 T
```

首次运行时编译后的协议使 Composer 按调用路径进入/退出组，在首次遇到记忆位置时计算并保存值；UI 内容还产生目标节点操作。Q/F/DA/DB/T 是不同身份下的值，不是全局按变量名查找。真实 Lazy 布局另有按需子组合，此图用普通 keyed 内容说明身份，不能拿图中的组数当 LazyColumn 源码结构。

## 4. 分支、循环与业务身份

假设列表依次显示 A、B、C，每项在内部 remember 一个输入草稿。若只依赖同一调用点下的执行顺序，在头部插入 X 后，位置发生变化，就可能出现草稿和业务项错配。稳定、唯一的业务 key 让运行时识别“B 仍是那个 B，只是移动了”，而不是把每个位置都当成新的业务身份。

key 不应使用每次随机生成的值，也不能在需要保留身份时用易变化的列表下标。重复 key 会破坏身份假设。即使 key 正确，业务模型不可观察地原地变化，仍可能不更新；身份与可观察性是两个独立条件。

## 5. 删除与插入时的身份保持

在概念图里把 showFilter 改为 false，运行时匹配条件结构，移除相应记录并安排遗忘/清理，Footer 的逻辑身份仍是 Footer。若把所有 remember 当一个无分组平面数组，删掉 F 后让 T 直接按旧序号读取，当然会错；编译器的控制流分组与 Runtime 的结构更新就是为维护这种关系服务。

再把 [A,B] 改为 [X,A,B]：按 key 匹配后，X 获得新草稿，A/B 的已有状态跟随身份保留；没有显式业务身份时，重复调用点下的顺序参与定位。随机 key 使每次都像新内容。普通条件移除后再次加入，不保证复原旧 F；确需保留则选择保存机制或更长寿命持有者，而非依赖内部槽位碰巧尚未回收。

## 6. 重组时的结构复用

Composer 对照已有分组与新执行路径，决定复用、插入、移除或移动记录，并处理失效作用域。分组被移除时，相关 remember 值会被遗忘，effect 需要按其契约清理。被跳过的组可以复用已有结果，但其中独立失效的工作仍需按 Runtime 规则处理，不能说“父节点跳过则所有后代永远不执行”。

SlotTable 并不是通用 Virtual DOM diff 的同义词。Compose 借助编译器提供的结构信息、位置记忆和状态读依赖来减少工作；理解这三者怎样配合，比简单回答“它也有 diff”更有说服力。

## 7. gap buffer 与 anchor

经典实现把分组元数据与值记录紧凑存放，用结构信息表达父子范围；gap buffer 在局部编辑处保留空隙，减少每次局部插入都搬动全部尾部数据的需要。逻辑索引与含空隙的物理地址不同；anchor 让结构移动时仍能定位相关位置。它们服务于组合记录维护，不是屏幕坐标。

成本推演：若编辑点集中，移动空隙可以摊薄连续插入成本；若在远隔位置频繁随机编辑，就可能增加搬移成本。不能从数据结构名称推出所有操作 O(1)。Runtime 发布说明另有 LinkTable 实验路线，应分别记录启用条件和实际实现；新旧共同契约是身份与记忆语义，而不是固定的数组字段布局。

## 8. 变更应用与资源清理

组合执行产生需要应用的变化；Applier 把节点插入、移除、移动等动作作用于目标结构，Runtime 因而不只服务 Android View。记录里的一个逻辑分组可能没有 UI 节点，移动或删除分组涉及的节点数量也不必是一。组合记录与目标树必须在应用过程中保持一致，但不应混为同一棵树。

成功应用、内容被遗忘、工作被放弃具有不同生命周期，RememberObserver 的相关回调体现这种区分；不要在 remember 的计算块里启动无法回收的外部资源。理解其语义后再读 DisposableEffect 的清理。源码导航：[Runtime 源码目录](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/)，按版本查 Composer、SlotTable、Applier、RememberObserver，本文未声称逐行验证全部开发分支。

## 9. 源码不变量与版本

先手画一个带 if 与列表的调用树，标明每个 remember 的逻辑身份；再查看编译结果中的 group 边界，最后对照锁定版本的 Composer/SlotTable 实现。关注“怎样找回同一位置”“怎样维持移动后的引用”“什么信息用于跳过”，而非先背所有字段位宽。

## 10. 列表重排的验证

创建带可编辑内容的列表，分别用下标和业务 ID 作为 key，执行头插、排序、删除再恢复，观察草稿归属与 effect 清理。随后固定 Runtime 与编译器版本读取生成代码，避免把概念伪代码当作逐字实现。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [官方组合机制设计说明（经典实现，注意文内版本警告）](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/runtime/design/how-compose-works.md)
- [可组合生命周期与 key](https://developer.android.com/develop/ui/compose/lifecycle)
- [Runtime 版本变化](https://developer.android.com/jetpack/androidx/releases/compose-runtime)

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. 组合结构、SlotTable 和 LayoutNode 树有什么区别？（回看第 1 节）
2. 首次组合怎样建立分组与 remember 记录？（回看第 2 节）
3. 重组时如何复用结构而不重建整个页面？（回看第 6 节）
4. 读 SlotTable 源码应先确认哪些不变量和版本？（回看第 9 节）
5. 怎样验证位置身份、列表重排与状态错位？（回看第 10 节）

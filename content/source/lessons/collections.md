## 1. 从一份购物车里分出不同的数据需求

购物车需要按商品 ID 找记录，也需要按加入顺序展示。只用 List，查找时可能逐个比较；只用普通 HashMap，则不能依赖它的遍历顺序。集合的选择首先取决于操作与不变量：按索引访问、查键、保序、去重、并发更新分别需要什么。

ArrayList 以数组保存引用，索引访问直接，尾部追加通常便宜但扩容会复制；中间插入要移动后续引用。LinkedList 能在已知节点位置修改链接，但找到第 n 项仍需遍历，而且每个节点有额外存储与访问成本。“链表插入 O(1)”没有包含查找位置，因此不能直接推出购物车应该用链表。

## 2. HashMap 怎样把一个键缩小到少量候选

哈希表先从 key 得到 hash，再定位桶，最后在桶中比较键。hash 相同不代表 key 相等；反过来，equals 相等的键必须满足 hashCode 相等，否则查找可能进入不同桶。

以 OpenJDK 21 的实现思路演算：容量 n 为 2 的幂，用混合后的 hash 与 `n - 1` 按位与定位。下面把 hash 混合步骤省略，直接给出混合后的低位，属于教学数值：

```text
容量 8，掩码 0111
h1 = 0011 → 桶 3
h2 = 1011 → 桶 3     两者冲突，桶内仍需比较 key
容量 16，掩码 1111
h1 = 0011 → 桶 3
h2 = 1011 → 桶 11    扩容后由新增的一位区分
```

这解释了扩容为什么能拆分某些冲突，也解释了糟糕 hash 为什么即使扩容也可能集中。树化用于缓解特定碰撞分布，不意味着所有查找恒为 O(1)。节点布局、树化阈值和 resize 路径是实现细节，不能泛化到所有 JVM 或 Android libcore；阅读时固定 [OpenJDK jdk-21+35 HashMap 源码](https://github.com/openjdk/jdk/blob/jdk-21%2B35/src/java.base/share/classes/java/util/HashMap.java)。

## 3. 键入表后变了，为什么会“丢失”

```kotlin
data class ProductKey(var id: Long)
val key = ProductKey(1)
val cart = hashMapOf(key to 2)
key.id = 2
val quantity = cart[key]
```

data class 生成的 equals/hashCode 包含主构造属性。入表时按 id=1 的 hash 定位；修改后查找按 id=2 计算，可能走另一个桶。entry 仍在表中，却不再按原来的定位规律被找到。即使偶然落在同一桶，也不能据此认为修改安全。

修复不是“重新遍历查一遍”，而是让键的等价关系在持有期间稳定，例如不可变商品 ID。若业务需要更名，改 value；若真要换键，按旧键移除再插入，并处理冲突。这个问题属于对象身份与数据结构契约，不是 HashMap 随机坏了。

## 4. 只读接口为什么还会看到内容改变

```kotlin
val mutable = mutableListOf("A")
val exposed: List<String> = mutable
mutable += "B"
// exposed 也能看到 B
```

List 只限制通过这个引用调用哪些操作，没有切断别名。浅拷贝 `toList()` 可隔开列表结构的后续修改，但如果元素本身可变，双方仍指向相同元素。需要可安全发布的 UI 快照时，要同时考虑容器和元素的可变性；这也是 StateFlow 使用新对象更新的重要前提。

不可变持久集合通过共享未改变的结构减少拷贝，不是把整个树每次复制；代价包括额外间接访问与实现复杂度。选择它应依据状态规模和更新模式，而非认为 Kotlin 的 List 已自动具备这一性质。类型契约见 [Kotlin 集合概览](https://kotlinlang.org/docs/collections-overview.html)。

## 5. 线程安全容器不能替代业务事务

把 HashMap 换成 ConcurrentHashMap 后，单次操作具有其契约中的线程安全保证，但 `if (!containsKey(k)) put(k,v)` 仍是两个操作。另一线程可以插在中间；需要单键原子操作时用 putIfAbsent/compute 等适当 API，并遵守回调约束。

如果规则是“扣库存并增加订单，两者同时成功”，它跨越多个值甚至数据库。单键 compute 不能自动保护全部不变量，需要更高层锁、事务或单一所有者。普通 HashMap 的 fail-fast 迭代也只是尽力发现结构修改，不是并发正确性的证明；未抛 ConcurrentModificationException 不代表安全。

可以设计一个可控交错：让两线程都读到缺失，再同时插入，验证业务初始化是否执行两次。测试要检查副作用次数和最终状态，不只检查表里剩几个键。详见 [Java 锁与复合不变量](#/article/java-locks?section=1)。

## 6. 根据负载做选择

对购物车分别记录查找次数、顺序展示次数、平均条目数与更新方式。若只有十几项，线性扫描的简单性可能更划算；若频繁按 ID 访问并要求插入顺序，可评估 LinkedHashMap。预分配减少扩容，但过大的容量会增加空间和遍历负担。

验证至少覆盖重复键、碰撞键、键变更、空值政策及并发复合操作。复杂度说明增长趋势，不能代替真实设备上的局部性、分配和负载测量。这里的演算不是性能排名；通用契约可查 [Java 21 HashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html)。

## 面试提炼

1. 为什么“链表插入快”不能直接指导容器选择？（第 1 节）
2. hash 定桶后为什么还要 equals，扩容怎样拆开冲突？（第 2 节）
3. 可变 key 为什么可能查不到自己？（第 3 节）
4. List、浅拷贝和深度不可变分别保证什么？（第 4 节）
5. 并发容器为什么保护不了跨键业务事务？（第 5、6 节）

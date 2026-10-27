## 1. HashMap 查找与复杂度

散列映射把 key 的 hash 分布到桶，桶内再比较相等性。平均查找效率依赖散列分布与容量；冲突过多会改变成本。JDK 某些实现使用链表与树化桶，但具体阈值、扩容迁移和树化条件属于版本实现，不应拿来当所有 Kotlin 平台的契约。

Android 运行库、桌面 JDK 和 Kotlin/Native 不是同一份实现。面试要求讲源码时，先说明观察版本，再解释为什么需要散列扰动、容量增长与冲突处理。背出数字但不能解释退化风险，不能证明理解。

## 2. key 的相等性和稳定性

如果一个对象被放入 map 后，参与 hashCode/equals 的字段改变，后续查找可能定位到不同桶，即使对象仍在集合内也找不到。data class 自动生成的方法不会消除这个问题：若关键字段可变，仍可破坏键稳定性。

equals 相等必须有一致的 hashCode；反过来 hash 相同不意味着对象相等。用可变集合做 key 也有类似风险。业务上优先使用稳定 ID 或不可变值对象，避免把整份可变 UI 模型作为缓存键。

## 3. 只读接口与不可变对象

Kotlin List 接口不暴露修改方法，但底层仍可能是被其他持有者修改的 MutableList。把 mutableListOf 赋给 List 引用，只限制当前引用的 API，并没有复制数据，也没有冻结对象图。toList 通常生成一个集合快照，但元素本身仍可能可变，属于浅层复制。

这对 StateFlow 与 Compose 很重要：把同一个可变对象反复发布可能使相等判断看不到变化；给它加 Immutable 注解也不会神奇地变不可变。可靠做法是明确状态所有权，更新时生成新的不可变状态，或使用框架支持的可观察容器。

## 4. fail-fast 与并发安全

HashMap 不是为无同步并发修改设计。ConcurrentModificationException 是错误检测机制的一种，不能把“没抛异常”当作线程安全。ConcurrentHashMap 支持并发操作，但复合动作仍需按 API 选择 compute/putIfAbsent 等方式，回调内还要避免不受控阻塞和递归更新。

集合选型也影响内存：小规模 Android key-value 可考虑平台提供的紧凑容器，代价可能是查询或插入成本变化。应按数据规模、读写比例和分配频率测量，不宣称一种集合永远优于另一种。

## 5. 扩容、冲突与别名验证

构造一个可变 key，插入后改变参与 hash 的字段，观察查找结果。再把可变列表暴露为只读接口并从原持有者修改，观察读取方变化。实验用于暴露所有权错误，而不是证明集合库有问题。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [Kotlin 集合概览](https://kotlinlang.org/docs/collections-overview.html)
- [HashMap API 契约](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html)
- [Kotlin data class](https://kotlinlang.org/docs/data-classes.html)

## 面经选题来源

原帖仅支持选题，不代表本文全部内容是公司原题，也不用于估算行业频率。

- [美团 Android 一面 · 2025-02-17](https://www.nowcoder.com/feed/main/detail/592247f523b64d45bb0dd5f28bdfaf56)：涉及 HashMap 实现、扩容与线程安全。

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. HashMap 怎样查找，平均 O(1) 依赖什么条件？（回看第 1 节）
2. key 的 equals/hashCode 为什么必须保持稳定？（回看第 2 节）
3. Kotlin 的只读集合为什么不等于不可变集合？（回看第 3 节）
4. fail-fast 为什么不能提供线程安全？（回看第 4 节）
5. 怎样验证扩容、冲突、别名与并发风险？（回看第 5 节）

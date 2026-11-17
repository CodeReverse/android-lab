## 1. 从一个停止标记看见数据竞争

后台循环做计算，主线程把 stop 改为 true，后台就一定停止吗？如果它是普通字段，且没有其他同步关系，不能仅凭源码顺序保证另一个线程何时观察到写入。

```java
class Worker {
    boolean stop;
    void run() { while (!stop) { computeOneStep(); } }
    void cancel() { stop = true; }
}
```

`computeOneStep` 是示意工作，假设内部也没有建立所需同步。编译优化、处理器执行和缓存机制都可能影响观察结果，但 JMM 不要求开发者逐台 CPU 模拟缓存刷新。它用语言级规则限定哪些执行结果合法。

这不是“每线程有一份真实内存副本，定时从栈同步到堆”的精确实现图。堆/栈讲存储职责，JMM 讲并发访问的语义约束。规范依据为 [JLS 21 第 17 章](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html)。

## 2. 用 happens-before 建立发布路径

把停止位改成 volatile 后，对同一 volatile 的相关写读建立规定的同步关系。更有价值的是用它发布之前的普通数据：

```java
class ResultBox {
    int answer;
    volatile boolean ready;
    void publish() { answer = 42; ready = true; }
    int read() { return ready ? answer : -1; }
}
```

假定只有一次发布，且读者观察到这次 ready=true，则可以沿关系推导：

```text
写 answer=42
  程序顺序 → volatile 写 ready=true
  同步关系 → 读者 volatile 读到 ready=true
  程序顺序 → 读 answer
```

传递性把 answer 的写与读联系起来。不是因为 answer 自己变成了 volatile，也不是因为“过了足够久”。解锁与后续对同一监视器的加锁、线程 start/join 等也有相应 happens-before 规则。

为什么示例强调一次发布？若反复修改 answer，而读者只看到早先的 ready=true，后续 answer 更新没有自动获得每轮一致快照。多字段反复更新应考虑锁、不可变对象整体发布或版本协议，不把一个永久 true 的标记当万能屏障。

## 3. 可见性不能把读改写变成一个动作

将计数器声明 volatile，两个线程各做一次 `count++`，仍可能得到 1：

```text
A 读 0             B 读 0
A 计算 1           B 计算 1
A 写 1             B 写 1
```

每次读写可以有可见性保证，但整个“读取—加一—写入”不是原子操作。`AtomicInteger.incrementAndGet()` 可以表达原子递增；如果业务还要同时修改库存与订单列表，一个原子计数也未必覆盖完整不变量。

```java
synchronized (lock) {
    if (stock > 0) {
        stock--;
        orders.add(order);
    }
}
```

所有相关访问者需要遵守同一保护协议，读者绕开锁仍可能观察不一致。加锁的对象身份也必须稳定：两个方法各 new 一个 lock，没有形成共享互斥。锁的获取、等待与 CAS 见 [锁原理](#/article/java-locks)。

## 4. 构造完成与安全发布要一起考虑

一个对象字段全是 final，会不会因此任意传给别人都安全？final 字段有特殊初始化语义，但前提包括正确构造，不应在构造未完成时让 this 逃逸；对象里后续仍可变的集合也不会自动线程安全。

```java
final class Snapshot {
    final int version;
    final List<String> rows;
    Snapshot(int version, List<String> rows) {
        this.version = version;
        this.rows = List.copyOf(rows);
    }
}
volatile Snapshot current = new Snapshot(0, List.of());
```

这里创建不可变内容，再整体替换 volatile 引用。读者先 `Snapshot s = current`，后面从 s 读两个字段，抓住的是同一个发布对象；若分别两次读取 current，恰好跨过更新，仍可能混用两个版本。

代价是复制或持久化结构维护；锁方案可以原地更新，但可能让读写等待。该选哪种，取决于数据大小、读写比例和不变量，而不是“无锁总比锁快”。

## 5. 从双重检查看重排序约束的用途

单例的双重检查常被背成模板，关键却在读者绕开锁时依赖什么：

```java
private static volatile Service instance;
static Service get() {
    Service result = instance;
    if (result == null) {
        synchronized (Service.class) {
            result = instance;
            if (result == null) instance = result = new Service();
        }
    }
    return result;
}
```

第一次检查减少已初始化后的加锁，锁内再检查防止两个线程都创建；volatile 引用承担相应发布与观察语义。不能把它删掉后，只因为测试了一万次没失败就判为正确。

更简单的替代是静态初始化持有者、枚举或显式依赖注入。复杂模板只有在需要相应延迟初始化边界时才值得维护。类初始化也可能阻塞或失败，不能把慢网络塞进去期待“单例初始化线程安全”解决全部启动问题。

## 6. 用允许结果与压力实验分别验证

并发测试失败可以证明存在问题，通过却未必证明所有交错都安全。先列出发布关系和不变量，再用压力工具寻找违例；不要依赖 println、sleep 等改变时序后偶然消失的现象。

可为 ready/answer 例子列出两类结果：读到 ready=false 时返回 −1；读到该次发布的 true 后应得到 42。多轮更新则重新设计版本边界。JDK 的 [jcstress](https://github.com/openjdk/jcstress) 用于并发结果实验，但不能替代规范推理。

Android 上还需区分 Java/Kotlin 内存语义与 JNI/C++ 自身的同步规则，不能认为一个 JVM volatile 自动保护所有 native 数据。本文未执行压力实验，所有时序都是用于判断合法性与反例的教学模型。

## 面试提炼

1. JMM 与 JVM 堆栈图各解释什么，普通停止标记缺少哪条关系？（回看第 1 节）
2. ready 如何发布 answer，为什么反复更新不能沿用一次发布的推理？（回看第 2 节）
3. volatile 为什么不能保证 count++ 或多字段不变量的原子性？（回看第 3 节）
4. 不可变对象、final 与 volatile 发布分别承担什么职责？（回看第 4、5 节）
5. 为什么并发压力测试通过仍需 happens-before 推理？（回看第 6 节）

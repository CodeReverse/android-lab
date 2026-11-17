## 1. 两端重复的是规则，未必是界面

Android 与 iOS 都要计算优惠资格，但两端 UI 已成熟且交互不同。若为了共享规则而重写两端页面，收益与成本不匹配。Kotlin Multiplatform 可以先共享领域规则、数据与部分基础设施，保留平台 UI；是否共享 UI 是另一项选择，不是使用 KMP 的前提。

```kotlin
// commonMain：纯领域规则，无 Android/iOS 类型
fun eligible(totalCents: Long, minimumCents: Long): Boolean =
    totalCents >= minimumCents
```

金额用整数最小货币单位是本例的建模选择，真实多币种与舍入规则还需独立处理。最容易共享的不是“所有 Kotlin 文件”，而是输入、输出和依赖都清楚的规则。源码集关系见 [跨平台共享代码](https://kotlinlang.org/docs/multiplatform/multiplatform-share-on-platforms.html)。

Compose Multiplatform 是在多平台上共享 Compose UI 的工具包，与 KMP 的逻辑共享层次不同。可以只用 KMP 保留 UIKit/Android UI，也可以再选择共享部分 UI；平台专有 API 和宿主互操作仍要处理。两者与 Jetpack Compose 的关系见 [JetBrains 官方说明](https://kotlinlang.org/docs/multiplatform/compose-multiplatform-and-jetpack-compose.html)。

## 2. 平台依赖怎样留在边缘

规则需要当前时间，直接调用 Android API 就把 commonMain 绑到单一平台。可通过接口注入：

```kotlin
interface Clock { fun nowMillis(): Long }
class OfferPolicy(private val clock: Clock) {
    fun active(expiresAt: Long) = clock.nowMillis() < expiresAt
}
```

测试可以传固定时钟；Android/iOS 分别提供实现。expect/actual 也能声明平台差异，但不必把每个依赖都写成它。普通接口适合运行时替换与测试，expect/actual 适合编译期平台实现关系；选择取决于变化轴，而非“跨端就必须 expect”。

若服务端时间才是业务权威，本地时钟只是展示辅助。共享代码能保证同样算法，不保证输入可信。API 语法与限制见 [Expected and actual declarations](https://kotlinlang.org/docs/multiplatform/multiplatform-expect-actual.html)。

## 3. 共享网络层以后还会遇到平台寿命

仓库返回 Flow，Android 可以按 ViewModel/Lifecycle 收集；Swift 侧仍要决定谁订阅、何时取消、错误怎样表示和结果在哪个线程更新 UI。导出 suspend 或 Flow 不自动替 iOS 建立完整生命周期。

```text
iOS 页面出现 → 创建订阅句柄
收到状态 → 切到 UI 所需上下文 → 更新当前页面
页面离开 → 取消句柄 → 上游资源按协议释放
```

这是跨语言契约示意，不代表某个互操作插件的固定 API。不同 Kotlin/Swift 导出方案的泛型、异常、异步映射能力不同，必须固定工具版本验证。不要在 commonMain 中隐藏一个永不取消的全局 scope，否则两端都可能泄漏同一类后台工作。

协程的取消原理见 [协程第 5 节](#/article/coroutines?section=5)；平台适配层负责把它接到具体生命周期，领域层不应引用 Activity 或 UIViewController。

## 4. Kotlin/Native 的内存不能按旧经验背诵

现代 Kotlin/Native 使用共享堆与追踪式 GC；旧内存模型里关于跨线程冻结的限制不能直接套到当前项目。另一方面，能跨线程访问不等于可以无同步地修改共享状态，数据竞争依然要治理。

与 Swift/Objective-C 互操作还跨越 GC 与 ARC 的边界。一个长期保存的回调可能间接保留另一侧对象，释放时机也不能用“Swift 引用计数为零就立即释放整张跨语言图”概括。机制与版本信息查 [Kotlin/Native 内存管理](https://kotlinlang.org/docs/native-memory-manager.html) 和 [ARC 集成](https://kotlinlang.org/docs/native-arc-integration.html)。

教学验证应反复创建/关闭订阅，观察两侧对象与任务是否结束；不要只测公共单元测试通过就认为平台资源没问题。

## 5. 代码复用率不是唯一决策指标

假设共享规则消除了两端折扣不一致，却让每次 iOS 构建和调试复杂很多。净收益需要同时计入规则一致性、交付节奏、平台能力接入、二进制与启动、故障定位和团队维护成本。

|方案|更直接的收益|需要承担的边界|
|---|---|---|
|独立原生实现|平台集成与独立演进直接|重复规则与一致性测试|
|KMP 共享逻辑|共用规则/数据，保留平台 UI|导出、构建、异步和资源生命周期|
|共享 UI 框架|进一步共享交互实现|渲染、设计差异、插件与宿主集成|

这是选择维度，不是固定优劣排名。公开 App 案例只能证明特定时间的特定采用，不能推测当前全量覆盖；需要应用案例时应回到项目已有的跨端来源清单，逐条确认日期和范围。

## 6. 用一个可撤回的模块完成技术试验

先选优惠规则或离线同步中的纯逻辑模块，保留平台适配接口和原实现。为两端运行相同输入输出契约，再增加取消、错误、并发与升级验证。若只共享了最简单函数，就不能据此推断复杂网络/数据库互操作同样无成本。

试验输出应写“已验证的范围、未覆盖的风险、继续/停止条件”，而不是一个复用百分比。本文示例为原创教学，没有宣称某公司实际迁移效果；决策记录写法见 [技术决策](#/article/technology-decisions)。

## 面试提炼

1. 为什么共享逻辑与共享 UI 要分开决策？（第 1 节）
2. 接口注入和 expect/actual 各适合什么边界？（第 2 节）
3. Flow/suspend 导出为什么还需要平台生命周期协议？（第 3 节）
4. 当前 Native 内存模型与旧冻结规则怎样区分？（第 4 节）
5. 怎样用可撤回试验评估真实收益？（第 5、6 节）

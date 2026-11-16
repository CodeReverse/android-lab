## 1. 从返回列表后收藏不同步推导状态所有权

列表打开文章 A，详情页收藏 A，再返回列表，列表却显示未收藏。最初的实现给两个页面各复制了一份完整 Article 对象；它们各自更新，并没有一个负责最终事实的所有者。这个问题与是否使用 MVI 无关，先要回答：哪份数据是事实，谁负责发布变化，谁只负责展示。

```text
仓储：文章与收藏事实
  ├─ 列表状态持有者：查询、排序、结果展示模型
  │    └─ 纯列表 UI：输入状态，输出 Open(id) / Toggle(id)
  └─ 详情状态持有者：目标 ID、加载与编辑状态
       └─ 纯详情 UI：输入状态，输出用户意图
```

详情收藏成功后更新仓储，列表重新观察到 A 的变化，两个页面不需要直接互调某个刷新函数。如果列表读取的是一次性快照而非持续观察，就还需要明确返回时刷新或失效策略；“用了 Repository”本身不会自动同步。

组件 API 可以先保持很小：

```kotlin
@Composable
fun ArticleScreen(
    state: ArticleScreenState,
    onToggleSaved: () -> Unit,
    onBack: () -> Unit,
) {
    // 只根据 state 展示；按钮调用外部回调。
}
```

`ArticleScreenState` 是页面自己的展示模型，不等于数据库实体。屏幕级 ViewModel 组织数据与用户操作，局部菜单开关可以由组件持有，跨页面下载任务则应交给符合业务寿命的任务层。全放 ViewModel 会让简单组件难复用；全放 remember 又会让离开组合时业务任务失去所有者。状态提升的公共原则见 [状态所有权](https://developer.android.com/develop/ui/compose/state-hoisting)。

## 2. 把导航参数缩到可以重新建立页面的身份

既然目标页面能从仓储取得当前事实，导航就不必携带一整份可能过期的文章。传入 ID 后，通知、深链接和列表点击都能进入同一加载路径。

本节选 **Navigation Compose 2.x 的类型安全路由**说明协议，需要支持相关 API 的版本（自 2.8.0 提供）及 Kotlin Serialization 插件。它不是 Navigation 3 示例，不应把两代的返回栈 API 混用。官方类型安全契约见 [Type safety](https://developer.android.com/guide/navigation/design/type-safety)。

```kotlin
@Serializable data object SearchRoute
@Serializable data class ArticleRoute(val id: String)

@Composable
fun ReaderNavigation() {
    val navController = rememberNavController()
    NavHost(navController, startDestination = SearchRoute) {
        composable<SearchRoute> {
            SearchScreen(onOpen = { id ->
                navController.navigate(ArticleRoute(id))
            })
        }
        composable<ArticleRoute> { entry ->
            val route = entry.toRoute<ArticleRoute>()
            ArticleRouteContent(
                articleId = route.id,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
```

其中 `SearchScreen` 与 `ArticleRouteContent` 是项目组件，后者负责把 ID 接到状态层，最终调用上一节的纯 UI。`@Serializable` 来自 kotlinx.serialization，`toRoute` 来自 Navigation；示例省略常规 import 和应用依赖配置。

类型安全减少参数名、类型与解析约定不一致，但只能证明结构合法。`id="deleted"` 仍可能指向已删除数据，外部链接也可能访问当前账号无权限的资源。状态层要区分加载中、存在、已删除和无权限，不能查不到就永久 Loading。

传完整对象是否永远错误？小型、不可变、明确属于路由语义的参数可以传，例如筛选条件或初始展示选项；问题在于把会变化的大业务事实当成导航真相。代价包括序列化体积、模型耦合、恢复兼容和过期数据。ID 方案增加一次查询，但可配合本地缓存，换来统一的数据来源与独立入口。

## 3. 用返回栈条目解释 ViewModel 的寿命

参数正确后，返回时搜索词是否保留仍取决于 owner。当前页面不可见、组合离开、返回栈条目移除，是三个不同事件。

```text
[L：搜索] → navigate A → [L：搜索, D1：文章 A]
再次打开 A（允许新条目） → [L, D1：A, D2：A]
pop D2 → [L, D1：A]
pop D1 → [L]
```

D1 与 D2 的业务 ID 相同，但它们可以是不同导航条目，拥有不同草稿或 UI 状态。不能直接用 articleId 代替导航实例身份。Navigation Compose 的目的地内容提供相应的 owner；如果在此范围获取默认作用域的 ViewModel，它通常属于该条目的 ViewModelStore。主动提升到父图或 Activity 则改变寿命，应明确记录原因。

打开 D1 后，L 可以仍在栈中而当前不可见；L 的组合局部状态能否恢复取决于保存机制，ViewModel 是否存活取决于 owner。弹出 D1 后，相关条目会按导航生命周期与过渡清理资源，不应仅凭动画画面消失就判断所有资源都已释放。旋转可能保留 owner 的 ViewModel；进程死亡则需要保存参数和可重建数据，不能指望原对象继续存在。

因此为每份状态写一行寿命说明很有用：查询属于 L；草稿属于 D1 或业务草稿仓储；文章事实属于仓储；短提示属于当前展示。账号切换时同时清理受账号约束的返回栈和缓存，避免返回键进入旧账号的详情。具体 back stack 契约见 [导航返回栈](https://developer.android.com/guide/navigation/backstack)。

## 4. 用失败窗口评审导航与提示事件

支付成功后跳到结果页，最容易写成：

```kotlin
// 反例：重执行可能重复导航。
if (state.paymentSucceeded) navController.navigate(ResultRoute(state.orderId))
```

组合函数执行不是提交业务动作的可靠时机。移到 `LaunchedEffect(event.id)` 可以给 UI 工作一个执行身份，但还没有解决进程中断和重复投递。

假设设计了一个带 ID 的待处理动作，处理伪代码为：

```text
观察 pendingNavigation(eventId, orderId)
检查当前目的地是否已经展示目标订单
需要时 navigate(Result(orderId))
记录 eventId 已处理
```

如果 navigate 后、记录前进程死亡，重建可能再次导航；如果先记录后 navigate，二者之间死亡可能丢失导航。它们不是一个跨系统原子事务，换成 Channel 也不会自动获得恰好一次语义。

可把重要事实建模成可恢复状态：订单已经成功是持久业务事实，恢复后根据订单状态和当前目的地协调展示；导航重复时保持幂等或采用明确的栈策略。`launchSingleTop` 只能处理特定栈顶重复场景，不能代替业务幂等，也不能自动解决栈中其他位置的重复。

轻量 Snackbar 可以有不同政策：页面离开后允许丢弃，避免返回时重放半小时前提示。把重要结果和暂时提示都塞入同一种 replay 配置，会同时带来丢失与重复。选型时先写允许丢什么、必须恢复什么、谁确认处理，再选 State、Flow、Channel 或带确认的队列。Effect 负责 UI 生命周期中的工作，进一步机制见 [副作用](#/article/compose-effects?section=1) 第 1、9 节。

## 5. 从单栏到双栏保持任务身份

窄窗口显示列表或详情，宽窗口同时显示两者。如果把两种布局写成两个完全独立的页面，窗口跨过阈值时可能重建详情持有者，正在编辑的草稿和请求一起消失。

先把“用户正在看 A”提升为当前任务的选择状态，再决定如何展示：

```text
任务状态：query、selectedArticleId、导航历史、必要草稿
窗口约束：窄 → 列表或详情其一
          宽 → 列表与详情同时出现
数据来源与选择身份不因展示方式变化而重建
```

具体布局可以依赖 WindowSizeClass 或自适应导航组件，但依据应是当前窗口可用空间，不是永久的“平板=true”。还要定义返回行为：宽屏选中详情后返回是清除选择、返回上个详情，还是离开任务？这是导航语义，不能仅靠 Row 变 Column 得到答案。

多窗口带来另一边界：两个 Activity 窗口可以浏览不同文章。收藏事实可共享仓储，但 selectedArticleId 若放全局单例，窗口一点击会改变窗口二。状态要区分应用/账号、任务/窗口、导航条目与局部组件；提升到“能共享”还不够，必须恰好满足希望共享的范围。

设计 Spike 时，在编辑中反复改变窗口宽度、折叠与展开，再同时打开两个窗口。检查 owner 身份、请求次数、草稿和返回路径，不能只比较宽窄两张截图。布局策略资料见 [自适应布局](https://developer.android.com/develop/ui/compose/layouts/adaptive)。

## 6. 让模块接口体现选择空间

现在把导航控制器直接传进公共 ArticleRow 会怎样？组件测试需要模拟导航，其他应用想复用时要接受同一套路由，设计系统还可能依赖具体业务模块。更窄的接口是 `onOpen(articleId)`：组件表达用户意图，集成层决定目的地。

```text
design-system：主题、通用组件、语义与视觉契约
feature-search：搜索状态、页面和 onOpen(id) 等出口
feature-detail：详情状态、页面和返回意图
app-navigation：连接 feature 出入口，选择路由与 owner
repository / domain：数据事实与必要业务规则
```

这是一种可评审的边界，不要求每个小项目都拆五个 Gradle module。模块化增加配置、接口维护和跨模块类型稳定性分析成本；只有团队职责、复用或构建隔离带来实际收益时才值得物理拆分。先分清代码依赖，再决定模块数量。

选择 Navigation 2、Navigation 3 或既有 Fragment 栈时，也应按 owner、保存恢复、自适应需求和迁移成本比较。Navigation 3 将更多返回栈管理表达为应用可持有的状态，API 与上面的 NavController 示例不同；具体方案见 [Navigation 3](https://developer.android.com/guide/navigation/navigation-3)，不能只替换依赖名称便假定迁移完成。

最后以同一验证矩阵评审架构：通知直达已删除文章、重复点击 A、详情收藏后返回、账号切换、进程恢复、双窗口和宽窄切换。每种输入都说明状态来源、owner 与预期栈变化，再决定是否增加抽象。技术决策的说服力来自这些边界能否解释，而不是架构名称。

## 面试提炼

1. 列表与详情收藏不同步时，如何找出重复的事实来源？（回看第 1 节）
2. 类型安全路由解决了什么，为什么仍需业务权限与存在性校验？（回看第 2 节）
3. 同一文章 ID 的两个返回栈条目为何可以有不同状态寿命？（回看第 3 节）
4. Effect 或 Channel 为什么不能单独保证导航恰好一次，应怎样评审失败窗口？（回看第 4 节）
5. 双栏、多窗口和模块化怎样改变状态所有权与接口设计？（回看第 5、6 节）

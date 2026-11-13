从一个文章收藏按钮开始：未收藏时显示“收藏”，点击后显示“已收藏”。随后把它扩展成两个组件共享状态，再接入 ViewModel、处理页面恢复，最后追到 State 的读写机制。

第 1–6 节建立使用模型，第 7–11 节处理真实页面，第 12–13 节深入实现与验证。代码用于讲解，省略项目配置；未在 Android 工程或设备上运行。Material 示例使用 Material 3，各依赖按项目版本对齐。

## 1. 从收藏按钮理解状态

这个按钮至少有一份会变化的数据：是否已收藏。按钮文字只是这份数据的显示结果。Compose 中可以把关系理解为 `UI = render(state)`：先确定当前状态，再由它描述当前界面。

下面是一种容易写出的实现。它能表达点击逻辑，却没有建立可观察的数据变化：

```kotlin
@Composable
fun BrokenBookmark() {
    var starred = false
    Button(onClick = { starred = !starred }) {
        Text(if (starred) "已收藏" else "收藏")
    }
}
```

点击会修改闭包捕获的普通变量，但这次修改不会向 Compose 发出状态变更通知。`Text` 不会因为一个任意 Kotlin 变量被赋值就自动得到新参数。假如函数因其他原因重新执行，局部变量又从 `false` 开始。

这里有两个独立问题：**如何让变化被观察，以及如何让同一个状态对象跨重组保留。** 前者由可观察状态解决，后者需要合适的状态持有者。先把这两件事分开，后面就容易理解 `mutableStateOf` 与 `remember` 的分工。

业务层的数据库、网络结果也可以是状态来源，不要求所有数据都放进 Compose 容器；UI 需要在读取边界接入可观察机制。[状态与组合](https://developer.android.com/develop/ui/compose/state)。

## 2. mutableStateOf 与属性委托

先给收藏标记一个可观察的容器。下面保留 `.value`，把真正发生读写的位置露出来：

```kotlin
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember

@Composable
fun Bookmark() {
    val starredState = remember { mutableStateOf(false) }
    Button(onClick = { starredState.value = !starredState.value }) {
        Text(if (starredState.value) "已收藏" else "收藏")
    }
}
```

`mutableStateOf(false)` 创建一个 `MutableState<Boolean>`。变量 `starredState` 是容器引用，`.value` 才是里面的布尔值。`val` 限制的是引用重新赋值，因此不妨碍修改容器的 `.value`。

`State<T>` 暴露只读的 `value`，`MutableState<T>` 还允许写入。这里的“只读”是接口能力：即使只拿到 `State<MutableList<T>>`，也不能因此断言里面的列表深度不可变。数据内容的可变性要单独设计。[State](https://developer.android.com/reference/kotlin/androidx/compose/runtime/State)、[MutableState](https://developer.android.com/reference/kotlin/androidx/compose/runtime/MutableState)。

同一段使用逻辑也可写为属性委托：

```kotlin
// 还需 import androidx.compose.runtime.getValue / setValue
var starred by remember { mutableStateOf(false) }
// 在组件内读 starred；在点击回调内执行 starred = !starred
```

此时读取 `starred` 会经过委托的 `getValue`，赋值会经过 `setValue`，最终仍落到状态容器的 `.value`。`by` 是 Kotlin 委托语法，既不创建线程，也不负责重组；省略它、显式读写 `.value` 完全可行。

普通变量也可以编译。是否报委托相关错误，取决于 `by` 右侧对象是否提供合适的操作符，而不是“变量不是 State 就不能声明”。[Kotlin 属性委托](https://kotlinlang.org/docs/delegated-properties.html)。

## 3. remember 保留的是对象身份

把刚才的状态创建改成下面这样：

```kotlin
@Composable
fun ResettingBookmark() {
    val starredState = mutableStateOf(false) // 故意省略 remember
    Button(onClick = { starredState.value = !starredState.value }) {
        Text(if (starredState.value) "已收藏" else "收藏")
    }
}
```

它仍创建了可观察状态；但当包含这行创建逻辑的函数重新执行时，会得到新的状态对象，初值又是 `false`。触发哪个作用域重启受编译结果与读取位置影响，因此不要把它描述成“任何重组都一定重置所有状态”。问题在于对象寿命没有被正确管理，工具也可能对此提示错误用法。

`remember` 在当前组合位置及身份有效时复用先前的计算结果。它不是以变量名为键的全局 Map，也不会自动观察普通对象的字段。可以用三种写法分别检查能力：

| 写法 | 内容变化能否被 Compose 观察 | 创建位置再次执行时 |
| --- | --- | --- |
| 普通局部变量 | 赋值本身不会通知 | 重新初始化 |
| `remember { 普通可变对象 }` | 普通字段变化仍不会通知 | 在相同身份下复用对象 |
| `remember { mutableStateOf(...) }` | 状态值的有效变化可被观察 | 在相同身份下复用状态对象 |

离开组合后，普通 `remember` 不承诺继续保留；重新进入同一业务页面，也不等于恢复原来的组合实例。反过来，若状态已由 ViewModel 等外部持有者管理，UI 不应再用 `remember` 创建一份业务状态副本。[组合身份与生命周期](https://developer.android.com/develop/ui/compose/lifecycle)。

## 4. 一次点击如何变成界面变化

现在沿修正后的按钮走一遍。首次执行时，组合读取 `starredState.value` 来决定文字；Compose 会在相应观察范围内记录这次读取。点击回调把值从 `false` 写成 `true`，状态系统处理变化，依赖它的工作随后被安排更新。

```text
首次读取 false → 当前范围建立读依赖 → 显示“收藏”
点击写入 true → 判断变化 → 通知依赖范围失效
调度执行必要工作 → 读取 true → 提交界面更新
```

这张图是职责流程，不是某个版本的完整调用栈。真正执行多少函数、哪些子调用可以跳过，要结合编译生成的重启范围、参数以及实际读依赖；状态对象本身没有直接调用某个 Text 的“刷新方法”。

**读取位置决定依赖落在哪一类工作上。** 在组合期间读取颜色并传给组件，可能使组合范围失效；若在绘制回调中才读取对应状态，则可以让变化只影响绘制。布局中的读取同样由对应阶段跟踪。不能从“修改了 State”直接推出“整页重新组合并绘制”。[Compose 阶段](https://developer.android.com/develop/ui/compose/phases)。

此外，默认的结构相等策略会把相等值视为等价。连续把 `true` 写回同一个 `true`，不意味着需要产生两次新画面。多个变化也可能在显示前被协调处理。更底层的版本记录和通知机制放在第 12 节讨论。

## 5. 从有状态按钮到共享状态

目前 `Bookmark` 自己保存收藏标记，属于有状态组件。需求增加：页面标题和底部按钮都要展示同一篇文章的收藏状态。如果它们各自维护一个布尔值，就出现了两份可能不一致的事实。

先让按钮只接收当前值和更新事件：

```kotlin
@Composable
fun BookmarkButton(
    starred: Boolean,
    onStarChange: (Boolean) -> Unit
) {
    Button(onClick = { onStarChange(!starred) }) {
        Text(if (starred) "已收藏" else "收藏")
    }
}

@Composable
fun ArticleScreen() {
    var starred by remember { mutableStateOf(false) }
    Column {
        Text(if (starred) "文章已加入收藏" else "文章尚未收藏")
        BookmarkButton(starred, onStarChange = { starred = it })
        BookmarkButton(starred, onStarChange = { starred = it })
    }
}
```

这里需引入 `Column` 和委托操作符。两个按钮没有各自复制状态：点击任何一个，事件交给 `ArticleScreen`；所有者修改唯一的状态，标题和按钮再读取一致的结果。数据向下传递，事件向上反馈，形成单向数据流。

这就是状态提升：把状态移到能够协调所有读写方的合适所有者。仅在一个气泡内部使用的临时展开标记，可以留在组件中；涉及仓储更新、业务校验或页面级协调时，所有者可能是 ViewModel，而不只是 UI 树里的父函数。

“无状态”是相对于这份输入而言。它不意味着组件及内部库实现绝对没有任何临时状态。对外暴露值与事件后，可单独传入 `true` 检查展示，也可记录回调，验证点击是否提出预期变更。[状态提升原则](https://developer.android.com/develop/ui/compose/state-hoisting)。

## 6. 集合更新必须穿过可观察边界

把收藏按钮扩展为收藏列表时，常见问题是列表已经改了，界面却没变：

```kotlin
// 在 Composable 内创建；假设 rows 用于渲染列表
var rows by remember { mutableStateOf(mutableListOf("文章 A")) }
// 错误对照：在点击回调里执行
rows.add("文章 B")
```

这里改的是普通列表内部结构，没有调用外层 `MutableState.value` 的 setter。即使之后再把同一个列表赋回去，等价判断也未必把它视为新值；`by` 不会拦截对象内部的每个方法。

一种做法是使用按值替换的列表：

```kotlin
var rows by remember { mutableStateOf(listOf("文章 A")) }
// 在点击回调里执行，形成新列表并经过状态赋值
rows = rows + "文章 B"
```

另一种是让列表结构本身可观察：

```kotlin
val rows = remember { mutableStateListOf("文章 A") }
// 在点击回调里执行，变更由 SnapshotStateList 管理
rows.add("文章 B")
```

两种方式的共同点是让变化经过可观察机制。后者也不会把元素的任意字段变成可观察字段。如果元素是 `data class Row(var starred: Boolean)`，直接修改 `rows[0].starred` 仍需额外设计。更容易推演的方式是不可变元素配合替换，或明确让元素属性自身成为状态。列表很大时，再根据更新频率与性能证据选择结构。[集合可观察性说明](https://developer.android.com/develop/ui/compose/state)。

## 7. 把 ViewModel 和其他数据源接到 UI

收藏最终属于业务数据时，UI 只负责提出变更意图。下面的内存版 ViewModel 展示接口划分，真实收藏还需接入仓储、失败处理和持久化：

```kotlin
data class BookmarkUiState(val starred: Boolean = false)

class BookmarkViewModel : ViewModel() {
    private val _state = MutableStateFlow(BookmarkUiState())
    val state: StateFlow<BookmarkUiState> = _state.asStateFlow()

    fun setStarred(value: Boolean) {
        _state.update { current -> current.copy(starred = value) }
    }
}

@Composable
fun BookmarkRoute(model: BookmarkViewModel) {
    val state by model.state.collectAsStateWithLifecycle()
    BookmarkButton(state.starred, model::setStarred)
}
```

这里需引入 Lifecycle 的 `ViewModel`、`collectAsStateWithLifecycle`，以及 `kotlinx.coroutines.flow` 中的相关类型和操作符。Route 接收已有 ViewModel；宿主负责提供正确作用域，不能在每次组合时手动 `BookmarkViewModel()`。

`StateFlow` 保留最新状态，`collectAsStateWithLifecycle` 负责把收集结果桥接成 Compose 可观察状态。业务层可以独立于 UI；只读的 `StateFlow` 接口限制外部赋值，但不等于把所有载荷自动深拷贝成不可变对象。

Android 页面通常使用生命周期感知的桥接。默认活跃阈值为 `STARTED`；低于阈值时暂停当前收集。普通 `collectAsState` 与组合生命周期绑定，却不自动等同于按 Android `STARTED/STOPPED` 控制收集。**消费者停止，也不保证生产者停止**：应用作用域中的热流可能继续生产，上游是否停止取决于作用域、订阅者与共享策略。

已有项目还可能使用其他数据源，不必为了接入 Compose 立即重写全部业务：

| 输入 | 常用桥接 | 对应依赖 |
| --- | --- | --- |
| Android 页面中的 Flow / StateFlow | `collectAsStateWithLifecycle()` | `androidx.lifecycle:lifecycle-runtime-compose` |
| 与平台生命周期无关的 Flow 收集 | `collectAsState()` | Compose Runtime |
| LiveData | `observeAsState()` | `androidx.compose.runtime:runtime-livedata` |
| RxJava 3 Observable 等支持类型 | `subscribeAsState()` | `androidx.compose.runtime:runtime-rxjava3` |

例如 `val starred by liveData.observeAsState(false)`，或 `val starred by observable.subscribeAsState(initial = false)`，都把来源接成 Compose State。各桥接需要相应 import 与依赖。RxJava 的错误、重订阅和是否重放最新值仍由流设计决定；桥接不会自动给 `PublishSubject` 增加状态存储能力。也不要把 Observable 的桥接称为 `collectAsState`。[各数据源的集成契约](https://developer.android.com/develop/ui/compose/state)。

## 8. 区分重组保留、重建恢复和持久化

现在加入文章搜索框。输入一半后旋转屏幕，用户希望搜索词还在。普通 `remember` 保留的是当前组合中的对象，Activity 重建后通常会重新建立组合，不能靠它恢复原输入。

```kotlin
@Composable
fun ArticleQuery() {
    var query by rememberSaveable { mutableStateOf("") }
    TextField(value = query, onValueChange = { query = it })
}
```

这里需引入 `androidx.compose.runtime.saveable.rememberSaveable` 和 Material 3 `TextField`。搜索词是可保存的简单值，可以参与保存状态恢复。它适合“恢复用户操作所需的少量输入”，而不适合保存整个网络结果、图片或请求句柄。

| 机制 | 主要解决的问题 | 不应据此假设的能力 |
| --- | --- | --- |
| `remember` | 同一组合身份中的重组保留 | 自动跨 Activity / 进程重建 |
| `rememberSaveable` | 可保存 UI 状态在受支持重建中的恢复 | 任意退出后永久保留，或存放大对象 |
| ViewModel | 在其作用域内持有页面状态，跨配置变化 | 对象本身跨进程死亡继续存活 |
| SavedStateHandle | 恢复 ViewModel 所需的少量输入 | 替代业务数据库 |
| 数据库或文件 | 按产品要求持久保存业务数据 | 自动解决 UI 生命周期与并发一致性 |

系统保存状态的前提和任务恢复路径很重要。用户主动移除任务等退出方式，不能一概按系统回收后的恢复处理。真正的收藏记录或未提交长草稿应进入持久存储。恢复搜索词后重新查询，通常比把整个结果列表装入保存状态更合适。[保存 UI 状态](https://developer.android.com/develop/ui/compose/state-saving)。

## 9. 自定义 Saver 与保存边界

假设搜索页不仅有文本，还可以“只看收藏”。先把它建模为一个小值对象，再定义其保存表示：

```kotlin
data class ArticleFilter(val query: String, val starredOnly: Boolean)

val ArticleFilterSaver = listSaver<ArticleFilter, Any>(
    save = { listOf(it.query, it.starredOnly) },
    restore = { ArticleFilter(it[0] as String, it[1] as Boolean) }
)

// 位于 Composable 内；引入 saveable.listSaver / rememberSaveable
var filter by rememberSaveable(stateSaver = ArticleFilterSaver) {
    mutableStateOf(ArticleFilter("", false))
}
```

`save` 把领域值变成可保存的少量基本值，`restore` 把这些值重建为对象。这里使用 `stateSaver`，因为初始化返回的是 `MutableState<ArticleFilter>`，自定义规则针对它包裹的 `ArticleFilter`。改变筛选项时应赋一个新的 `filter.copy(...)`。

这个示例假设保存结构没有跨版本变化。正式代码还需要定义旧表示不兼容时的默认值或迁移方式；不要把索引和强制类型转换当作无条件安全的通用反序列化。

另外两个名字解决不同层面的问题：`SaveableStateHolder` 可按身份保存离开组合的子内容中的可保存状态，适合需要稍后恢复的子树；`SavedStateHandle` 则是 ViewModel 的保存状态入口。前者需要清理永久移除项，后者适合存 ID、搜索词等重建线索。它们都不能因为名称含有 State 就互相替换。[保存 API 的选择](https://developer.android.com/develop/ui/compose/state-saving)。

## 10. 计算 key 与组合身份

从文章 A 切换到文章 B 时，临时草稿不应无条件沿用 A 的内容。下面的 key 用于控制一个记忆值何时重新计算：

```kotlin
var draft by remember(articleId) { mutableStateOf("") }
```

在当前位置，`articleId` 改变会让这次记忆计算重新进行。它表达的是缓存计算的输入关系，不会把 A 的草稿自动存进可随时取回的全局字典。切回 A 若要找回旧草稿，还需设计相应持有者或持久存储。

列表中的身份则作用于一块组合内容：

```kotlin
// 概念片段：ArticleEditor 是业务组件，articles 的 ID 在同组内唯一
Column {
    for (article in articles) {
        key(article.id) { ArticleEditor(article) }
    }
}
```

当 A、B 变成 B、A，业务身份可帮助内部状态和副作用继续跟随对应项目，而不是仅按旧位置对应。Lazy 列表通常使用 `items(..., key = { it.id })`。key 不要求整个应用全局唯一，但要在它用于区分的调用集合中满足身份要求。

如果使用经常变化的标题作为身份，标题更新就可能被解释为另一个项目，从而重建临时状态。**计算是否失效、内容是否是同一项、状态是否需要恢复，是三个不同决策。** 更细的分组和存储机制见[组合结构](#/article/compose-slots)与[生命周期说明](https://developer.android.com/develop/ui/compose/lifecycle)。

## 11. 用搜索收藏页确定状态归属

把前面的零件放回同一个页面，可以先列出下面的归属表，再写组件代码。这样能避免 UI、ViewModel 和数据库各保存一份可独立修改的“真相”。

| 数据 | 建议权威来源 | 重建时的策略 |
| --- | --- | --- |
| 搜索词、只看收藏 | 页面状态所有者 | 用可保存状态或 SavedStateHandle 恢复少量输入 |
| 收藏记录 | 业务仓储 | 从持久数据重建，处理写入失败 |
| 当前查询结果 | 仓储与页面状态层 | 按筛选重新查询，必要时展示缓存 |
| 行内临时展开 | 组件或按 ID 的 UI 状态 | 按产品要求决定是否保留 |
| 滚动位置 | 列表状态持有者 | 恢复位置，并处理数据变化后的锚点 |
| 未提交长草稿 | 草稿仓储 | 持久化，不依赖 Bundle 承载全文 |

一种执行过程是：输入变化 → 页面所有者更新筛选 → 仓储产生结果 → Route 收集 → 无状态组件显示。收藏点击也先进入所有者，再更新仓储；请求失败时由状态模型表达失败或回退，不能让按钮在本地“成功”后与业务数据永久分离。

这里只确定职责，不声称某一种 MVVM 类划分适合所有项目。小页面可以从局部状态开始；当多个组件需要协调，或恢复、业务规则变复杂时，再把状态与逻辑提升到合适的位置。[所有者选择](https://developer.android.com/develop/ui/compose/state-hoisting)。

## 12. 沿状态读写深入 Runtime

前面使用的是 API 契约。继续深入时，应把“保存对象”“读取值”“观察变化”“执行 UI 工作”拆开。`remember` 解决对象在组合中的保留；状态值的读写由 Snapshot 体系管理；组合观察与调度把变化转成相应工作。

下面是阅读源码时的职责导图，不是可编译代码，也不是逐字源码：

```text
mutableStateOf(initial, policy)
  → 创建平台对应的 SnapshotMutableState 实现

读取 value
  → 根据当前快照选择可见 StateRecord
  → 经过读观察机制，使使用方可记录依赖

写入 value
  → 用 policy 比较当前值与目标值
  → 不等价时按快照规则取得可写记录并更新
  → 在相应提交、应用和通知过程中传播变化

UI 观察方
  → 标记有关范围失效 → 调度必要工作 → 应用变更
```

一个逻辑 State 不必只有一份供所有快照直接覆盖的全局值。`StateRecord` 承载值的版本；可变快照中的写入还涉及应用与冲突，不能把“写入记录”直接等同于“所有观察者已看到最终结果”。本篇核对的 [SnapshotState.kt 固定提交](https://github.com/androidx/androidx/blob/7ac433e44e797de53af85226797862687f37735f/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SnapshotState.kt) 中，值读取、等价判断和记录写入是不同步骤；该提交是阅读基线，不宣称与你的依赖版本一致。

默认 `structuralEqualityPolicy` 按结构相等判断等价；`referentialEqualityPolicy` 关注引用身份，`neverEqualPolicy` 不把两次值判为等价。这些策略影响变更与快照合并语义，不会修复错误的状态所有权。尤其普通列表被原地修改而没有走 setter 时，改 policy 也不会凭空观察那次内部操作。

业务上的“加一次”“保存到服务器”也不是 Snapshot 自动理解的意图。两个快照各把 0 写为 1，不能假定最终自动累计成 2；文件写入、网络提交更不属于 UI 快照事务。到这里再继续读 [Snapshot](#/article/compose-snapshot)、[重组阶段](#/article/compose-phases) 和[编译器](#/article/compose-compiler)，每个底层机制都有对应的上层行为可供核对。

## 13. 用对照验证理解

理解 State 不只看一个按钮能否点击。下面每个对照只改一个因素，便于把现象对应到机制；它们是验证设计，尚未执行。

| 对照 | 应观察的内容 | 能验证的判断 |
| --- | --- | --- |
| 普通变量 / 记忆的普通对象 / 记忆的 State | 点击结果，以及额外触发创建位置执行后的结果 | 可观察性与对象保留相互独立 |
| `list.add` / 新列表赋值 / SnapshotStateList 变更 | 列表条目是否更新、实际改动经过哪里 | 变化是否穿过观察边界 |
| 单个按钮自持状态 / 提升后共享状态 | 两个按钮及标题是否一致，事件传给谁 | 状态所有权与单向数据流 |
| 页面旋转 / 受支持的系统进程重建 / 主动移除任务 | 小输入和持久数据各如何恢复 | 不能用一次旋转代替所有恢复测试 |
| 停止 UI 收集但让生产者继续运行 | 订阅数量与生产任务是否仍活跃 | 消费生命周期不等于生产生命周期 |
| 组合读取 / 绘制回调读取同一状态 | 触发的工作阶段与实际帧成本 | 函数执行次数不等于画面刷新次数 |

记录 Kotlin/Compiler、Runtime、Lifecycle 与设备版本，先写预期，再采集日志或工具结果。不要在 Composable 主体中直接递增可观察计数器来“统计重组”，这会改变正在观察的行为。日志也只是线索；性能结论还需对应 trace 或基准测试。

## 原理资料与阅读边界

官方资料核验于 2026-11-13。示例为本篇原创教学片段，未完成 Android 编译和设备验证；源码细节需按实际依赖版本复核。

- [State 与数据源桥接](https://developer.android.com/develop/ui/compose/state)：可观察状态及 Flow、LiveData、RxJava 的接入。
- [状态提升](https://developer.android.com/develop/ui/compose/state-hoisting)：UI 状态与业务状态的所有者。
- [保存 UI 状态](https://developer.android.com/develop/ui/compose/state-saving)：恢复用途、保存容量与持久化边界。
- [属性委托](https://kotlinlang.org/docs/delegated-properties.html)：`by` 的语言语义。
- [组合生命周期](https://developer.android.com/develop/ui/compose/lifecycle)：身份、重排与状态复用。
- [Compose 阶段](https://developer.android.com/develop/ui/compose/phases)：读取位置与失效工作。
- [固定提交的 SnapshotState.kt](https://github.com/androidx/androidx/blob/7ac433e44e797de53af85226797862687f37735f/compose/runtime/runtime/src/commonMain/kotlin/androidx/compose/runtime/SnapshotState.kt)：API 到状态记录的实现入口。

写作节奏参考用户指定的[掘金范文](https://juejin.cn/post/7399530589987504128)：借鉴从例子递进解释的方式，未转载其正文或代码；技术结论以本文列出的官方依据为准。

## 面经选题来源

[MetaApp 原帖](https://www.nowcoder.com/feed/main/detail/ffabbdfbab1a49c0a8a1c99b7d121535)用于 State 与 Compose 选题。它不证明本文全部细节都在面试中出现，也不支持行业频率推断。

## 面试提炼

以下是本站的复习提问，重点在解释执行过程与边界，答案已在正文展开。

1. `mutableStateOf`、`remember` 与 `by` 分别做什么？去掉其中一个，会在哪个条件下表现不同？（回看第 2 节、第 3 节）
2. 一次 State 写入为何不一定立即重组整页？读依赖、等价策略和快照记录分别参与什么？（回看第 4 节、第 12 节）
3. 两个组件共享收藏状态时应把状态放在哪里？为什么普通列表原地修改容易造成显示不一致？（回看第 5 节、第 6 节）
4. UI 停止收集 Flow 后，上游是否继续运行？LiveData、RxJava 接入 Compose 时还需要哪些语义保证？（回看第 7 节）
5. 如何为搜索词、收藏记录和长草稿选择恢复方式，并区分计算 key、组合身份与持久化？（回看第 8 节、第 9 节、第 10 节、第 11 节）

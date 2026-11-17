## 1. 旋转后消失的搜索词先属于谁

搜索页包含查询词、结果列表、滚动位置和已提交订单。旋转后都丢了，最直接的补救是全部放进 ViewModel。但这个修复只覆盖配置变化中保留实例的路径；进程被系统回收后，ViewModel 对象本身也不存在。

先按恢复成本和业务寿命分层：查询词是小的页面输入，适合保存状态；结果可根据查询重建；滚动位置是轻量展示线索；订单是业务事实，应持久化。分类不是为使用更多 API，而是避免把几十 MB 列表和真正不能丢的交易都交给同一个 Bundle。

## 2. 重建过程其实是重新计算界面

可以把页面理解为 `UI = render(query, results, position)`。重建时先恢复 query，再加载 results，结果可用后尝试恢复 position；列表改变时位置还需要按稳定 ID 校正，不能盲信旧索引。

```kotlin
class SearchViewModel(
    private val savedState: SavedStateHandle,
    private val repository: Repository
) : ViewModel() {
    val query = savedState.getStateFlow("query", "")
    fun setQuery(value: String) { savedState["query"] = value }
}
```

Repository 是业务占位，此处刻意只保存输入，没有把整个结果列表塞入 savedState。ViewModel 承担屏幕状态所有权，SavedStateHandle 提供符合系统恢复契约的小数据载体；查询到结果的取消和流转换另见 [Flow](#/article/flow-state)。

为什么不在每次 onCreate 都清空 query？它会覆盖恢复值。初始化应区分“确实没有历史值”与“恢复到了空字符串”，不能把空输入一概视为首次进入。

## 3. 配置变化与进程死亡不是同一测试

|情形|对象发生什么|恢复依据|
|---|---|---|
|配置变化导致重建|旧 UI 被销毁，符合范围的 ViewModel 可保留|ViewModel + 已保存 UI 状态|
|系统回收后台进程后恢复任务|所有进程内对象消失|已保存的轻量状态 + 持久数据|
|用户结束任务或主动结束流程|不应假定旧任务状态继续可恢复|产品明确需要保留的持久数据|

系统保存状态并不是每次赋值立即落盘的数据库事务；宿主生命周期和任务栈影响保存与恢复。支付结果不能只放 SavedStateHandle。官方边界见 [保存 UI 状态](https://developer.android.com/topic/libraries/architecture/saving-states) 和 [SavedStateHandle](https://developer.android.com/topic/libraries/architecture/viewmodel/viewmodel-savedstate)。

“开发者选项不保留活动”主要制造 Activity 重建，不能替代杀后台进程后的恢复测试。强行停止应用也不等价于系统回收后恢复原任务。测试必须标明制造了哪种路径。

## 4. Fragment 活着不代表它的 View 活着

进入详情再返回时，Fragment 实例与它的视图生命周期可能不同。若旧 binding 被字段长期持有，或收集任务在 Fragment 生命周期里一直更新旧 View，会把页面重建和引用保留混在一起。

```kotlin
viewLifecycleOwner.lifecycleScope.launch {
    viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.uiState.collect { state -> render(state) }
    }
}
```

示例应在视图创建完成后注册，render 使用当前视图。视图销毁时，相关收集与 View 引用应结束；Fragment 继续存在不意味着 binding 应继续存在。repeatOnLifecycle 会按状态取消并重新收集，故上游必须能够安全重订阅，不能把 collect 等同于一次性下单。机制依据 [Fragment 生命周期](https://developer.android.com/guide/fragments/lifecycle)。

## 5. 恢复到旧输入还需要校验新世界

应用在后台时账号可能退出、商品可能下架、深链参数可能过期。恢复的是上次的意图和位置，不是保证外部世界未变。恢复商品 ID 后应重新检查权限和最新可用状态；恢复提交中的订单则查询稳定操作 ID 的结果，避免重新发起一次无幂等保护的提交。

因此保存状态可采用“小输入 + 稳定身份”，业务数据采用本地数据库/服务端事实，耗时任务交给与任务寿命相符的所有者。完整的持久任务与重试协议见 [离线数据第 3 节](#/article/offline-data?section=3)。

## 6. 用一张恢复矩阵检查遗漏

为搜索词、滚动位置、加载中、错误提示和已提交订单分别写下预期：旋转要保留什么，后台回收要重建什么，退出账号要清除什么。每一格都指向一个具体所有者和载体，而不是统一写“ViewModel”。

验证可以先输入查询，切后台回收进程，再从原任务恢复；另测回退到旧 Fragment、账号切换与结果变更。记录实际回调、恢复输入、网络次数和订单操作 ID。本文给出方案，未声明设备实验结果。能够解释一次恢复为何正确，比完整背诵生命周期方法顺序更接近工程能力。

## 面试提炼

1. ViewModel 为什么不能独自解决进程死亡？（第 1–3 节）
2. 为什么恢复输入通常比保存整个结果列表更合适？（第 2 节）
3. Fragment 与 View 生命周期不同会造成什么问题？（第 4 节）
4. 恢复后的外部数据和账号变化怎样处理？（第 5 节）
5. 哪些测试分别覆盖配置变化、进程回收和用户结束任务？（第 3、6 节）

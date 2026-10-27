## 1. UI 描述与外部副作用

根据参数计算应显示什么，可以看作界面描述；修改外部系统、发网络请求、注册监听或导航，则改变了组合之外的世界。组合执行可能重复或被放弃，因此需要明确副作用何时启动、何时重启、谁负责取消和清理，而不能把函数被调用一次当成业务只执行一次的保证。

## 2. LaunchedEffect 的任务生命周期

组合可能重复执行、跳过，某些工作也可能被放弃。直接在函数体里注册监听、发起请求或导航，会让副作用次数跟着执行细节走。应区分“根据状态描述 UI”和“在受控生命周期中操作外部世界”。

LaunchedEffect 在进入组合时启动协程，key 变化时取消旧任务再启动新任务，离开组合时取消。key 应表达这项工作的身份，例如当前用户 ID；不能为了“只跑一次”永远传 Unit，却在内部读取会变化且应重启的查询条件。

## 3. Effect key 与最新回调

一个等待后调用 onTimeout 的 effect，可能希望计时不中断，但调用最新回调。如果把回调做 key，回调身份变化会重启计时；如果完全忽略变化，又可能捕获旧回调。rememberUpdatedState 用于让已有长期工作访问最新值，解决的是“更新捕获值而不重启”的特定需求。

它不能替代真正需要重启的身份变化。例如账号切换后继续沿用旧账号的任务，只把结果回调更新为新页面，可能造成跨账号污染。是否重启应由业务语义决定，不由减少启动次数决定。

## 4. 监听注册与配对清理

DisposableEffect 适合注册外部监听，并在 key 改变或离开组合时清理。注册的 owner 应参与身份判断，解绑要对应原先注册的那个实例。SideEffect 则适合在成功组合后把最新状态同步给非 Compose 对象，不能在其中执行长时间阻塞任务。

rememberCoroutineScope 适合从点击等事件启动与该组合位置关联的协程；它和 LaunchedEffect 的触发语义不同。无论选哪一种，取消都需要底层工作协作，资源释放不能只期待一个 Job 状态变化。

## 5. 状态桥接 API 的数据方向

| 工具 | 数据方向 | 典型需求 | 不应误用为 |
| --- | --- | --- | --- |
| produceState | 外部异步源 → Compose State | 订阅外部传感器并显示最新值 | 任意任务的永久后台作用域 |
| snapshotFlow | Snapshot 状态读取 → Flow | 观察滚动位置作过滤/统计 | 保证每次赋值都到达的事件队列 |
| derivedStateOf | 状态依赖 → 派生状态 | 高变化输入到低变化结果 | 所有简单表达式的必需包装 |

produceState 的生产协程与组合及 keys 关联，非挂起订阅可配合 awaitDispose 清理。snapshotFlow 在收集时跟踪块内快照读取，相关状态变化后重算，结果按相等规则发射；计算块应无副作用，不在里面写状态。derivedStateOf 没有把任意昂贵计算搬到后台线程。[副作用资料](https://developer.android.com/develop/ui/compose/side-effects)。

## 6. 搜索防抖与过期结果

原创时序：t0 输入 A，t1 输入 AB，t2 AB 请求先返回，t3 A 请求迟到。即使已取消 A，也要考虑传输或回调不协作的情况；提交结果前校验账号、query 或请求代次。取消降低无效工作，身份校验防止无效结果成为当前状态，两者互补。

建议屏幕状态层统一处理查询与请求，组合层只提交输入和展示结果。防抖减少触发频率，distinct 去除连续等价查询，latest 类操作取消上一任务，但并不自动给予服务端“没执行”的保证。异常处理应区分取消与真实失败，不吞掉 CancellationException 再把取消显示为错误。若搜索需跨配置变化持续，作用域应与该需求一致。

## 7. 外部监听的完整生命周期

用 owner 作为 DisposableEffect 的身份，注册时保存本次监听对象，onDispose 解绑同一 owner 上的同一对象。回调仅需更新时可通过 rememberUpdatedState 读取最新业务处理；若 owner 或账号改变，必须解绑旧注册再绑定新目标。不要只更新回调却保留旧账号订阅。

验证设计：owner A→B→离开，期望 A 注册/解绑一次，B 注册/解绑一次；回调函数改变但 owner 不变，期望不重复注册且调用新逻辑。SideEffect 的基础无 key 形式适合成功应用组合后的同步，不能承担耗时阻塞；较新有 key 重载按所用 Runtime 版本另查，不能把其语义套到所有版本。

## 8. 混合 UI 的生命周期

AndroidView 的 factory 用于创建 View，update 根据状态更新已有 View，不应在 update 中无限重复注册监听或创建昂贵对象。需要复用或释放时按对应 API 的契约处理。旧 View 内部回调也应指向当前业务状态，而不是永久捕获初次组合的参数。

ComposeView 放在 Fragment 中，需要让 Composition 的释放策略匹配宿主 View 生命周期；在池化或复用容器中又要考虑对应策略。不要把 Activity 销毁作为所有嵌入式组合的唯一释放时间。

## 9. 业务去重与恰好一次的边界

Effect 与组合身份关联，页面重新进入可能再次启动；进程可在请求提交后、记录结果前终止。UI 端缺少原子跨系统提交能力，所以付款、发送等动作需要业务幂等键、持久结果与恢复查询。把 key 固定为 Unit 不会产生分布式事务。

点击发起的 Snackbar 可用 rememberCoroutineScope，必须跨页面完成的上传应由业务任务层接管。技术分析要说清：谁发起、谁拥有、何时取消、是否允许重复、失败怎样恢复。这比罗列 Effect 名字更能暴露真实设计能力。

## 10. 取消、重入与释放验证

写一个可切换 owner 的监听组件，记录注册和解绑次数；模拟导航离开、返回、key 变化和回调更新。断言同一 owner 没有重复监听，旧 owner 已清理，长期计时使用新回调且不会误串账号。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [Compose effect 官方契约](https://developer.android.com/develop/ui/compose/side-effects)
- [在 Compose 中使用 View](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/views-in-compose)
- [在 View 中使用 Compose](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/compose-in-views)

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. 什么叫副作用？它和计算 UI 有什么区别？（回看第 1 节）
2. LaunchedEffect 何时启动、取消和重启？（回看第 2 节）
3. 搜索防抖、取消与过期结果怎样串起来？（回看第 6 节）
4. 为什么 Effect 不能保证业务“恰好执行一次”？（回看第 9 节）
5. 怎样验证重入、取消、释放与重复执行？（回看第 10 节）

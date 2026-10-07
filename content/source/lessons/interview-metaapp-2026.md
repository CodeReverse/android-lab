## 原帖范围与答案性质

来源：[原帖](https://www.nowcoder.com/feed/main/detail/ffabbdfbab1a49c0a8a1c99b7d121535)。MetaApp · 2026-07-01 · Android 一面；原帖未注明职级。题目按原帖顺序做简短语义转述，不复制整篇面经，也不补造候选人的回答。原帖中的子问题在对应题中展开。下面的参考答案、推演与继续追问由本知识库编写，不是该公司官方答案；资深深度是编辑扩展，不代表原面试已追问到此。

2026-07-01 为原帖标题中的面试日期，页面显示 07-02 发布/编辑。

个人项目题只给回答方法，不编造经历。术语不明确时保留歧义；算法约束不明时不强行绑定 LeetCode 编号。

## 1. MVVM 怎样降低界面与业务耦合？

原帖位置：第 1 项。

### 参考回答

View 渲染状态并上报事件，ViewModel 组织页面状态与业务调用，数据层封装来源和规则。收益在于状态所有权清晰、平台 UI 依赖减少和规则可测试；不是把所有逻辑搬进一个超大 ViewModel。Repository 对 UI 暴露统一数据入口。

### 原理与继续追问（编辑扩展）

继续追问时说明一条点击到状态更新的路径，谁处理并发、取消与错误。长期数据归数据层，页面临时状态不必全部全局化。单向数据流可以减少隐式修改，却不要求每个简单页面都引入庞大框架。把测试可替换边界与实际缺陷减少作为证据。

继续学习：[架构与边界](#/article/architecture-evolution) · [测试策略](#/article/testing-strategy)

## 2. 本地优先读取与网络刷新怎样协作？

原帖位置：第 2 项及数据流/并行子问题。

### 参考回答

一种可解释方案是 UI 观察 ViewModel 的状态流，Repository 从本地库提供读流，同时由明确业务触发发起网络刷新。网络响应在事务中写库，数据库观察流再更新 UI。首次缓存读取与网络刷新可并行，但它们输出不能无条件各自覆盖同一个状态。

### 原理与继续追问（编辑扩展）

例如本地已有版本 12，旧请求返回版本 11，应按服务端版本或请求代次拒绝倒退。刷新失败保留可用缓存并标记陈旧/错误，不能清空后假装首次加载。分页键和实体需保持一致，账号切换要取消或隔离旧任务。面试官问“并行在哪里”时，说清负责 scope、Dispatcher、资源限制与取消归属，而非只回答用了 async。

继续学习：[数据流与事务](#/article/offline-data) · [Flow 语义](#/article/flow-state) · [并发归属](#/article/coroutines)

## 3. 为何选 MMKV，和 SharedPreferences 有哪些实质差异？

原帖位置：第 3 项。

### 参考回答

SharedPreferences 提供键值接口，常见实现以 XML 文件持久化；commit 同步写盘并返回结果，apply 先更新内存再安排磁盘工作，不能因此认为它完全没有生命周期等待风险。MMKV 使用 mmap 和编码后的键值数据，并有增量写与整理等设计，适合评估频繁小键值操作场景。

### 原理与继续追问（编辑扩展）

mmap 是文件页映射，不等于所有写入立即持久到稳定介质，也不能笼统承诺断电绝不丢失；须查版本的同步、校验与多进程语义。选型还应比较 DataStore 的异步、事务式更新与迁移支持，复杂关联数据则考虑 Room。真实理由应包括性能实测、跨端/多进程需求、迁移与依赖成本，不复述未在自己场景验证的跑分。

继续学习：[选型证据](#/article/technology-decisions) · [持久一致性](#/article/offline-data)

## 4. Compose 什么情况下重组，怎样减少无效工作？

原帖位置：第 4 项。

### 参考回答

组合阶段读取的可观察状态变化会使相关作用域失效；父级重新执行也可能走到子调用，再由生成的检查和 Runtime 判断是否跳过。State 的等价策略影响是否形成变化，普通对象原地修改可能没有通知。重组、重新布局和重绘不是同一个计数。

### 原理与继续追问（编辑扩展）

先修正状态所有权与可观察性，再看读取位置、稳定身份、派生状态和昂贵计算。把仅影响位置的读取放进支持的放置 lambda，可减少组合工作。强跳过默认和比较规则与 Kotlin/插件版本有关；乱加 Stable 会破坏语义。最后用 release-like 场景的帧时间验证，而不是以重组次数最低作为唯一目标。

继续学习：[State 链路](#/article/compose-state) · [Snapshot](#/article/compose-snapshot) · [编译与跳过](#/article/compose-compiler) · [刷新阶段](#/article/compose-phases)

## 5. 生命周期和窗口焦点是同一个概念吗？

原帖位置：第 5 项及焦点追问。

### 参考回答

不是。Activity 生命周期描述组件状态，窗口焦点描述输入目标。一个 Dialog 可能让宿主窗口失去焦点，却不让宿主 Activity 经历同样的 pause/stop；多窗口下也不能把 resumed 简单等同唯一可见页面。应分别使用生命周期和窗口焦点回调处理相应需求。

### 原理与继续追问（编辑扩展）

普通页面创建到可交互经过 onCreate/onStart/onResume，离开前台可能 onPause/onStop，但具体窗口条件决定是否仍可见。视频、相机、监听和数据收集各有资源语义，不能以一个“失焦”事件全部永久停止。进程终止时 onDestroy 不可靠，关键状态应及时持久化。

继续学习：[组件状态与恢复](#/article/state-restoration)

## 6. 普通弹窗、透明 Activity 与页面传值如何区分？

原帖位置：第 6 项及页面传值子问题。

### 参考回答

同一 Activity 上的普通 Dialog 通常不引起宿主 Activity 的完整生命周期切换，但可能影响焦点；透明 Activity 是另一个 Activity，常使下面页面 paused 而仍可见，因此未必 stopped。必须先澄清“弹窗”实现。跨页面参数优先传稳定 ID 和少量可保存信息，结果用明确结果 API。

### 原理与继续追问（编辑扩展）

Fragment Result、共享 ViewModel 与 Activity Result 的作用域和用途不同。传整个大对象会遇到体积、版本与进程恢复问题，全局单例又可能串账号。验证时覆盖 Dialog、DialogFragment、透明/不透明 Activity、多窗口和系统权限 UI，不能用一个平台版本上的日志序列代表全部窗口类型。

继续学习：[生命周期与通信](#/article/state-restoration) · [传输体积边界](#/article/binder)

## 原理依据与适用边界

本文是结合机制与工程约束的原创讲解。官方资料用于核对机制，工程方案是可讨论的设计建议；文中的推演与实验步骤不是已运行的测试结果。实现细节应以项目锁定的依赖版本为准。

- [MMKV 设计（历史机制说明，版本行为须另核对）](https://github.com/Tencent/MMKV/wiki/design)
- [SharedPreferences API](https://developer.android.com/reference/android/content/SharedPreferences)
- [DataStore](https://developer.android.com/topic/libraries/architecture/datastore)
- [Compose phases](https://developer.android.com/develop/ui/compose/phases)
- [强跳过](https://developer.android.com/develop/ui/compose/performance/stability/strongskipping)

## 面经如何映射到本篇

下列原帖只证明曾考察相应主题，不证明本文答案，也不代表该公司所有团队或资深岗位的统一要求。样本不足以计算行业频率。

- [MetaApp原帖](https://www.nowcoder.com/feed/main/detail/ffabbdfbab1a49c0a8a1c99b7d121535)：本页按原帖题序逐项对应，所有新增追问均为编辑扩展。

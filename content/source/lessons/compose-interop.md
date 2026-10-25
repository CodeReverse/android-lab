## 阅读方式与讨论边界

阶段 10 的互操作与迁移正文。以旧 Fragment 搜索页逐步接入 Compose 为案例，讨论生命周期、复用、模块、回滚和成果证据。本文是方案推演，不是某公司的迁移成绩；资料核验：2026-10-25。

## 第 1 问：什么时候选 ComposeView，什么时候选 AndroidView？

宿主是 View/Fragment、局部接入 Compose，用 ComposeView；主体已是 Compose、仍需要旧 View 组件，用 AndroidView。选择取决于谁拥有页面与生命周期，不能只按代码量判断。迁移还包含输入、无障碍、恢复和性能，不是把 XML 逐行翻译成函数。

例如稳定的地图组件先保留 AndroidView 接入，搜索栏和结果空态迁为 Compose；若页面由复杂 Fragment 返回栈管理，先保留导航边界。这样能控制单次验证范围，但会付出双体系主题、焦点与生命周期协调成本。

## 第 2 问：Fragment 中的 ComposeView 应在何时释放组合？

Fragment 对象与其 View 生命周期不同，返回栈中 Fragment 还在，旧 View 却可能已销毁。组合的释放策略应跟随正确的宿主边界；在典型 Fragment View 场景可使用 DisposeOnViewTreeLifecycleDestroyed，使清理关联视图树生命周期。默认策略与池化容器行为按所用版本查证，不机械认为所有 detach 都必须立刻销毁。

多个 ComposeView 若参与保存状态，需要有可区分、稳定的 View ID；否则恢复归属可能出错。实验设计：进入页面、离开使 View 销毁、返回重建，记录 effect 解绑与恢复数据，检查旧 View 是否仍被监听器持有。[Compose in Views](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/compose-in-views)。

## 第 3 问：AndroidView 的 factory 与 update 分别保证什么？

factory 创建 View，update 把当前 Compose 状态同步到已有 View。不要在 update 每次注册一个新监听或重新构造播放器；监听需要有明确替换/解绑规则，回调也应读取当前业务身份。不要在组合外随意记住一份 View，然后让多个宿主争用它。

更新搜索文字可能触发旧 View 的 TextWatcher，再回写 Compose 状态，形成反馈回路。对写入做必要的值比较、区分用户输入与程序同步，并保持唯一真相源。循环产生的重复事件属于互操作协议错误，不能靠 debounce 无限掩盖。[Views in Compose](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis/views-in-compose)。

## 第 4 问：Lazy 中复用旧 View，什么必须重置，什么必须释放？

按支持复用的 AndroidView 重载契约处理 onReset/onRelease。重置用于让对象安全绑定另一项数据：清除旧选择、取消旧图片或回调关联；最终释放用于结束长期资源。不能把复用中的“暂时不可见”与“彻底销毁”当同一状态。

原创推演：视频行 A 滚出后对象复用于 B，若只改标题而未清理播放会话与回调，A 的进度会写入 B。资源归属要包含 item ID 与当前绑定代次，迟到回调先验证身份。究竟复用是否划算，还要比较重置成本、资源峰值和正确性风险。

## 第 5 问：迁移为什么要先定义边界和回滚？

选择页面级迁移、组件级迁移或设计系统先行，都要列出现有约束：发布节奏、共享组件、团队熟悉度、性能基线与设备覆盖。页面级边界易于灰度，但一次改动较大；组件级更渐进，却可能长期维护互操作层。没有“资深项目必须全量 Compose”的前提。

推荐选一个可比较、有代表性但不承担不可逆关键动作的试点，固定业务接口，保留切换旧实现的路径。回滚不应破坏已保存数据格式或深链接契约；功能开关切换时也要避免同时保留两个竞争的任务生产者。

## 第 6 问：升级与团队治理要留下哪些证据？

记录版本矩阵、组件 API 责任人、性能预算和测试门槛；把编译器配置、Runtime、主题与导航升级分开归因。检查源码/二进制兼容、构建时间及依赖扩散，而不只验证一个示例页面能编译。跨团队推广需要使用文档、弃用计划和迁移支持成本。

成果报告应写清个人实际决策、备选方案、代码与评审证据、基线和测量条件、失败尝试及收益边界。学习项目可展示推演和验证设计，不能把预期写成线上收益。结合[项目证据文章](#/article/project-evidence)整理自己的真实案例。

## 可执行的验收顺序与资料

先测输入、焦点、返回栈和恢复，再测生命周期清理、旧 View 复用和异常场景，最后在同条件下对比启动、滚动、内存与包体。任何一步出现业务错误，都不能以“帧率更高”抵消。

- [迁移策略](https://developer.android.com/develop/ui/compose/migrate/strategy)：按页面和组件边界设计渐进路径。
- [架构演进](#/article/architecture-evolution)、[Compose 测试](#/article/compose-testing)、[性能治理](#/article/compose-performance)：分别补齐回滚、正确性和测量。

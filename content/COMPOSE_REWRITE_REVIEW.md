# Compose 教程重写与事实核对记录

> 本文记录 2026-11-16 的 Compose 批次。其后 53 篇其他分类文章的重写与 AI 入门扩充已完成，见 [2026-11-17 核对记录](REWRITE_REVIEW.md)。

日期：2026-11-16。范围：保留已经确认的 `compose-state`，重写其他 15 篇 Compose 正文。其余 53 篇学习文章未在本轮按新标准重新验收；7 篇明确面经不改写成学习正文。

## 本轮逐篇阅读检查

以下记录指出教学过程的位置，供后续复核；不是自动得分或对读者体验的保证。每篇末尾的提炼只复习正文已经解释的内容。

| 文章 ID | 主线与可推演材料 | 设计理由 / 替代方案 / 需要保留的边界 |
| --- | --- | --- |
| compose-foundations | 收藏页面、三类结构与版本轴 | 声明式输入输出；组合不等于布局节点；BOM 不管理 Kotlin 插件 |
| compose-components | 文章行代码、sealed 状态、Modifier、环境依赖 | 输入与事件边界；显式输入 vs CompositionLocal；主题/语义/Preview 各自边界 |
| compose-snapshot | 混合读取、旧视图、enter/apply、版本筛选数值、三方合并表 | 串行/锁/不可变聚合；写者原子发布不等于读者自动一致；冲突不保证任意业务不变量 |
| compose-slots | 两个备注框、头插、条件删除、gap buffer 图 | 函数名/平面槽序号不足；key 与 remember(keys)；经典实现固定历史提交 |
| compose-compiler | Title 逐步补协议、四组输入、reports 配置 | 手工协议/描述树的替代方向；稳定性承诺与强跳过版本条件；伪代码非反编译 |
| compose-phases | 同一偏移的三种读取、调度循环伪代码、反馈反例 | 全量更新/手动失效的取舍；FrameClock 非固定 sleep；目标树应用与快照提交不同 |
| compose-effects | 防抖时间线、最新回调、注册解绑、迟到响应 | 组合寿命 vs 业务寿命；取消 vs 提交身份；source 回调上下文假设 |
| compose-layout | 三标签位置表、完整测量骨架、Node 结构 | Row/FlowRow 优先适配；Intrinsic 与 Subcompose 的不同依赖；有限宽和高度溢出边界 |
| compose-graphics-animation | 圆环几何、缓存代码、透明度算例、接管时序 | 对象缓存非像素缓存；离屏合成成本；动画控制权与阶段读取 |
| compose-input | 收藏语义、pass 图、拖动 key、滚动预算代码 | 高层交互 vs pointerInput；消费非停止传播；文本编辑态不等于 String |
| compose-lazy | 五千项准备模型、头插草稿表、Paging 结构 | key vs contentType；UI 惰性非数据分页；业务锚点 vs 数字索引 |
| compose-performance | 排序热点代码、缓存/后台化、基准骨架 | 首次成本与重复成本；协作取消边界；无虚构跑分或收益百分比 |
| compose-testing | 事件/状态测试、受控请求、动画、恢复测试 | fake 能证明的范围；测试时钟非外部时钟；局部恢复非真实进程死亡 |
| compose-navigation | 数据所有权图、类型路由、条目轨迹、失败窗口 | ID vs 整对象；UI Effect 不提供跨系统恰好一次；Navigation 2/3 不混用 |
| compose-interop | Fragment 配置、View 更新、绑定代次协议、验收矩阵 | ComposeView/AndroidView 方向；onReset/onRelease；取消不消除在途回调 |

## 来源与版本核对

- Runtime 状态、策略、Snapshot、观察器、Composer、Recomposer、Effects、DerivedState：核查 AndroidX 开发提交 `b8f12c706099a47e1e44d9772d03e14a4ae37146` 的相关源码。它不是项目依赖版本声明。
- 对照 `SnapshotMutableStateImpl.value`、`readable`、`innerApplyLocked`、`mergeRecords`、`runRecomposeAndApplyChanges` 的职责；正文给原创简化模型并明确省略项，不伪造源码逐字摘录。
- 经典 gap-buffer SlotTable 使用 `9427d828d411efd95deab638a8cfdec23421987a` 的历史文件。当前开发分支发生包路径迁移，不由此断言某一种新结构已在所有发布版本默认启用。
- Strong Skipping 默认版本条件与比较规则，依据 Kotlin/Android 官方编译文档；Kotlin Compiler、Runtime/UI 与 BOM 分开描述。
- 布局、图形、输入、Lazy、Effect、测试、Navigation 与互操作 API 使用正文所链接的官方文档。修正动画测试旧地址为 `/develop/ui/compose/animation/testing`；嵌套滚动使用独立的 nested-scroll-modifiers 页面。
- Kotlin 片段区分最小例、依赖项目组件的片段与协议伪代码。AndroidView 的释放重载显式给出 `onReset = null`，未声称启用复用。尚未建立 Android 示例工程，不声称代码已编译或在设备执行。
- 所有数值例子为教学计算或明确预期；未生成面试频率、公司采用情况、线上绩效或 Android 跑分。

## 站点检查的证据边界

内容同步检查 ID、分类、标题、小节与站内链接；路由测试检查旧地址兼容和章节解析；类型检查与静态构建检查网站实现。它们不证明 Android 示例已执行，也不证明每个技术命题正确，更不能用文章字符数作为“讲透”的验收指标。

章节链接保持原文章 ID，附加 `?section=N`。学习路线 57 组映射按本轮内容重新定位，Snapshot 单独增加设计理由与替代方案入口。已有收藏和笔记继续按原 ID 关联；章节号是公开定位的一部分，后续重排正文需同步更新引用。

后续自动生成同步采用本轮写作规则，并把已有文章的真实章节地址作为生成上下文。自动生成仍只产生待审核草稿，来源支持、推导完整性和示例边界须在发布前逐篇核对。

## 阅读方式与讨论边界

阶段 4 与阶段 5 的连接文章。以带草稿、收藏、图片和分页的文章列表解释 LazyColumn/Grid。推演不是已执行的实验，问题由本站设计；资料核验：2026-10-25。

## 第 1 问：Lazy 与普通 Column 的区别只是“屏幕外不画”吗？

普通 Column 的子内容通常整体进入组合与测量；Lazy 容器按视口及实现策略准备所需项目，并管理内容复用。不能把 Lazy 理解成先创建十万个项目再统一隐藏，也不能保证任何版本都恰好只组合屏幕内那几项：预取、缓存和保留策略可能准备额外项目。

十条固定设置项未必需要 Lazy；数据量大、分页、项昂贵时更有价值。Grid 同样需要合理约束和跨度策略，动态宽度下的列数变化会重新分配项尺寸，应评估图片占位和文字换行，而非仅验证竖屏截图。

## 第 2 问：key 与 contentType 各解决什么问题？

key 识别具体业务项，contentType 描述适合相互复用的内容形态。文章 A 和文章 B 应具有不同 key，但可以都是 ArticleRow 类型；广告与文章可使用不同 contentType。把 contentType 设成每项唯一 ID 会缩小复用机会；把 key 设成一个固定类型名则破坏身份唯一性。

同一列表混入头部、文章和错误重试行，key 可以用有明确命名空间的稳定标识。不要每次组合随机生成，索引也不能代表重排后仍然相同的业务对象。使用 rememberSaveable 时 key 还需符合保存机制支持的类型。[列表官方指南](https://developer.android.com/develop/ui/compose/lists)。

## 第 3 问：头部插入后，为什么输入草稿会跑到另一条？

用原创例子推演：当前位置 0=A、1=B，B 行保存草稿“待补充”。若身份只按位置识别，头插 X 后位置 1 成了 A，原位置状态可能被错误解释为 A 的草稿。业务 key 表达 B 仍然是 B，让运行时在变化中追踪正确身份。

但是 key 不是永久存储。删除 B、跨页面或进程死亡后草稿是否保留，取决于状态持有者和保存策略；需要跨会话保存的草稿放仓储，短期行内编辑可采用按 ID 提升的状态。见[SlotTable 推演](#/article/compose-slots)与[状态恢复](#/article/compose-state)。

## 第 4 问：复用、滚动状态与业务状态有什么区别？

复用减少内容准备成本，不允许上一条数据的监听、图片或输入状态泄漏到下一条。LazyListState 记录滚动等 UI 状态，不是文章数据仓库；恢复索引和偏移后，数据集已变时仍需决定用户阅读锚点。业务需要“回到同一文章”时，应考虑保存稳定 ID 并在重新加载后定位，而不只保存一个数字索引。

收藏列表删除当前项，应明确焦点转到哪个相邻项、返回原页面是否保持过滤条件。正确身份、保存机制和交互设计要配合，不能把这些问题全部交给列表内部缓存。

## 第 5 问：分页、占位和同向嵌套为什么常出故障？

分页状态至少分首次加载、追加、失败、结束；首次失败不能和底部追加失败显示成同一整页错误。占位项若尺寸近零，容器可能误判仍有大量空间，导致准备过多内容；应有接近真实内容的合理占位，不在图片到达时让页面大幅跳动。

同方向无界滚动父与 Lazy 子会让“视口多大”失去有限答案。优先把标题、筛选和内容组织为同一个 Lazy 容器的不同项；确有独立滚动区则提供明确高度和交互理由。嵌套滚动协商不能替代测量约束。[Paging Compose](https://developer.android.com/topic/libraries/architecture/paging/v3-paged-data#jetpack-compose)。

## 第 6 问：滚动性能怎样定位，而不是看到卡就加 remember？

分别检查输入派发、组合、测量、绘制、图片解码和主线程业务计算。每次滚动都排序整份结果，应该移动计算边界；每项图片尺寸巨大，应处理加载与缩放；只有返回顶部按钮依赖阈值时，才考虑派生状态减少不必要的消费者更新。

验证方案：固定同一批数据和图片缓存条件，执行头插、重排、滚动、恢复；同时记录帧分布、准备项数量、草稿所属 ID 和图片请求取消。对用户可见错误的修复优先于重组次数。详细步骤见[性能文章](#/article/compose-performance)。

## 原理资料怎么读

- [Lazy 列表源码目录](https://android.googlesource.com/platform/frameworks/support/+/refs/heads/androidx-main/compose/foundation/foundation/src/commonMain/kotlin/androidx/compose/foundation/lazy/)：按所用版本查 item provider、key 映射、measure 和 prefetch，开发分支只作导航。
- [列表 API 与示例](https://developer.android.com/develop/ui/compose/lists)：对照 key、contentType、滚动状态与嵌套限制，避免混成一个“缓存开关”。

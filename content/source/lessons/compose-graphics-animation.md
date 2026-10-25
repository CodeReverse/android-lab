## 阅读方式与讨论边界

阶段 4 的绘制与动画正文。以收藏图标、进度环和可中断面板解释 API 选择、阶段读取与图层成本。示例是机制推演，不是已执行的性能结果；资料核验：2026-10-25。

## 第 1 问：Canvas 与 DrawScope 做什么，画出来就占据布局空间吗？

Canvas 提供绘制入口，DrawScope 提供尺寸、密度及绘制操作。绘制坐标通常以像素表达，dp/sp 应通过适当的密度转换使用。它们不因为画了一个更大的圆，就自动要求父布局增加占位；尺寸来自布局，越界像素还受裁剪和图层边界影响。

推演进度环：半径取可用宽高较小值的一半，再减去半个描边宽度，避免描边超出边缘。画布变换只改变其作用范围内的绘制，不等于给兄弟组件腾位置。需要旁边文字随环变大而移动时，应先改变布局约束，再绘制。

## 第 2 问：drawBehind、drawWithContent、drawWithCache 怎样选择？

drawBehind 适合背景装饰；drawWithContent 可控制自身内容绘制前后工作，需要显示原内容时调用 drawContent；drawWithCache 适合保存依赖尺寸和部分状态的 Path、Brush 等对象。缓存绘制对象与缓存最终像素不是同一件事。

原创推演：圆角波形路径只随控件宽度改变，光标随播放进度每帧移动。可让路径构造依赖尺寸，把进度读取留在实际绘制回调；若在 cache 构建块读了进度，进度变化就可能反复重建昂贵路径，失去缓存意义。没有昂贵对象时增加缓存结构也可能只有管理成本。[绘制修饰符](https://developer.android.com/develop/ui/compose/graphics/draw/modifiers)。

## 第 3 问：graphicsLayer 为什么可能更快，又会付出什么代价？

图层把某些内容的绘制与变换隔离，平移、透明度、缩放等属性可以在合适情况下更新而无需重新组织整段内容。不能据此断言每层永远有独立纹理，是否离屏合成与策略、效果和平台实现有关。大范围离屏缓冲、混合和裁剪可能增加显存及带宽成本。

如果两个子图形重叠，分别调制透明度和先离屏合成后整体透明，重叠区域的像素可能不同；优化不能只对比耗时而不对比视觉。图层缩放也不等于改变布局占位，因此相邻组件可能重叠。[图层与合成策略](https://developer.android.com/develop/ui/compose/graphics/draw/modifiers)。

## 第 4 问：动画 API 应按什么标准选，而不是背名字？

一个目标值自然过渡用 animate*AsState；需要明确启动、停止、串行或接管手势时用 Animatable；多个属性由同一离散状态协调时用 Transition。AnimatedVisibility 组织进入/退出，AnimatedContent 处理状态对应内容之间的转换。选择依据是状态机和中断要求，不是函数长短。

例如面板拖动中释放后吸附：手势先控制当前位移，松手后根据速度与边界决定目标；再次按下应接管动画。若只给一个目标值却没有明确手势接管逻辑，就可能发生手指与动画相互抢控制。动画取消后的清理也要考虑协程取消语义。[值动画](https://developer.android.com/develop/ui/compose/animation/value-based)、[动画组件](https://developer.android.com/develop/ui/compose/animation/composables-modifiers)。

## 第 5 问：动画每帧变化，为什么不一定每帧重组？

动画驱动值随帧时间推进；消费者在什么阶段读取，决定哪些工作需更新。颜色可在绘制时读，位移可在放置或图层属性 lambda 内读；若函数体提前解引用成普通值再传入，依赖已在组合中建立。把值包成 lambda 也不够，调用该 lambda 的位置才是关键。

尺寸动画影响其他组件排布时仍需布局，不能为了降低重组计数改成不占位的缩放，从而破坏交互设计。高频流式文字更新也不只是动画问题：文本变长会触发排版测量，应结合更新批次、阅读体验和内存一起衡量。

## 第 6 问：如何验证中断、缓存与图层优化？

建立“静止→开始→中途反向→拖动接管→退出页面”的输入序列，断言最终状态、位置和资源释放；固定时钟检查中间帧，避免用任意 sleep 猜测动画是否完成。图片和字体准备好后再测绘制，另外记录首次加载成本。

对于波形例子分别记录路径构建次数、Draw 次数、帧时间与内存；对比有缓存/无缓存、图层/直接绘制。只有预期随尺寸变更的构建减少且像素、触摸和内存边界正确，才接受优化。本文未运行这些 Android 实验，完整方法见[性能正文](#/article/compose-performance)。

## 原理资料与源码定位

- [Graphics 概览](https://developer.android.com/develop/ui/compose/graphics/draw/overview)：先分清布局边界和绘制坐标。
- [动画定制](https://developer.android.com/develop/ui/compose/animation/customize)：对照 spring、tween 和速度连续性的适用条件。
- 所用版本源码从 Animatable、Transition、DrawModifierNode 和图层配置入口开始，按输入到帧值的方向阅读；不要把演示动画结果当业务帧预算。

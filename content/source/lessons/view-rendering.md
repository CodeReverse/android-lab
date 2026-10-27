## 1. 从主线程到屏幕的一帧

View 层负责描述 UI 的尺寸、位置与绘制指令；最终像素还涉及渲染线程、GPU、缓冲区与系统合成。常见硬件加速路径中，主线程记录或更新显示列表，RenderThread 执行渲染相关工作，SurfaceFlinger 合成可见图层。某帧迟到可能发生在任一环节，不能只统计 onDraw 耗时。

Choreographer 将输入、动画与遍历等工作对齐到帧节奏。刷新周期取决于设备与运行状态：60 Hz 约 16.7 ms，120 Hz 约 8.3 ms。它不是所有方法都可各用一整个周期的额度，而且屏幕刷新时间不等于 CPU 从头到尾顺序执行的单一流水线。

## 2. 父子测量约束

measure 接收父节点给出的 MeasureSpec；子节点结合自身内容与布局参数给出测量尺寸。EXACTLY、AT_MOST、UNSPECIFIED 表示约束语义，不等同于永远固定的 dp 数值。layout 决定最终边界，draw 使用这些边界生成绘制内容。自定义 View 的测量必须考虑 padding、建议最小值以及父约束，不能无条件返回内容理想尺寸。

requestLayout 表示布局可能失效，通常触发后续测量布局；invalidate 表示绘制内容失效，不保证重新测量。二者都不是立即在当前栈中同步完成一整帧，系统可以合并请求。尺寸变化却只 invalidate，会导致画面与布局不一致；纯颜色变化却每次 requestLayout，可能增加无谓工作。

## 3. 测量、布局、绘制与合成瓶颈

若列表滑动时主线程大量时间花在布局，先看嵌套层级、重复测量、文本计算和数据绑定。若主线程很轻而 GPU 或渲染阶段超时，减少透明叠加、巨大离屏层、过度绘制与高成本效果才可能有效。若主要是 Runnable 但迟迟拿不到 CPU，应调查系统负载或线程竞争，继续减少 onDraw 不一定解决它。

RecyclerView 的复用解决一部分对象创建，但不会自动解决昂贵的 bind、图片解码和频繁全量刷新。应使用稳定的数据身份与差分更新；Diff 在大列表上也有计算成本，应检查执行线程、取消旧计算和最终提交的时序。

## 4. 关键路径的对照验证

用固定数据与固定滑动脚本，在接近 release 的构建上采集 FrameTimeline 与自定义 trace。只改一个因素，例如移除图片解码或降低布局复杂度，比较迟到帧比例与长尾。保留设备温度、刷新率和编译状态，不能拿一次 Debug 手滑结果作为线上收益。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [View 自定义绘制](https://developer.android.com/develop/ui/views/layout/custom-views/custom-drawing)
- [硬件加速模型](https://developer.android.com/develop/ui/views/graphics/hardware-accel)
- [慢帧诊断](https://developer.android.com/topic/performance/vitals/render)

## 面经选题来源

原帖仅支持选题，不代表本文全部内容是公司原题，也不用于估算行业频率。

- [小米安卓一二面 · 2025-10-27](https://www.nowcoder.com/feed/main/detail/2f0777d95e974ce686abc063a75f5349)：涉及 View 绘制与渲染。

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. View 的一帧从主线程怎样到达屏幕？（回看第 1 节）
2. measure 的约束从哪里来，父子如何协作？（回看第 2 节）
3. 卡顿怎样区分测量、布局、绘制与合成瓶颈？（回看第 3 节）
4. 怎样证明某个布局优化真正缩短关键路径？（回看第 4 节）

## 1. 一个进度条变化，不一定需要重新测量

自定义进度条从 30% 变成 40%，它的宽高没有改变，只是填充区域变化。此时 `invalidate()` 表达绘制内容过期；如果文字从一行变成三行、期望高度变化，则需要 `requestLayout()` 重新参与尺寸与位置计算。两者不是“轻量刷新”和“重度刷新”的随意档位，而是不同的失效原因。

```kotlin
var progress: Float = 0f
    set(value) {
        val next = value.coerceIn(0f, 1f)
        if (field == next) return
        field = next
        invalidate()
    }
```

这是 View 成员示意，应在正确线程更新。若进度值同时决定 View 的期望尺寸，代码就不完整，需按尺寸变化请求布局。API 调用不意味着此刻同步完成一帧，多次变化可以在框架调度中合并。

## 2. 父亲给的不是最终尺寸，而是测量约束

ViewGroup 知道自己的空间和子项 LayoutParams，再构造 MeasureSpec 传给子 View。LayoutParams 是子项向父布局表达的意图；MeasureSpec 是父布局计算后传下来的约束，二者不是同一个对象。

设自定义标签内容理想宽 180 px，父给 `AT_MOST 120 px`，它应在最多 120 的约束下确定宽度，并据此换行或截断；若父给 `EXACTLY 120 px`，期望宽不能覆盖这个精确约束。`UNSPECIFIED` 表示该方向没有这种上限，不等于强制尺寸为 0。

```kotlin
// 教学片段：省略 padding、最小尺寸、文本测量等产品细节
override fun onMeasure(widthSpec: Int, heightSpec: Int) {
    val desiredWidth = 180
    val desiredHeight = 48
    setMeasuredDimension(
        resolveSize(desiredWidth, widthSpec),
        resolveSize(desiredHeight, heightSpec)
    )
}
```

示例用像素演算约束，真实控件还要正确处理密度与内容。测量回答“要多大”，布局回答“放哪里”；父布局可能为了分配剩余空间再次测量子项，不能假定每帧每个 View 恰好测一次。契约见 [Android View 绘制](https://developer.android.com/guide/topics/ui/how-android-draws)。

## 3. 从失效请求走到一次遍历

顶层 ViewRootImpl 协调窗口里的 View 树，布局/绘制需求会进入帧调度。Choreographer 协调与显示节奏相关的回调；一次遍历按需要做 measure、layout、draw，而不是每次 invalidate 都完整执行所有阶段。

```text
属性变化
  ├─ 几何需求变了 → requestLayout → 需要测量/布局
  └─ 像素内容变了 → invalidate    → 需要重绘
                         ↓
                帧回调与 View 遍历
```

为什么要分阶段？如果进度条每次颜色变化都重新测量整棵树，做了很多没有改变结果的工作；如果尺寸变化只重绘，父子位置就可能仍旧。Compose 也区分组合、测量、放置与绘制，但运行结构不同，不能直接把重组当成 View 的 requestLayout，见 [Compose 刷新阶段](#/article/compose-phases)。

## 4. onDraw 结束还没有到屏幕

在常见硬件加速路径里，UI 侧记录绘制操作，渲染线程及 GPU 进一步执行相关工作，应用产生的缓冲交给显示系统合成。SurfaceFlinger 与硬件合成器协调最终显示；因此 Java onDraw 很快不代表整帧没有瓶颈。

```text
UI 遍历/记录 → 渲染工作 → 缓冲可用 → 合成/呈现
```

这张图只表示责任链，实际多帧可以流水重叠，还有同步 fence 和缓冲排队；不能把每段耗时简单相加后当成所有设备的帧时间。系统侧职责可查 [SurfaceFlinger 与 WindowManager](https://source.android.com/docs/core/graphics/surfaceflinger-windowmanager)。

如果 UI 线程很短但 GPU 工作很重，继续减少 Java 方法调用不一定有效；若 UI 被锁卡住，减少 overdraw 也解决不了等待。先确定落后的是哪一段，再设计优化。

## 5. 用一帧的证据回答为什么卡

以教学场景区分三种情况：布局嵌套导致同一子树反复测量；onDraw 每帧解码图片导致分配和计算；透明大区域叠加使绘制负担高。对应修复分别是减少无效布局依赖、把解码移出绘制并管理缓存、减少实际昂贵的绘制区域，不能统一回答“用缓存”。

记录请求布局次数、UI/渲染线程轨迹、GPU/呈现相关时间及输入场景。60 Hz 的周期约 16.67 ms，120 Hz 约 8.33 ms，但应用实际截止时间与流水调度有关，不能把某个数字当全链路固定预算。优化前后使用相同设备、刷新率与操作，比较帧分布而非只看平均值。

这些是验证方案，未进行设备基准。更完整的控制变量方法见 [性能证据](#/article/performance-proof)。

## 面试提炼

1. 进度变化为什么通常不需要 requestLayout？（第 1 节）
2. LayoutParams 与 MeasureSpec 的关系是什么？（第 2 节）
3. 测量、布局、绘制为什么分开，为什么可能重复测量？（第 2、3 节）
4. onDraw 很快为什么仍可能掉帧？（第 4 节）
5. 如何区分布局、主线程阻塞与 GPU 瓶颈？（第 5 节）

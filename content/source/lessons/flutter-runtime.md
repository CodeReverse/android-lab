## 1. 列表反复 build，状态为什么还能保留

收藏列表里每个商品有一个展开状态。点击某项后 setState 导致 build 再次执行，代码创建了新的 Widget；如果“Widget 就是长期存在的控件”，展开状态似乎应该每次丢失。矛盾来自把配置与长期身份混在一起。

```dart
class ProductRow extends StatefulWidget {
  const ProductRow({super.key, required this.productId});
  final String productId;
  @override
  State<ProductRow> createState() => _ProductRowState();
}
```

片段省略 State 的 UI 实现，只展示配置与状态分离。Widget 是不可变配置，Element 负责树中的实例身份和更新关系，State 与相应 StatefulElement 的生命周期关联。RenderObject 则承担布局、绘制等职责；并非每个 Widget 都对应一个 RenderObject。三层分离让配置可以便宜地重建，同时保留需要持续存在的状态。

## 2. 更新时先匹配身份，再决定复用

假设原列表为 A、B，每行有自己的展开状态。前面插入 X 后，若只靠位置匹配，同类子项容易把原位置的状态留给新内容。稳定业务 key 告诉框架同一父级下哪一个配置延续原身份：

```dart
Column(
  children: products.map((p) => ProductRow(
    key: ValueKey(p.id), productId: p.id,
  )).toList(),
)
```

`products` 是教学数据列表。更新匹配考虑 runtimeType 和 key；没有 key 时还依赖树的位置与父级更新算法。key 不是全局数据库主键，LocalKey 的匹配有父级范围；GlobalKey 能承担跨位置身份等能力，也带来额外限制和成本，不能给每一行随意分配一个来“优化性能”。

沿 X、A、B 的插入过程推演：匹配到 A 的 Element，更新其 Widget 配置，State 继续；X 没有对应实例，才创建新的状态。这比“diff 自动保留所有状态”更准确。机制依据 [Flutter 架构](https://docs.flutter.dev/resources/architectural-overview)。

## 3. build 发生不等于整屏重新栅格化

build 更新配置与 Element 关系，布局根据约束计算几何，绘制生成需要的绘制工作。布局可以用“约束向下、尺寸向上、父级决定位置”的模型理解；具体 RenderObject 可能有不同布局协议。

```text
状态变化 → 标记需要 build → 更新配置/Element
                         → 必要的 layout / paint → 渲染
```

为什么分开？文字颜色变了不必改变尺寸，父宽改变可能需要重新布局却不必重建业务状态。RepaintBoundary 能在适当位置隔离绘制重做，但增加层和缓存相关成本；不能把每个节点都包住当作通用优化。

Flutter 通常自己组织 UI 渲染，而不是把每个 Widget 翻译成 Android View。嵌入平台 View 是另一条互操作路径，涉及合成、输入与平台资源；这也是与 [RN 渲染](#/article/rn-architecture) 比较时的重要维度，而非简单说谁“更原生”。

## 4. Dart 与平台能力之间仍有协议成本

```dart
const channel = MethodChannel('example/player');
final playing = await channel.invokeMethod<bool>('isPlaying');
```

示例只说明调用形式。参数需要按 codec 编码，宿主 handler 解码并执行，再返回结果。异步 API 不等于底层平台操作自动在后台运行；线程约束要按平台通道与 Task Queue API 核对。一次调用很小，但每帧传大量对象或逐像素往返，会把序列化、调度和复制变成主成本。

替代方案包括批量提交、传稳定 ID/文件位置、让高频计算留在一侧，必要时评估 FFI 与共享资源。FFI 缩短某些调用路径，却引入 ABI、内存所有权和阻塞风险。官方契约见 [Platform channels](https://docs.flutter.dev/platform-integration/platform-channels)。

## 5. isolate 解决并行，也要求重划数据边界

一个 Dart isolate 有自己的执行与内存模型，耗时计算可安排到其他 isolate；这不是“随便共享同一个可变 Map”。数据交换依消息与支持的传递方式，创建、复制和结果交付也有成本。很短的小计算分出去可能更慢，主 isolate 上的长同步循环则会挡住它的其他工作。

技术试验应先测任务规模，再比较主 isolate、后台 isolate 和平台侧实现，计入输入输出传输，而非只比较核心函数耗时。基础机制参见 [Dart 并发](https://dart.dev/language/concurrency)。

## 6. 混合工程先定义退出和回退

把 Flutter 页面嵌入既有 App，需要明确 Engine 与页面谁拥有、退出后哪些资源继续、导航与账号状态如何同步。复用 Engine 可减少重复初始化，却可能增加常驻资源和状态污染风险；每次新建则相反。选择要由页面频率、内存预算和实际启动数据支持。

教学 spike 可选真实复杂度的一页，测试首次/再次进入、键盘、无障碍、滚动、后台恢复和 channel 失败。公开应用采用情况应引用具体团队、日期和模块，不能从“某 App 用过 Flutter”推导它现在全量采用。本文讲机制与验证，不提供未经核验的使用比例；比较决策见 [技术决策](#/article/technology-decisions)。

## 面试提炼

1. Widget 重建为什么不必丢失 State？（第 1、2 节）
2. key 在列表插入时改变了哪一步匹配？（第 2 节）
3. build、layout、paint 为什么不能混为一次刷新？（第 3 节）
4. Channel、FFI 与 isolate 各把成本放在哪里？（第 4、5 节）
5. 混合工程怎样验证 Engine 复用的收益与代价？（第 6 节）

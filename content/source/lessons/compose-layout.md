## 阅读方式与讨论边界

阶段 4 的布局正文。以标签换行和双栏页面推演 Constraints、measure、place、Intrinsic、SubcomposeLayout、Modifier.Node。推演数值用于解释算法，不是实测；资料核验：2026-10-25。

## 第 1 问：父子布局之间到底传递什么？

父向子传入宽高上下界 Constraints；子在约束内选择测量尺寸；父决定子的位置，并向自己的父报告尺寸。Measurable 表达可测量内容，测量结果 Placeable 提供尺寸及放置能力。约束不是一个建议尺寸，也不总有有限 maxHeight：滚动容器可能沿滚动轴提供无界约束。

例如父宽区间为 0..300px，左右内边距各 12px，内容可用最大宽变成 276px。父设置最小宽与最大宽都为 300，则子不能通过普通 wrap 请求让父最终变成 100。先画约束传递，比反复试 fillMaxWidth 更容易找出“尺寸设置不生效”的原因。

## 第 2 问：Row、Column、Box、weight 和对齐线如何选？

Row 按横向组织，Column 按纵向组织，Box 用于叠放。weight 通过父数据参与剩余空间分配，必须在相应作用域使用；滚动轴无界时，“剩余高度”不能机械按屏幕高度计算。fill/wrap 的效果取决于收到的约束和 Modifier 次序，不能脱离父节点判断。

对齐数字与单位时，用文本基线对齐比用固定 top padding 更稳：字号、字体和语言变化后，文字外框中心不等于视觉基线。自定义布局若需要向外传播对齐关系，应报告相应对齐线。RTL 放置采用相对方向语义，不能把所有横坐标都当屏幕左起。

## 第 3 问：标签自动换行布局怎样一步步计算？

教学假设：可用宽 100px，水平间隔 8px，三个子项测量后分别为 40×20、45×24、30×18。依次测量，每个子项本轮只测一次。第一项 x=0；第二项起点 48，末端 93，可放同一行；第三项需起点 101，超过宽度，换行。第一行高取最大值 24，若行距 6，则第三项 y=30，内容高为 48。

将该算法泛化为：维护当前 x、y、行高；放不下且当前行非空才换行；单项过宽由测量约束和明确的溢出策略处理；最终宽高再满足父约束。空列表、最小高度、无界宽度、RTL 和字号放大都要单独推演。不要直接把 Infinity 当可返回的真实尺寸。

## 第 4 问：为什么不能反复测量子项直到“看起来合适”？

普通 Layout 的同一测量 pass 对同一个子项重复 measure 不属于通用允许模式，避免测量成本随嵌套结构爆炸。Intrinsic 是在真正测量前询问固有尺寸需求的接口，不等同于偷偷 measure 多次；自定义组件要按自身算法给出有意义的 intrinsic 答案。

SubcomposeLayout 解决另一类依赖：必须拿到约束或先测出的信息，才知道后续应组合哪些内容。它把组合安排到测量上下文，付出额外管理复杂度；不是修复一切尺寸问题的首选。Lazy 布局利用类似机制按需要准备内容，而其固有尺寸查询能力不能按普通 Layout 假定。[自定义布局](https://developer.android.com/develop/ui/compose/layouts/custom)、[固有测量](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements)。

## 第 5 问：只改位置与改尺寸，为什么成本不同？

改尺寸可能使父重新分配空间，并影响兄弟位置；仅改变放置偏移可避免重做本不需要的测量。布局阶段还要区分测量读取与放置读取：把滚动偏移放进 offset lambda 读取，和先在组合函数体读取再传值，失效入口不同。

但文字内容变长会影响测量，不能用绘制平移假装已经处理了布局尺寸。相反，视觉缩放不应总通过重新计算全部子项尺寸实现。先定义希望改变的是布局占位还是视觉外观，再选择布局或绘制工具；细节见[阶段正文](#/article/compose-phases)。

## 第 6 问：Modifier.Node 与链上的 Element 分别负责什么？

Element 描述配置并负责创建、更新对应 Node；Node 是附着于布局体系的可维护行为对象，可承担布局、绘制、输入或语义职责。正确更新配置并触发需要的失效，比在组合中反复创建带外部资源的对象更可控。链的相等判断不能漏掉影响行为的参数，否则旧 Node 可能继续使用错误配置。

用自定义边框推演：颜色改变应更新绘制参数，宽度若影响占位还需考虑测量；节点脱离时释放其订阅，重新附着时恢复必要观察。不要自行缓存一个失效的 LayoutCoordinates 长期使用。具体回调与自动失效规则查所用版本的接口。[自定义 Modifier 与 Node](https://developer.android.com/develop/ui/compose/custom-modifiers)。

## 第 7 问：面试官给出裁切、重叠和抖动，怎样定位？

先记录父约束、子尺寸、放置坐标、裁剪范围；再检查是否用 onSizeChanged 回写组合状态造成后一帧再次布局。若尺寸依赖可以在同一测量过程中解决，就不必绕一圈异步状态反馈。若只是调试浮层位置，要考虑坐标系转换和宿主窗口变化。

验证设计：对上述标签布局分别输入宽 100、70、无界；检查单行边界、总高、RTL 起点和空集。再用大字体、窗口缩放观察。检查布局结果与用户触摸区域是否一致，绘制好看而命中错位仍然是错误。这里给的是验证方法，没有宣称已经在设备运行。

## 原理资料与后续

- [约束与 Modifier 顺序](https://developer.android.com/develop/ui/compose/layouts/constraints-modifiers)：逐层画出约束如何收缩。
- [SubcomposeLayout API](https://developer.android.com/reference/kotlin/androidx/compose/ui/layout/SubcomposeLayoutState)：查所用版本的复用与预组合能力。
- [列表身份和复用](#/article/compose-lazy)、[绘制和动画](#/article/compose-graphics-animation)。

## 1. 状态与事件驱动的组件

按状态所有权和交互职责拆分。SearchRoute 接入 ViewModel；SearchScreen 接收 UiState 与事件；SearchBar 接收 query/onQueryChange；ResultRow 接收文章和收藏动作。纯展示组件不要自己获取账户、数据库和路由控制器，否则 Preview 和测试必须搭建整个应用。

页面状态要能表达正在加载、空结果、失败、成功，以及“旧数据仍可展示但正在刷新”。不要用互不约束的 loading/error/empty 三个 Boolean 产生矛盾组合。表单输入、列表结果、对话框可见性也不必全部由同一个持有者拥有：谁消费、谁修改、寿命多长，决定边界。

## 2. 基础组件的使用约束

Text 负责显示，输入组件还要处理编辑状态；Button 把点击与语义包装在一起；Image 需要有意义的描述或明确声明为装饰；Dialog 的开关来自状态；Scaffold 组织顶栏、底栏和内容槽位，内容需要正确处理传入的 padding。列表与网格应按数据规模选择普通布局或 Lazy 布局。

具体推演：点击收藏先发出 ArticleId 事件，业务层决定乐观更新或等待服务端；UI 展示由新状态驱动。若行组件自己维护一份 isSaved，又从上层接收另一个 isSaved，就必须解决两个真相源冲突。组件 API 宜提供事件而不是暴露业务协程作用域，让调用方承担提交、重试和失败回滚。

## 3. Modifier 的顺序和作用域

Modifier 链表达包裹和参与行为的顺序，不是无序属性表。假设一个文字区域外有 padding：先 clickable 后 padding，点击行为包裹了 padding 后的内容；先 padding 后 clickable，点击行为位于内层，边缘留白的命中范围不同。背景、裁剪与绘制同样受相对位置影响。验证时同时观察尺寸、像素和触摸，不能只看截图。[Modifier 契约](https://developer.android.com/develop/ui/compose/modifiers)。

对外组件通常提供 `modifier: Modifier = Modifier`，应用到负责整体布局的根节点。不要偷偷把它只作用到内部图标，也不要在每层重复使用导致点击和 padding 叠加。weight 等父数据修饰符还依赖对应布局作用域；函数签名应表达这种限制。

## 4. 主题、国际化与无障碍

颜色、字重、字号和形状应通过主题语义表达，避免在每个页面复制常量。深色模式不仅是背景变黑，还涉及内容对比、禁用态和图片可辨性。文本使用资源和复数规则，布局支持长文本、字号缩放及 RTL；start/end 通常比硬编码 left/right 更能表达排版意图。

搜索结果行若整行可点击，内部收藏又是独立动作，应让读屏用户区分“打开文章”和“切换收藏”，包含可理解标签、选中状态与合理触达区域。纯装饰图标无需重复朗读文字；业务图标则不能省掉含义。语义树是交互契约，不是为了测试才追加的标签。[语义说明](https://developer.android.com/develop/ui/compose/accessibility/semantics)。

## 5. CompositionLocal 的依赖边界

它为组合子树提供隐式依赖，适合主题、密度、布局方向等跨层环境。优点是减少机械传参；代价是依赖不再直接出现在函数签名里，复用组件需要知道额外环境。业务行组件若隐式读取整个页面 ViewModel，换页面或测试时就容易失败。

`compositionLocalOf` 会跟踪读取，值变化关联其消费者；`staticCompositionLocalOf` 不做同样的逐读跟踪，提供值变化会重组提供内容区域，适合很少变化的值。选择不能只看 static 这个名字，以实际变化频率与影响范围判断。[CompositionLocal 官方解释](https://developer.android.com/develop/ui/compose/compositionlocal)。对公共组件优先显式传入必要业务输入，确有环境含义再使用 Local。

## 6. Preview 与组件验证

Preview 适合发现长标题、空数据、深浅色、大字号的布局问题，不证明网络、宿主生命周期、IME 和系统恢复都正确。纯 UI 接收固定 UiState，分别预览加载、失败、成功、刷新旧数据；事件用可替换回调，避免预览发真实请求。

推演一条失败路径：用户输入新关键词，旧请求返回，页面不能变回旧词结果；这属于状态机验证，不是 Preview 能覆盖的静态外观问题。再用[测试正文](#/article/compose-testing)检查点击输出、语义和恢复，使用[输入正文](#/article/compose-input)验证键盘与焦点。组件拆得更多也不自动更快，应基于状态读取边界与测量证据评估。

## 参考资料的阅读目标

- [Material 3 主题](https://developer.android.com/develop/ui/compose/designsystems/material3)：用语义颜色和字体角色设计上述状态。
- [Preview](https://developer.android.com/develop/ui/compose/tooling/previews)：建立尺寸、语言、字体和主题变体，而非只做一张正常页面截图。
- [状态提升](https://developer.android.com/develop/ui/compose/state-hoisting)：继续回答状态到底归组件还是页面。

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. 怎样把一个页面拆成可复用组件？（回看第 1 节）
2. 基础组件应该掌握哪些使用约束？（回看第 2 节）
3. 主题、国际化和无障碍为什么不能留到最后补？（回看第 4 节）
4. CompositionLocal 应该放什么，为什么不把 ViewModel 都塞进去？（回看第 5 节）
5. Preview 能证明页面正确吗，怎样设计组件验证？（回看第 6 节）

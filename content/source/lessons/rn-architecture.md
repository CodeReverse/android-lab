## 1. 从一次 JS 状态更新走向原生界面

商品页点击收藏，React 状态改变，屏幕图标跟着变化。React 负责描述 UI 和协调更新；React Native 把结果落到宿主平台组件。它不是让 WebView 渲染一份 DOM，也不能因为最终有原生 View 就认为中间没有 JS 执行与跨语言成本。

```tsx
function Favorite() {
  const [selected, setSelected] = useState(false);
  return <Pressable onPress={() => setSelected(v => !v)}>
    <Text>{selected ? '已收藏' : '收藏'}</Text>
  </Pressable>;
}
```

这是最小状态示例，省略持久化和无障碍。需要追踪的不是 JSX 字符串怎样“显示”，而是 React 更新怎样形成宿主树，布局怎样计算，改动在哪个线程应用。

## 2. 旧 Bridge 的瓶颈为什么引出新互操作层

旧架构大量依赖异步批量 Bridge 在 JS 与 native 之间传递序列化消息。批量化减少频繁交互，但会引入排队、数据转换和异步时序约束。若每一帧都往返大量数据，成本不仅在业务计算。

JSI 提供 JavaScript 运行时与 C++ 的互操作接口，新架构据此组织更直接的能力访问。这里“直接”不等于所有数据零拷贝，也不等于方法自动在后台执行。同步调用若做长 I/O，反而能把调用线程直接堵住；跨语言对象生命周期也需要管理。

新架构的组成和动机以 [RN 官方架构说明](https://reactnative.dev/architecture/landing-page) 为准。旧/新项目可能依赖不同模块和兼容层，排查时先固定 RN、引擎和库版本，不能把两个时期的线程图拼成一张。

## 3. Fabric 把更新拆成渲染、提交与挂载

```text
React 状态变化
 → Render：形成/更新 Shadow Tree
 → Commit：布局计算与树的提交协调
 → Mount：把需要的变化应用到宿主 View
```

这是 [Render, Commit, Mount](https://reactnative.dev/architecture/render-pipeline) 的教学简图。Shadow Tree 表达宿主渲染所需结构，Yoga 等布局机制参与尺寸计算；挂载才把变更落实到平台视图。树更新使用不可变结构与共享等机制，支持中间结果的协调，而不是边计算边任意修改屏幕。

为什么需要提交边界？如果新树只算了一半就直接改视图，用户可能看到前后状态混杂，也不利于调度与中断。不可变快照带来额外结构管理，却让“准备结果”和“发布结果”更清楚。具体线程分布由更新类型和架构实现决定，不能说三个阶段永远各占一个固定线程。

## 4. TurboModules 与 Codegen 解决接口问题

自定义播放器模块需要声明参数、返回值和方法。Codegen 依据支持的类型描述生成跨边界绑定，减少手写两侧签名不一致；TurboModules 改进 native module 的组织与加载访问方式。

类型生成能发现结构不匹配，却不能自动保证“songId 存在”“权限已授予”“重复调用不会扣两次费”。这些仍是业务协议。同步返回是否必要、异步任务谁取消、页面退出后回调归谁，必须在模块设计中写清。入门契约见 [Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)。

一个合理的模块边界可传商品 ID 或批量状态，不宜每次滚动都往返巨大的对象树。减少调用次数、减少转换与保持所有权明确，通常比追求某个接口名更有价值。

## 5. JS 很忙与原生很忙需要不同证据

若点击后 JS 线程在做大 JSON 解析，React 更新无法及时推进；若宿主挂载或主线程被锁阻塞，即使 JS 很快也无法呈现；如果图像和 GPU 压力高，还需渲染侧证据。不能用“Bridge 慢”解释所有帧问题，尤其新架构未必经过旧 Bridge 路径。

教学实验把同一页面分别增加可控 JS 计算、native 延迟和大图片负载，记录各侧时间与响应。比较时固定 release 构建、JS 引擎、设备和数据，开发模式的检查开销不能代表线上。性能分析原则见 [RN Performance](https://reactnative.dev/docs/performance)。本文未运行这些基准。

## 6. 迁移收益要连同生态成本验证

新架构迁移还涉及第三方模块是否兼容、原生组件实现、异常栈与监控、启动、内存和发布流程。直接升级版本而不覆盖模块边界，可能让页面正常但相机/音视频等功能失败。

可先选一个具备真实列表、输入和 native module 的小流程验证，记录功能一致性与端到端性能，再扩大。与 Flutter 比，RN 更依赖 React/JS 与宿主组件协作；与 KMP 比，后者可只共享业务逻辑并保留独立 UI。优势取决于团队、交互与平台深度，不能脱离场景排总榜，见 [KMP 边界](#/article/kmp-boundaries)。

## 面试提炼

1. RN 为什么既不是 WebView，又不能当成没有 JS 成本？（第 1 节）
2. JSI 改变什么，为什么不自动意味着零拷贝和异步？（第 2 节）
3. Render、Commit、Mount 为什么需要分开？（第 3 节）
4. Codegen 能保证哪些契约，保证不了哪些业务语义？（第 4 节）
5. 怎样区分 JS、挂载与图形瓶颈并评估迁移？（第 5、6 节）

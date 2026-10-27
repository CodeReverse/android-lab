## 1. 从状态更新理解界面

Compose 用状态描述界面。状态写入后，运行时根据被观察的读取决定哪些工作失效；组合、布局和绘制的职责不同，不应把所有屏幕变化都叫重组。先读[状态与所有权](#/article/compose-state)，再用[阶段机制](#/article/compose-phases)追踪一次更新。

## 2. 把身份、快照与编译协议连起来

[组合结构](#/article/compose-slots)解释位置、key、记忆值与节点复用；[Snapshot](#/article/compose-snapshot)解释状态版本、读依赖与提交；[编译器](#/article/compose-compiler)解释生成的协议、稳定性和跳过条件。三者协作，但分别处理身份、状态和执行。

以列表头插为例，先确认业务项身份是否稳定，再观察状态属于哪个组合范围，最后结合参数和读取解释重组。这样可以区分状态错位与性能问题，避免仅靠增加 remember 或稳定性注解处理所有现象。

## 3. 用证据判断优化与迁移

重组次数减少不自动代表帧耗时下降。应先定位组合、布局、绘制、图片或其他资源的成本，再选择改动并比较同条件的结果。详见[性能定位](#/article/compose-performance)和[测试分层](#/article/compose-testing)。

迁移还涉及宿主生命周期、View 复用、资源释放和回滚。[互操作](#/article/compose-interop)提供边界说明。首次系统复习可按[完整学习路径](#/article/compose-roadmap)展开，具体源码实现均需固定版本。

## 面经选题来源

[MetaApp 原帖](https://www.nowcoder.com/feed/main/detail/ffabbdfbab1a49c0a8a1c99b7d121535)用于 Compose 选题；本篇是阅读导航，下面问题为编辑提炼，不是原帖逐题答案。

## 面试提炼

1. 同一次状态变化为何可能只触发绘制，而不重新组合？（回看第 1 节）
2. Snapshot、组合身份与编译器分别解决什么问题？（回看第 2 节）
3. 如何证明减少重组带来了用户可感知的性能收益？（回看第 3 节）

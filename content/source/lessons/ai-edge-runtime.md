## 1. 模型导出到设备执行

训练框架保存的 checkpoint 通常包含参数及架构约定，部署还需要可执行图、算子语义、张量布局、形状约束和后端内核。导出成功只证明生成了文件，不证明目标设备兼容、数值正确或速度更快。Tokenizer、预处理、模板与后处理同样属于模型契约。

典型链路是捕获／导出图 → 常量折叠与融合 → 量化／布局转换 → 后端分区与编译 → 内存规划 → 运行。实际顺序因工具链而异，某些优化发生在转换期，另一些在加载或运行期。

## 2. 推理引擎的选型

|引擎|值得评估的起点|必须验证的约束|
|---|---|---|
|LiteRT|移动与边缘通用部署；现行文档包含 CompiledModel 与 Interpreter 路线|目标硬件、模型算子、具体 API 与加速路径的兼容性；LLM 配套能力单独检查|
|ONNX Runtime|已有 ONNX 导出流程、希望通过 Execution Provider 适配多平台|opset、EP 支持、分区回退、量化格式和 native 包体|
|ExecuTorch|PyTorch 导出与面向端侧的 AOT、内存规划流程|导出限制、动态 shape、后端 delegate、算子裁剪与调试能力|
|MNN|移动推理及其官方提供的 LLM 部署能力|目标模型转换、硬件后端、量化方案、设备实测与维护成本|
|ncnn|移动平台轻量神经网络推理，可优先评估视觉场景|算子和模型覆盖、CPU/Vulkan 等后端、转换精度与集成边界|
|llama.cpp|C/C++ 本地大模型执行，GGUF 模型及量化生态|具体模型架构、后端支持、内存、模板、tokenizer 和多模态组件匹配|

这张表是截至 2026-10-06 对官方入口的选型归纳，不是跨硬件 benchmark，也不表示某引擎不在表中列出的场景就不能用。生产应固定 release／commit、工具链和模型版本，滚动文档不等于你的版本功能。

## 3. CPU、GPU 与 NPU 的实际成本

CPU 控制逻辑灵活、部署普遍，小模型可能避免了 GPU/NPU 调度与拷贝成本。GPU 适合许多并行张量运算，但与 UI 渲染争用资源。NPU 的专用低精度计算可能有能效优势，也常受算子、shape、布局和量化参数限制。峰值 TOPS 的精度、稀疏假设与实际负载不同，不能直接拿来算用户时延。

以 ONNX Runtime 的 EP 为例，后端声明可执行的子图，剩余部分可能由其他 provider 处理。实际行为受配置影响，有的配置允许 CPU fallback，有的失败即停止。必须查看分区或 profiling 结果，不能因为创建了 QNN session 就认定全部计算都在 NPU。

## 4. 算子分区与回退

假设某图大部分在加速器，但中间一个不支持的算子落回 CPU。跨边界可能发生同步、布局转换、拷贝或缓存维护，随后再回加速器。每一段都很快，连接成本仍可能超过收益。频繁动态 shape 还可能触发重新编译或阻止融合。

排查时先用纯 CPU 的正确性基线，再逐步开启后端，对齐输入输出并查看每个分区。必要时替换不兼容算子、固定合理 shape bucket 或整段留在同一后端；不是所有 fallback 都必须消除，要以端到端收益为准。

## 5. 设备和模型兼容矩阵

至少记录模型 hash、格式、tokenizer／模板、量化配置、引擎版本、后端、系统版本、SoC、驱动条件、支持 shape 和降级策略。验证冷启动、暖启动、长序列、取消、并发和后台切换。不要只测旗舰机和最短输入。

转换后比较中间张量或最终输出，允许的误差按任务决定。分类 top-1 相同不证明检测框、置信度或长文本行为相同。生成任务还需核对特殊 token、终止条件和模板，否则常出现“模型能跑但一直输出乱码”。

## 6. 模型格式与自研边界

**GGUF、ONNX 和运行时是什么关系？** 它们处在不同层面：前两者是模型表示／文件格式相关约定，运行时负责执行受支持的模型；不能只改扩展名完成转换。

**是否应该自己写推理引擎？** 若现成框架满足兼容、性能与许可约束，自研通常增加维护负担。只有证据表明关键算子、硬件或系统需求无法满足，才讨论定制内核或后端，并估算长期适配成本。

建议保留一份可复现的机型／模型矩阵和失败样本，作为选型证据。本篇未声称已在这些引擎上完成同模型实测。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [Google LiteRT 官方入口](https://developers.google.com/edge/litert)
- [ONNX Runtime 移动端部署](https://onnxruntime.ai/docs/tutorials/mobile/)
- [ExecuTorch 执行与编译机制](https://docs.pytorch.org/executorch/stable/intro-how-it-works.html)
- [阿里巴巴 MNN 官方仓库](https://github.com/alibaba/MNN)
- [腾讯 ncnn 官方仓库](https://github.com/Tencent/ncnn)
- [llama.cpp 官方仓库](https://github.com/ggml-org/llama.cpp)
- [ONNX Runtime QNN Execution Provider](https://onnxruntime.ai/docs/execution-providers/QNN-ExecutionProvider.html)

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. 模型从训练产物到设备执行需要哪些转换？（回看第 1 节）
2. LiteRT、ORT、ExecuTorch、MNN、ncnn、llama.cpp 怎样选？（回看第 2 节）
3. 算子分区和 CPU fallback 为什么可能拖慢整个图？（回看第 4 节）
4. 上线前怎样构造设备与模型兼容矩阵？（回看第 5 节）
5. 模型格式与运行时有何区别，何时值得自研？（回看第 6 节）

## 1. 首字等待与后续速度来自不同工作

先把推理当成普通程序的一次执行：模型权重是读取的参数，中间激活是本次计算产生的数组，输出 token 是新结果。Cache 也是运行期数据，不是“模型新学到的知识”。这几种存储的区别可先读 [AI 基础第 6 节](#/article/ai-foundations?section=6)。

输入一篇长文后，模型先等一会儿才输出第一个字，随后持续生成。首段处理通常称 Prefill：计算已有输入各位置的表示与缓存；Decode 则在已有上下文上逐步产生新 token。用户看到的首 token 时间还包含网络、排队、检索与调度，不能全部归为 Prefill。

Prefill 可以对已知输入位置并行组织计算，Decode 有自回归依赖。两阶段的矩阵形状、批量与瓶颈不同，所以“每秒 token 数”不足以描述完整体验。基本生成依赖先读 [Transformer 第 5 节](#/article/ai-transformer?section=5)。

## 2. KV Cache 避免重复计算历史

普通 causal attention 中，过去 token 的 K/V 不依赖后来生成的 token，因此后续步可以保留并复用：

```text
Prefill A,B,C：保存各层 K[A..C]、V[A..C]
选择新 token D
Decode D：计算 D 的 Q/K/V
          Q_D 与历史 K 及 K_D 匹配
          聚合历史 V 及 V_D，追加缓存
```

如果不缓存，每一步都重新处理越来越长的前缀，重复工作增加。缓存换来了显存/内存和管理成本，并没有缓存掉“下一步的答案”；新 query 仍需要访问历史信息。不同模型的滑动窗口、混合层或特殊状态结构可能改变缓存规则，不能把普通全注意力公式套给所有架构。参考 [Transformers cache strategies](https://huggingface.co/docs/transformers/main/en/kv_cache)。

## 3. 用维度算清 512 MiB 从哪里来

对普通完整 KV、各层相同配置，粗略字节数为：

```text
bytes = 2 × L × B × T × Hkv × Dhead × S
```

2 对应 K 和 V；L 是层数，B 是批大小，T 是缓存 token 数，Hkv 是 KV head 数，Dhead 是每头维度，S 是每元素字节。教学参数为 L=32、B=1、T=4096、Hkv=8、Dhead=128、S=2：

```text
2 × 32 × 1 × 4096 × 8 × 128 × 2
= 536,870,912 bytes = 512 MiB
```

这不是模型总内存，尚未包含权重、激活、工作区、分配器与页表等。若 T 翻倍，普通完整缓存约翻倍；若 B 翻倍，也约翻倍。GQA 降低 Hkv，因此应使用 KV heads 而非 query heads 计数，依据 [GQA](https://arxiv.org/abs/2305.13245)。

## 4. 缓存内存管理与注意力计算优化不同

预先为每个请求分配最大长度连续缓存，短请求会浪费预留空间，长短交错还带来管理问题。PagedAttention 将逻辑 token 缓存映射到物理块，支持按需管理及适当共享，类似分页思想，但不是 CPU 虚拟内存原样搬到 GPU。尾块仍可能有未用空间，也有元数据与调度成本。见 [PagedAttention](https://arxiv.org/abs/2309.06180)。

FlashAttention 解决另一类问题：通过分块与在线 softmax 等方式减少注意力计算中对高带宽内存的读写，避免显式保存完整大分数矩阵。它是精确注意力算法的 I/O 优化，不是因为“Flash”就删掉注意力关系，也不自动消除 KV Cache。见 [FlashAttention](https://arxiv.org/abs/2205.14135)。

## 5. 相同前缀复用有严格条件

多个请求共享完全相同的 token 前缀，可能复用相应缓存，减少 Prefill；语义相似但 token 不同不能直接共用。模型权重、适配器、位置、相关配置等也必须匹配，缓存身份与隔离不能只看一段人类可读字符串。

以 [vLLM 0.8.4 Prefix Caching](https://docs.vllm.ai/en/v0.8.4/design/automatic_prefix_caching.html) 为固定实现参考，它复用匹配前缀块，主要节省前缀处理，而不是让后续 Decode 免费。服务还需考虑租户隔离、缓存淘汰与命中观测，不能把缓存当跨用户任意共享数据的理由。

## 6. 性能估算要落到真实形状

Decode 在小批量时常受权重/缓存读取影响，Prefill 常有较强矩阵计算负载，但实际瓶颈依硬件、精度、序列与批量变化。先记录输入长度、输出长度、并发、精度与模型结构，再比较首 token、token 间隔、吞吐和峰值内存。

教学实验分别改变 T、B 和 Hkv，检查缓存增量是否接近公式，再解释偏差来自窗口、分配策略或工作区。本文计算为手工演算，没有设备实测；调度与吞吐权衡继续读 [AI 服务系统](#/article/ai-serving)。

## 面试提炼

1. Prefill、Decode 与用户首 token 时间怎样区分？（第 1 节）
2. 历史 K/V 为什么能复用，Q 为什么仍要重算？（第 2 节）
3. 512 MiB 的缓存估算包含哪些维度、漏了哪些内存？（第 3 节）
4. PagedAttention 与 FlashAttention 分别优化什么？（第 4 节）
5. 前缀缓存为什么要求严格匹配，怎样验证收益？（第 5、6 节）

# Android 面经对应的 LeetCode 中国题单

更新：2026-10-06。**本批正式题单 9 道，累计上限 100 道，上限不是凑题目标。** 每题提供力扣中国题号、原题入口和中文面经出处，不复制完整题面，不在本轮增加题解代码。

使用方式：可选择任意题目直接打开力扣学习，不要求全部完成。进度和站内练习分别默认关闭；开启进度后也只跟踪用户选择的范围。仅打开原题链接不计为完成，不假定能够自动读取力扣提交结果。

本批来自 2025 年国内公司 Android/客户端面经。面试日期未明确时列页面发布时间；来源包括实习、校招和社招，不能据此宣称是资深岗位频率排名。题目用于你的资深面试准备，来源不要求带 P7 字样。

## 1. 正式题单

证据 A：原帖明确出现力扣编号或可唯一对应的力扣题名。证据 B：原帖描述可对应以下标准题，编号为整理时映射，并非作者明确报出的编号；现场完整约束仍可能有差别。

| 建议顺序 | 题号与力扣中国原题 | 难度 | 分类 | 面经来源与日期 | 对应依据 |
| --- | --- | --- | --- | --- | --- |
| 1 | [206. 反转链表](https://leetcode.cn/problems/reverse-linked-list/) | 简单 | 链表 | [猿辅导社招安卓一面](https://www.nowcoder.com/feed/main/detail/7c9f46703bb949f1bb88c4bb1ef2c564)，2025-07-19 | B：手写单链表反转 |
| 2 | [92. 反转链表 II](https://leetcode.cn/problems/reverse-linked-list-ii/) | 中等 | 链表 | [美团 Android 日常实习一面](https://www.nowcoder.com/feed/main/detail/592247f523b64d45bb0dd5f28bdfaf56)，2025-02-17 | A：明确提及力扣反转链表 2 |
| 3 | [20. 有效的括号](https://leetcode.cn/problems/valid-parentheses/) | 简单 | 栈 | [腾讯 WXG Android 实习](https://www.nowcoder.com/discuss/768228559667089408)，2025-06-27 | B：括号匹配、使用栈；按该题标准括号集练习 |
| 4 | [3. 无重复字符的最长子串](https://leetcode.cn/problems/longest-substring-without-repeating-characters/) | 中等 | 滑动窗口 | [小米云服务安卓秋招一二面](https://www.nowcoder.com/feed/main/detail/2f0777d95e974ce686abc063a75f5349)，2025-10-27 | B：最长无重复子串；题号由标准题匹配 |
| 5 | [94. 二叉树的中序遍历](https://leetcode.cn/problems/binary-tree-inorder-traversal/) | 简单 | 树、栈 | [字节 Android 面经](https://www.nowcoder.com/feed/main/detail/0bc82383dd644c88a358171c19b0c867)，2025-08-21 | B：中序遍历；面经额外要求非递归，练习保留此要求 |
| 6 | [109. 有序链表转换二叉搜索树](https://leetcode.cn/problems/convert-sorted-list-to-binary-search-tree/) | 中等 | 链表、树 | [百度暑期二面](https://www.nowcoder.com/feed/main/detail/6c2b6b3c15bc40e2b25fef6662c77988)，2025-04-08 | B：升序链表构造平衡二叉搜索树 |
| 7 | [213. 打家劫舍 II](https://leetcode.cn/problems/house-robber-ii/) | 中等 | 动态规划 | [腾讯 WXG Android 实习](https://www.nowcoder.com/discuss/768228559667089408)，2025-06-27 | A：明确提及力扣打家劫舍 II |
| 8 | [68. 文本左右对齐](https://leetcode.cn/problems/text-justification/) | 困难 | 字符串、模拟 | [腾讯 CSIG 搜索客户端暑期二面](https://www.nowcoder.com/feed/main/detail/1ef72e59544846b28458782f35399117)，2025-05-23 | A：明确提及力扣文本左右对齐 |
| 9 | [2520. 统计能整除数字的位数](https://leetcode.cn/problems/count-the-digits-that-divide-a-number/) | 简单 | 数字、模拟 | [滴滴客户端一面](https://www.nowcoder.com/feed/main/detail/3b35b2df975b4ff7a8ab9039a5f38277)，2025-05-24 | A：原帖明确题号 2520 |

顺序是练习建议，不是出现频率或重要性排名。题名、编号和难度按力扣中国页面核对；练习时以链接中的完整题面为准。

## 2. 暂不计入正式题数的条目

下面保留匹配判断，防止后续把相似题误收为原题。它们不是额外必刷题。

| 来源中的任务摘要 | 本轮处理 | 原因 |
| --- | --- | --- |
| [百度](https://www.nowcoder.com/feed/main/detail/6c2b6b3c15bc40e2b25fef6662c77988)问 LRU 的理解 | 可关联 [146. LRU 缓存](https://leetcode.cn/problems/lru-cache/)，标为“口述概念的编辑配套题” | 不能把口述机制写成现场考了力扣 146 编码题 |
| [滴滴](https://www.nowcoder.com/feed/main/detail/86945e1b47de47be83b89e8b2a98f917)提到二维螺旋数组 | 待补题意 | 不足以区分读取顺序、生成矩阵等要求 |
| [字节](https://www.nowcoder.com/feed/main/detail/0bc82383dd644c88a358171c19b0c867)字符串计数压缩 | 面试变式 | 原帖输出约定含单字符计数，不能直接认定为力扣 443 原题 |
| 同一字节原帖的下一个更大排列 | 待确认完整输入与边界 | 排列题和整数重排题的边界不同，仅靠一个例子不能确认全部约束 |
| [小米](https://www.nowcoder.com/feed/main/detail/2f0777d95e974ce686abc063a75f5349)三元组之和小于 target | 面试变式 | 不等同于力扣 15 的三数之和；返回下标、计数还是值也必须核对 |
| [飞书](https://www.nowcoder.com/discuss/808717811022311424)提到最长连续子数组 | 待补目标与约束 | 不能凭简称匹配最大子数组和或最长连续序列 |

## 3. 后续维护规则

- 检索使用“安卓面试、Android 面经、客户端面试”等宽关键词；公司、年份、社招/高级/资深作为可选扩展，不要求全部同时出现。
- 每题保存力扣题号、标题、链接、来源、公司、日期、招聘类型、匹配等级、独立面试流程数、最近核验时间。
- 同题多家公司出现时增加来源，不增加题数；同流程多轮出现也不重复统计。
- 正式题单只收编号明确或题意可可靠对应的题；口述概念配套题和变式单列。模糊简称先保留候选状态。
- 优先补充近期独立样本中重复出现的题，再补单例；有多少可靠映射收多少，不直接复制 Hot 100 作为 Android 真题。
- 达到 100 道后采用替换和归档，不继续增加活动题单。归档记录保留来源，学习主列表始终不超过 100 道。

本文件是已核验的首批可用题单，不代表算法覆盖完整，也不声称 9 道足以覆盖所有面试。后续由新增面经决定扩充内容。

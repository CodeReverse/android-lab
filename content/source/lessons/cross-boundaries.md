## 1. 从一次分享请求引出调用身份

H5 商品页调用原生分享，最初只传 `share(itemId)` 就够了。用户连续点击两次，宿主先后返回结果，Web 侧却无法知道哪次完成。跨边界首先需要关联请求与响应：

```json
{
  "protocol": 1,
  "requestId": "r-17",
  "pageSession": "page-4",
  "method": "share",
  "payload": {"itemId": "A"}
}
```

这是教学协议，非某框架标准。requestId 解决“一问一答的关联”，pageSession 表达页面实例，protocol 表达结构契约。它们都不是授权凭据。响应还应区分成功、业务失败、取消、超时和协议错误，否则调用方只能把一切归为“失败”。

## 2. 请求表怎样避免重复回调与旧页面结果

宿主异步分享时，Web 侧保存等待结果的回调。页面销毁后若不清理，回调表可能继续保留页面；新页面复用了 requestId 又可能收到旧响应。

```text
send:
  pending[(pageSession, requestId)] = completion
receive:
  如果 session 已结束：忽略界面交付
  原子取出并删除 pending[key]
  找到时才完成一次；没有则视为迟到/重复
closePage:
  结束 session，清理等待项，取消可取消的页面任务
```

伪代码中的原子操作可由同一个串行上下文实现，不能一边后台查表一边主线程清理却不做同步。超时删除等待项，只表示调用方不再等，不能撤销已经发生的分享、上传或支付。副作用的幂等键与 requestId 可以不同，必须按业务定义，见 [弱网第 3 节](#/article/network-reliability?section=3)。

## 3. 能调到 native 不意味着应该允许调用

原生桥把 Web 内容连接到宿主能力，也扩大了输入边界。`addJavascriptInterface` 可暴露给 WebView 中的 frame，不能只凭初次 loadUrl 来判断每次调用者可信。导航、iframe、第三方脚本与注入都要进入威胁模型。

宿主按能力分别校验来源、参数、当前账号与业务授权。域名校验基于解析后的 scheme/host 等结构，不用 contains；对可配置来源约束的消息 API，也要遵守它的实际契约。详细平台边界见 [WebView Native bridges](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges)。

能力应该尽量窄：允许“请求分享某商品”比允许“执行任意 native 方法名”更容易验证。敏感动作需要宿主自己的授权与必要确认，不能因为 JSON 字段写了 `trusted:true` 就跳过。

## 4. 跨线程与大载荷会把小接口变成瓶颈

桥接回调可能不在 UI 线程，平台 View 操作需切到相应线程；耗时解析、磁盘与网络又不能挤在 UI 回调里。调用协议应拆清“接收、验证、排队、执行、完成”，并限制并发、载荷大小和等待项数量。

若每秒传几十次完整列表，先评估批量增量、稳定 ID 或文件句柄，而不是只换更快的序列化库。共享内存可能减少某些复制，却需要另行管理权限、格式、同步和释放。Flutter Channel、RN Module 与 JSBridge 的工具不同，仍有这些边界；分别见 [Flutter](#/article/flutter-runtime?section=4) 与 [RN](#/article/rn-architecture?section=4)。

## 5. 能力协商比猜宿主版本更贴近需求

新页面想使用取消下载，单看宿主版本号不能保证能力已启用，渠道包或开关也可能不同。宿主可返回明确能力与协议范围：

```json
{"protocols":[1],"capabilities":{"share":1,"download.cancel":1}}
```

页面据此选择路径；可选字段应有缺省语义，破坏性改变用新版本或新能力。向后兼容不只是“JSON 解析不报错”，还包括错误码、取消、排序和副作用的语义不变。

测试矩阵至少覆盖新页面/旧宿主和旧页面/新宿主。回滚 Web 包不等于回滚宿主数据库或已执行动作，所以数据协议需要独立演进策略。

## 6. 从故障注入检验协议完整性

教学实验按顺序制造：重复响应、超时后成功、页面退出后成功、重定向后调用、不支持的方法、异常参数和过大消息。每一项都要预测等待表是否释放、界面是否更新、业务副作用是否仍存在。

例如“超时后支付成功”应进入结果查询和状态恢复，而不是简单显示失败再让用户重复支付。它暴露的不是 JSON 编解码问题，而是分布式结果不确定性。本文协议为设计示例，未声称经过安全审计或设备验证；平台使用方式见 [WebView 与 JavaScript](https://developer.android.com/develop/ui/views/layout/webapps/webview)。

## 面试提炼

1. requestId、pageSession、业务幂等键为什么不能混用？（第 1、2 节）
2. 清理等待回调为什么不能撤销已执行动作？（第 2 节）
3. 自家域名页面为什么仍需宿主能力授权？（第 3 节）
4. 大载荷优化为什么常从边界设计开始？（第 4 节）
5. 能力协商与双版本测试分别防止什么故障？（第 5、6 节）

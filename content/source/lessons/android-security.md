## 1. 从一条“打开订单”的外部链接建立边界

应用支持 `https://shop.example/orders/123` 打开订单页。能解析链接，只证明外部输入到达应用，不证明发送者有权访问订单 123。安全设计先画出输入、身份、资源和副作用：

```text
外部 Intent / URL
 → 格式与目标校验
 → 当前登录身份
 → 服务端资源授权
 → 展示允许访问的数据
```

教学域名不代表真实服务。客户端可以改善体验并拒绝明显错误，但访问订单的最终授权应在可信服务端完成。否则改一个路径 ID 就可能绕过 UI 的限制。

## 2. exported 是入口开关，不是完整授权

Activity、Service、Receiver、Provider 的暴露范围需要逐一确认。只供应用内部使用的组件不应无故暴露；确实需要其他应用访问时，按合作关系配置权限并在入口验证参数、身份和资源权限。

```xml
<!-- 教学示意：内部服务无跨应用调用需求 -->
<service
    android:name=".InternalSyncService"
    android:exported="false" />
```

如果服务必须供同签名伙伴使用，可评估签名级权限，但不要把“声明了自定义权限名”误当作已经建立强授权。默认值、目标 SDK 要求和组件类型有差异，应显式配置并测试。官方风险分析见 [导出组件的访问控制](https://developer.android.com/privacy-and-security/risks/access-control-to-exported-components)。Binder 身份的读取时机见 [Binder 第 5 节](#/article/binder?section=5)。

## 3. 校验 URL 要校验解析后的结构

`url.startsWith("https://trusted.example")` 不是可靠来源校验：字符串前缀与解析后的主机并非同一回事。应该用平台 URI/URL 解析器检查 scheme、精确 host、允许的端口与路径规则，再处理重定向；不能把字符串包含某个域名当可信。

即便 App Links 验证了域名与应用关联，也没有验证链接里业务参数的授权。一个可信网页若有脚本注入，同样可能发起恶意动作，因此“来自自家域名”不能直接换成任意 native 权限。对 WebView 原生桥应限制能力、加载来源和生命周期；`addJavascriptInterface` 的 frame 暴露边界见 [官方 Native bridges 风险说明](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges)。

## 4. 分享文件需要分享访问权，而不是整个目录

把私有文件路径直接交给其他应用，既不一定可读，也可能错误暴露更大范围。FileProvider 使用 content URI 与临时授予的访问权限，让共享对象和访问窗口更明确。

评审时沿一次“分享报告”检查：provider 的路径配置是否过宽，URI 是否只指向预期文件，授予的是读还是写，临时文件何时删除，接收者能否通过路径构造越过边界。不能为了让分享成功就开放整个私有目录。实现契约见 [安全分享文件](https://developer.android.com/training/secure-file-sharing)。

这体现最小权限：一次查看报告只需要特定文件的读权，不需要整个应用存储的读写权。权限越精确，失误或被利用时的影响范围越容易控制。

## 5. Keystore 保护密钥，不会让所有数据自动安全

若要加密本地敏感数据，可让密钥材料由 Android Keystore 管理，按用途配置使用限制。它与“把 token 字符串直接放进一个神奇保险箱”不同：通常应用仍要选择加密方案、保存密文及必要参数，并处理密钥不可用、认证变化和恢复路径。

硬件支持级别取决于设备与密钥配置，应查询相关信息，不能宣称所有密钥都由 StrongBox 保护。即使密钥不可导出，应用在授权解密后仍可能接触明文；日志、截图、崩溃上报和被滥用的解密入口仍是边界。API 与硬件说明见 [Android Keystore](https://developer.android.com/privacy-and-security/keystore)。

对称认证加密需要遵守算法的 nonce/IV 使用要求，不能复用固定 IV 来“方便调试”。不要在文章里自创密码算法；优先使用经过审查的标准方案，并按真实威胁模型验证。

## 6. 用拒绝路径检验安全设计

教学测试不只验证合法订单能打开，还应覆盖未登录、账号不匹配、伪造 host、异常编码、过大参数、无授权 URI 与桥接调用发生在页面销毁之后。预期应是拒绝或安全失败，且不泄露额外数据。

每个拒绝都应有清晰理由和最少必要日志，避免把 token、完整订单内容写入诊断数据。本文是防御设计与测试方法，没有声称完成安全审计；更完整的桥接协议见 [跨端边界](#/article/cross-boundaries)。

## 面试提炼

1. 深链可打开为什么不等于拥有业务授权？（第 1 节）
2. exported、组件权限和资源授权各保护哪一层？（第 2 节）
3. 为什么字符串前缀检查不足以校验 URL？（第 3 节）
4. FileProvider 的临时授权为什么优于开放目录？（第 4 节）
5. Keystore 的保护范围与明文使用风险分别是什么？（第 5、6 节）

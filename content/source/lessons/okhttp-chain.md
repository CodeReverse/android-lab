## 1. 从 Call 区分业务调用与网络交换

一次搜索只调用 `newCall(request)`，日志却出现两次网络请求。可能是重定向、认证后续请求或连接恢复；一个 Call 表达完成逻辑请求的任务，不保证只发生一次网络交换。

```kotlin
// 同步教学片段：在允许阻塞的工作线程执行，不能放 Android 主线程。
client.newCall(request).execute().use { response ->
    check(response.isSuccessful)
    val text = response.body?.string().orEmpty()
    consume(text) // 项目自己的解析/消费函数
}
```

`execute` 返回可读的 Response，不意味着正文已经全部下载到内存。`string()` 才读取整个正文，小响应方便，大响应可能造成内存峰值；流式数据应逐步消费。`use` 关闭响应体相关资源，避免连接不能及时回收。`consume` 也不能无限阻塞而不考虑业务截止时间。

本篇实现观察固定为 **OkHttp 4.12.0**，以可公开取得的版本源码说明，不把默认值当所有 5.x 或未来版本的保证：[RealCall](https://github.com/square/okhttp/blob/parent-4.12.0/okhttp/src/main/kotlin/okhttp3/internal/connection/RealCall.kt)。示例尚未在 Android 工程执行。

## 2. 用拦截器链解释一次请求如何逐层变换

在该版本普通 HTTP 调用中，可以沿以下顺序理解请求向内、响应向外的链：

```text
应用拦截器
  → 重试/后续请求
    → Bridge：补充协议所需头、处理相关适配
      → Cache：决定缓存、验证或访问网络
        → Connect：准备连接/交换
          → 网络拦截器
            → CallServer：实际请求响应交互
```

每一层调用 `proceed` 把请求交给下一层，拿到响应后还可处理返回值。不是先把所有拦截器调用完，最后统一发请求。可写一个应用拦截器追踪边界：

```kotlin
val timing = Interceptor { chain ->
    val start = System.nanoTime()
    try {
        chain.proceed(chain.request().newBuilder()
            .header("X-Client-Version", "demo")
            .build())
    } finally {
        recordElapsed(System.nanoTime() - start)
    }
}
```

这里的耗时止于 `proceed` 返回或抛错，不等于调用方读取整个响应体结束。`recordElapsed` 是项目记录函数，不应在网络线程做重型 I/O。若重试需要再次 proceed，前一次响应体必须按契约关闭；不能拿这个计时器当完整链路监控。

为什么区分应用与网络拦截器？应用层更适合观察一次逻辑意图，网络层需要观察实际交换及连接信息。缓存直接命中时可以不走网络链；重定向可能产生多次网络交换。把“每个交换签名”放到只执行一次的逻辑层，或把业务埋点放到每次网络交换都执行的位置，都可能得到错误语义。

## 3. Dispatcher 限流不等于线程池大小或连接数

改成 `enqueue` 后，调用方不再自己等待网络，Dispatcher 管理异步 Call 的排队与晋升。该版本的核心判断可概括为以下伪代码：

```text
遍历等待中的异步调用：
  全局运行数达到上限 → 暂停晋升
  当前 host 达到上限 → 暂不选此调用，继续考虑其他项
  否则移入运行集合，并交给 executor 执行
调用结束 → 从运行集合移除 → 再尝试晋升
```

源码中的默认上限为全局 64、每 host 5；这只是选定版本的异步调度策略，不是每台服务端最多五条 TCP 连接，更不是所有调用都被统一限制。`execute` 的同步调用由调用者线程执行，Dispatcher 虽跟踪它们，但不按这套异步等待队列限流。依据见 [Dispatcher 4.12.0](https://github.com/square/okhttp/blob/parent-4.12.0/okhttp/src/main/kotlin/okhttp3/Dispatcher.kt)。

假设全局允许 4、每 host 允许 2，同时提交 A1/A2/A3 与 B1。A3 可以等待，B1 仍可能运行；若把 executor 配得不足，又会形成另一层排队。调大 maxRequests 也不会自动提升 CPU、服务端容量或移动网络带宽，反而可能增加尾延迟。

HTTP/2 一条连接可承载多个 stream，调用并发与连接数量更不能画等号。先选资源预算，再决定调度、线程与连接策略。

## 4. 连接池复用需要兼容条件与资源归还

重复创建 OkHttpClient 会分散池和资源，无法充分复用已有连接。通常共享适当作用域的 client，再按不同需求用配置派生，但不能把具有互不兼容身份或策略的请求盲目混在一起。

池里有连接也不代表随便取一条就能用：目的地、代理、TLS 与协议等条件需要兼容，连接还需有可用承载能力。HTTP/2 的特定合并行为也受证书和路由条件约束，不等于所有域名共享一个连接。

响应体未关闭为什么影响复用？底层需要确认当前交换已结束、剩余数据如何处理以及资源是否释放。把 Response 保存到长寿命列表而一直不消费，就让连接与缓冲跟着滞留。读取整包再关闭虽然简单，也可能使大文件占用巨大内存；流式读取需把消费和关闭放进同一明确生命周期。

## 5. 把取消贯穿到回调适配和业务提交

页面退出时取消协程，不一定自动取消自己手写的 OkHttp callback。适配层需要在协程取消时调用 `call.cancel()`，并处理“回调已拿到 Response，但 continuation 不再接收”的资源释放。

```text
协程取消 → cancel Call
网络返回 → 只允许一次终结 continuation
若返回结果因取消不能交付 → 关闭 Response
若已交给消费者 → 由消费者 finally/use 关闭
```

这是资源所有权协议，不给出省略竞争处理的“万能五行适配器”。优先使用已正确实现取消的成熟适配层，再测试取消与响应同时到达的竞态。取消能尽量结束本地等待，但不能回滚服务端已经提交的操作。

最后在可控服务器设置缓存命中、302、401、延迟正文、断连和取消。分别记录 Call、交换和响应体结束，才能看懂为什么调用数、连接数、HTTP 请求数不同。未知结果与幂等见 [弱网可靠性](#/article/network-reliability?section=3)，缓存验证见 [HTTP 缓存](#/article/http-cache?section=3)。

## 面试提炼

1. 一个 Call 为什么可能有多次网络交换，Response 返回又不意味着什么？（回看第 1 节）
2. 应用与网络拦截器为何处在不同位置，计时到 proceed 返回有何盲区？（回看第 2 节）
3. Dispatcher、executor、连接池分别控制什么，同步调用有何差别？（回看第 3 节）
4. 为什么关闭响应体是连接与内存治理的一部分？（回看第 4 节）
5. 协程取消与网络回调竞争时，怎样确定 Response 的关闭责任？（回看第 5 节）

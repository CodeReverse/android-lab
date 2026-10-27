## 1. 挂起与线程阻塞

suspend 表示函数可以挂起调用链。编译器使用 Continuation 和状态机保存恢复点；真正挂起时把控制权交还调用方，将来从保存的位置继续。它不自带线程切换，也不保证内部所有操作非阻塞：在 Main 上执行阻塞文件读取，即使函数加了 suspend，仍会堵住主线程。

可以用两个挂起点理解状态机：执行到第一次需要等待时保存后续要用的局部变量与 label；恢复后从对应分支读取结果，继续到下一挂起点。某次调用也可能直接返回而不挂起。具体生成类和优化细节随 Kotlin 后端与版本变化，示意状态机不是完整反编译结果。

## 2. Context、Job 与 Dispatcher

Job 描述生命周期与父子关系，Dispatcher 决定执行调度，CoroutineName 辅助诊断；它们不是一个“线程对象”。协程恢复后可以在不同线程运行，ThreadLocal 不会自动具有正确的跨线程传播语义，需要相应上下文机制。

CPU 密集工作通常需要受控并行度；阻塞 I/O 则需要避免耗尽计算线程。Dispatchers.IO 并不让一个不可取消的底层库突然支持取消，更不意味着可以无限发起并发。业务常需要信号量或 limitedParallelism 一类方式限制资源使用，且限制对象应匹配下游容量。

## 3. 结构化并发的生命周期

coroutineScope 等待子任务完成，并将失败沿结构传播。普通子协程失败通常会取消其父和兄弟；supervisorScope 则允许子任务独立失败，但调用者仍需观察失败并决定如何降级。SupervisorJob 不是忽略异常的开关。

launch 与 async 的结果表达不同。async 把结果封装进 Deferred，但在普通父子结构中，失败仍可能立即影响父作用域，不能笼统说“直到 await 才传播”。CoroutineExceptionHandler 主要处理未捕获异常，不能把已经失败的协程恢复到原位置继续运行。需要恢复的业务逻辑应在明确边界使用 try/catch。

## 4. 取消传播与响应点

Job.cancel 改变取消状态，挂起函数在可取消点响应；长时间纯 CPU 循环应检查 isActive 或 ensureActive。任意阻塞调用可能不响应取消，必须通过库自身关闭/取消接口衔接。适配回调时，要考虑取消与成功回调同时发生，以及资源交付后尚未被使用就取消的窗口。

不要把 CancellationException 吞掉并转成普通失败后继续循环。finally 适合关闭资源；确需挂起清理时可以在严格受限的 NonCancellable 范围执行，但不能包住整段业务，否则超时与页面离开都难以终止它。

## 5. 并发请求的异常处理

页面同时请求用户和权益，二者缺一不可时可放在 coroutineScope 中并行 await；推荐位失败不应让页面失败，则应分离其失败边界。用户切换账号时取消旧 scope，同时在写入数据层前校验账号或请求代次，防止不可取消的旧回调串入新会话。

## 6. 线程与恢复时序验证

分别测试可取消 delay、纯循环和阻塞库调用，比较 cancel 后任务何时结束。再注入子任务失败，比较普通 scope 与 supervisor 的兄弟行为。使用测试调度器控制挂起时间，但真实线程竞争和阻塞行为仍需独立测试。

## 原理依据与适用边界

实现细节以项目依赖版本为准；下列资料用于核对机制。文中实验为验证设计，未声明已执行。

- [协程编译模型](https://kotlinlang.org/spec/asynchronous-programming-with-coroutines.html)
- [取消与超时](https://kotlinlang.org/docs/cancellation-and-timeouts.html)
- [异常传播](https://kotlinlang.org/docs/exception-handling.html)

## 面试提炼

以下问题用于检验理解，属于本站复习提炼；对应的机制与边界已在正文讲解。

1. suspend 是什么，挂起与阻塞线程有什么区别？（回看第 1 节）
2. CoroutineContext、Job 和 Dispatcher 分别负责什么？（回看第 2 节）
3. 协作式取消怎样传播，哪些代码不会及时响应？（回看第 4 节）
4. 并发请求、异常与取消怎样形成完整设计？（回看第 5 节）
5. 怎样验证线程、恢复点和取消时序？（回看第 6 节）

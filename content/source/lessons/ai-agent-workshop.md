## 1. 先用普通函数完成一件确定的事

本篇做一个只读的学习资料助手。用户问“Handler 为什么会保留页面”，系统在两份本地教学文档里找依据并回答。先不用真实模型、不接网络、不引入框架，目的是看清 Agent 程序究竟在执行什么；后面再说明模型如何替换确定性替身。

普通实现可以写：

```python
results = search_docs("Handler")
text = read_doc(results[0]["id"])
return text
```

这里三个步骤由程序员写死，属于工作流。它简单、便宜且可预测，适合需求始终如此的情况。若搜索没结果要改关键词、用户问缓存需要换文档、资料足够时应直接结束，就需要更丰富的分支；既可继续写规则，也可让模型提议下一步。选择模型不是因为循环本身高级，而是因为路径难以完全预写。

不熟悉“模型产生什么”的话，先读 [AI 基础第 5–8 节](#/article/ai-foundations?section=5)。

## 2. 让模型选择动作，但不要让它直接执行

给模型描述两个能力：search_docs 接收 query 返回文档 ID/标题，read_doc 接收 doc_id 返回正文。模型的下一步输出统一为三种形状：

```json
{"type":"tool","name":"search_docs","args":{"query":"Handler"}}
```

```json
{"type":"tool","name":"read_doc","args":{"doc_id":"handler"}}
```

```json
{"type":"final","text":"回答正文","citations":["handler"]}
```

这是**自定义教学协议**，不是某厂商 API 的原始消息格式。工具名、描述和参数 schema 告诉模型可选择什么；宿主收到后校验并调用真正的 Python 函数。模型输出 read_doc，并不意味着它已经读到文件；必须把工具的真实返回值送回下一轮。

## 3. 把一次任务完整走过三轮

```text
第 1 轮输入：用户问题 + 工具描述
模型提议：search_docs("Handler")
宿主观察：找到 handler 文档

第 2 轮输入：原问题 + 上轮动作与真实观察
模型提议：read_doc("handler")
宿主观察：取得正文和来源 ID

第 3 轮输入：原问题 + 两轮观察
模型提议：final，引用 handler
宿主检查：引用确实来自本轮已读文档 → 返回
```

每轮“模型看到什么”由宿主组装，不是模型凭空记住上一次工具结果。只返回标题还不足以支持内容声明，所以搜索与读取分开；小数据也可以一次直接返回正文，这是减少轮次的合理替代，代价是可能传入更多无关内容。

模型没有选对工具时，宿主可以回传结构化错误让它修正，但必须设预算。观察是外部数据，不能因为文档里写了“执行某命令”就扩大工具权限。设计依据可对照 [Building effective agents](https://www.anthropic.com/research/building-effective-agents)，下面的代码和语料均为本站原创。

## 4. 一个可运行的最小宿主循环

以下为 **Python 3 标准库完整示例**。ScriptedModel 是确定性替身，只按事先写好的步骤返回，**它不是大模型，也不验证模型会选对动作**。这样可以独立验证宿主的白名单、参数、预算和引用归属。复制整个代码块运行即可，不需要 API key。

```python
import json

DOCS = {
    "handler": {
        "title": "Handler 的页面引用",
        "text": "待执行消息可经 Runnable 保留页面；页面任务结束时应撤销相关回调。",
    },
    "cache": {
        "title": "缓存边界",
        "text": "缓存需要容量与失效策略；过期缓存不自动代表可以向用户返回旧值。",
    },
}
TOOLS = {
    "search_docs": {"field": "query", "max_length": 80},
    "read_doc": {"field": "doc_id", "max_length": 40},
}

class ProtocolError(Exception):
    pass

class ScriptedModel:
    def __init__(self, decisions):
        self.decisions = iter(decisions)

    def next(self, messages, tools):
        # 真模型适配器在这里序列化 messages / 工具 schema，并解析响应。
        return next(self.decisions)

def run(question, model, allowed_ids, max_steps=5):
    messages = [{"role": "user", "content": question}]
    trace, read_ids = [], set()
    for step in range(max_steps):
        action = model.next(messages, TOOLS)
        if not isinstance(action, dict):
            raise ProtocolError("decision must be an object")
        if action.get("type") == "final":
            text, refs = action.get("text"), action.get("citations")
            if not isinstance(text, str) or not text.strip():
                raise ProtocolError("empty answer")
            if not isinstance(refs, list) or not refs:
                raise ProtocolError("answer needs evidence")
            if any(not isinstance(r, str) or r not in read_ids for r in refs):
                raise ProtocolError("citation was not read in this task")
            # 此处只证明来源读过，不证明每句答案被原文支持。
            return {"answer": text, "citations": refs, "trace": trace}
        if (action.get("type") != "tool"
                or not isinstance(action.get("name"), str)
                or action["name"] not in TOOLS):
            raise ProtocolError("unknown action")
        name, args = action["name"], action.get("args")
        field = TOOLS[name]["field"]
        if not isinstance(args, dict) or set(args) != {field}:
            raise ProtocolError("invalid argument fields")
        value = args[field]
        if not isinstance(value, str) or not 0 < len(value) <= TOOLS[name]["max_length"]:
            raise ProtocolError("invalid argument value")
        if name == "search_docs":
            query = value.casefold()
            result = {"items": [
                {"id": key, "title": doc["title"]}
                for key, doc in DOCS.items()
                if key in allowed_ids
                and query in (doc["title"] + doc["text"]).casefold()
            ]}
        else:
            if value not in allowed_ids or value not in DOCS:
                result = {"error": "not_found_or_not_allowed"}
            else:
                result = {"id": value, "text": DOCS[value]["text"]}
                read_ids.add(value)
        call_id = f"call-{step}"
        trace.append({"call_id": call_id, "action": action, "result": result})
        # 这里是内部记录格式；生产适配器要转换为供应商要求的消息格式。
        messages.append({"role": "assistant", "tool_call_id": call_id, "action": action})
        messages.append({"role": "tool", "tool_call_id": call_id, "content": json.dumps(result, ensure_ascii=False)})
    raise ProtocolError("step budget exhausted")

steps = [
    {"type": "tool", "name": "search_docs", "args": {"query": "Handler"}},
    {"type": "tool", "name": "read_doc", "args": {"doc_id": "handler"}},
    {"type": "final", "text": "待执行回调可能保留页面，应按任务生命周期撤销。", "citations": ["handler"]},
]
if __name__ == "__main__":
    result = run("Handler 为什么会保留页面？", ScriptedModel(steps), {"handler"})
    assert len(result["trace"]) == 2
    assert result["citations"] == ["handler"]
    print(result["answer"])
```

循环中 `allowed_ids` 来自宿主，不能让模型填写它。搜索结果已按权限过滤，直接猜 ID 读取也要再次检查。`read_ids` 记录本任务真实读取过的来源，阻止模型引用未取得的文档；它没有证明回答语义正确，这是后面的验证任务。

messages 保存模型与工具往返，trace 保存可检查的动作事实。它们在示例中都在内存里，进程结束就消失；这正好暴露下一步要补的持久化责任，而不是假装已经是生产系统。

## 5. 接真实模型只替换决策端，不删除宿主约束

真实适配器将问题、历史与工具描述转成所用 API 的请求，解析文本或 tool call，并映射成上面的内部 action。工具参数可能分片返回，要等完整后再校验；消息角色和 tool_call_id 必须按供应商协议关联。流式解析见 [AI 客户端第 1–3 节](#/article/ai-client?section=1)。

工具 schema 可以帮助模型输出正确结构，但宿主仍要验证。网络失败、模型输出不合法与工具业务失败是不同错误：可重试网络故障有总截止时间，参数错误可有限次反馈，权限拒绝不能通过重试绕过。

替换真实模型后，原宿主测试仍有价值，但还要新增工具选择和任务质量评测。两者分开，才能判断失败究竟在模型决策还是执行代码。

## 6. 增加写操作时，状态恢复成为必需

如果增加“收藏文章”工具，进程可能在写入成功但记录结果前崩溃。只重放 messages 会再次执行，故必须有稳定 operationId、持久执行状态和可查询结果。读工具的教学循环不能原样升级为支付或发布系统。

```text
意图已记录 → 执行中 → 已确认成功
                    ↘ 结果未知 → 查询/同键重试
```

审批、取消和用户授权也应成为宿主状态，而不是模型一句“用户同意”就放行。完整运行时见 [Agent 第 3–4 节](#/article/ai-agent-runtime?section=3)，数据事务基础见 [Outbox](#/article/offline-data?section=3)。这一步把 AI 开发重新接到熟悉的可靠软件工程。

## 7. 验证宿主、决策与答案三层

可以先给 ScriptedModel 喂入未知工具、额外字段、未读引用和无限重复搜索，验证宿主拒绝或耗尽预算；再用真实模型测同义问题、无结果和误导文档，观察是否选择合适工具；最后检查答案声明与文档是否一致。

引用读过不等于声明受支持，测试通过也不等于模型理解了问题。用 [AI 质量](#/article/ai-quality) 分别记录工具参数、任务成功、证据支持与成本。MCP 可在工具多、服务来源多时标准化连接，Skill 可组织重复任务指导，但它们都不是这个最小闭环成立的前提，见 [工具与上下文](#/article/ai-tools-context)。

本轮已在本地执行完整代码的正常路径，以及未知工具、非字符串工具名、额外参数、未读引用、越权文档引用和步数耗尽六类拒绝用例。它只验证离线确定性宿主；真实模型决策、网络恢复、持久化、流式适配和语义正确性仍需各自验证，不用教学程序冒充生产 Agent。

## 面试提炼

1. 写死的函数调用链与 Agent 的决策循环差在哪里？（第 1–3 节）
2. 模型提议、宿主执行与工具观察为什么要分开？（第 2–4 节）
3. allowed_ids、read_ids、messages、trace 各保护什么？（第 4 节）
4. 接真实模型或增加写操作时，需要补哪些边界？（第 5、6 节）
5. 宿主测试、模型决策评测和答案验证为何不能合成一个分数？（第 7 节）

import fs from "node:fs";
import path from "node:path";
import { marked, Renderer } from "marked";

const root = path.resolve(import.meta.dirname, "..");
const read = (name) =>
  fs.readFileSync(path.join(root, "content/source", name), "utf8");
const files = {
  plan: "Android-P7-面试准备项目方案-v1.md",
  compose: "Compose-由浅到深学习路径.md",
  algorithms: "算法-LeetCodeCN面经题单.md",
  cross: "跨端技术对比与应用案例设计.md",
};
const ids = {
  plan: "project-plan",
  compose: "compose-roadmap",
  algorithms: "algorithm-list",
  cross: "cross-overview",
};
const docs = Object.fromEntries(
  Object.entries(files).map(([k, v]) => [k, read(v)]),
);
const articles = [];
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function add(id, title, category, tags, body, type = "学习指南", summary = "", metadata = {}) {
  const toc = [];
  const renderer = new Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const anchor = `heading-${toc.length}`;
    toc.push({ id: anchor, text: text.replace(/<[^>]*>/g, ""), level: depth });
    return `<h${depth} id="${anchor}">${text}</h${depth}>`;
  };
  renderer.html = ({ text }) => escape(text);
  renderer.link = function ({ href, tokens }) {
    let target = href;
    for (const [key, file] of Object.entries(files))
      if (href === `./${file}`) target = `#/article/${ids[key]}`;
    const label = this.parser.parseInline(tokens);
    if (!/^(https?:\/\/|#\/)/.test(target)) return label;
    return `<a href="${escape(target)}"${target.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  };
  const html = marked.parse(body, { renderer, gfm: true });
  const existing = articles.findIndex((a) => a.id === id);
  const article = {
    id,
    title,
    category,
    tags,
    type,
    summary:
      summary ||
      body
        .replace(/^#+ .*$/gm, "")
        .replace(/[\[\]#*|`]/g, "")
        .trim()
        .slice(0, 90),
    markdown: body,
    html,
    toc,
    inquiryCount: [...body.matchAll(/^## 第 \d+ 问：/gm)].length,
    updated: metadata.updated || "2026-10-06",
    version: metadata.version || 1,
    topic: metadata.topic || "路线与资料",
    origin: metadata.origin || "参考资料",
    related: metadata.related || [],
    sources: metadata.sources || [],
    evidence: metadata.evidence || [],
    company: metadata.company || "",
    interviewDate: metadata.interviewDate || "",
    role: metadata.role || "",
    questionCount: metadata.questionCount || 0,
    minutes: Math.max(2, Math.ceil(body.length / 650)),
    sourceFile: metadata.file || files[Object.keys(docs).find((k) => docs[k].includes(body))] || "",
  };
  if (existing >= 0) articles[existing] = article;
  else articles.push(article);
}
function section(doc, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    doc.match(
      new RegExp(
        `^${escaped}[^\\n]*\\n([\\s\\S]*?)(?=^#{1,${heading.match(/^#+/)[0].length}} |$(?![\\s\\S]))`,
        "m",
      ),
    )?.[0] || ""
  );
}
add(
  "project-plan",
  "项目方案与内容维护约定",
  "architecture",
  ["设计", "扩展", "分类"],
  docs.plan,
  "方案文档",
  "七个技术领域、五个资深能力分类，以及知识库的内容与扩展设计。",
);
add(
  "compose-roadmap",
  "Compose 由浅到深学习路径",
  "compose",
  ["State", "Snapshot", "SlotTable", "Compiler", "学习路径"],
  docs.compose,
  "学习指南",
  "11 个阶段，从正确开发到 Runtime、编译器和性能诊断。",
);
add(
  "cross-overview",
  "跨端技术：全景、取舍与 App 实践",
  "cross-platform",
  ["Flutter", "RN", "React Native", "KMP", "CMP", "JSBridge", "决策"],
  docs.cross,
  "对比与案例",
  "复用哪一层、何时适用、付出什么成本，以及公开采用案例。",
);
add(
  "algorithm-list",
  "面经对应的 LeetCode 中国题单",
  "algorithms",
  ["力扣", "LeetCode", "原题"],
  docs.algorithms,
  "原题索引",
  "9 道已核验的题目映射；明确编号、题意匹配与变式分别记录。",
);
for (let n = 2; n <= 12; n++) {
  const body = section(docs.compose, `## ${n}.`);
  if (!body) throw Error(`Missing compose chapter ${n}`);
  add(
    `compose-stage-${n - 2}`,
    body.split("\n")[0].replace(/^## \d+\. /, ""),
    "compose",
    [
      "Compose",
      "学习路径",
      ...["Snapshot", "SlotTable", "编译", "性能", "状态"].filter((t) =>
        body.includes(t),
      ),
    ],
    body,
    "学习指南",
  );
}
for (let n = 2; n <= 7; n++) {
  const body = section(docs.cross, `## ${n}.`);
  add(
    `cross-chapter-${n}`,
    body.split("\n")[0].replace(/^## \d+\. /, ""),
    "cross-platform",
    ["跨端", "决策", ...(n === 6 ? ["App", "案例"] : [])],
    body,
    n === 6 ? "应用案例" : "对比与案例",
  );
}
const outlines = [
  [
    "handler",
    "### 5.1",
    "Handler：从线程切换到等待链",
    "android",
    ["诊断", "ANR", "Looper", "消息队列"],
  ],
  [
    "coroutines",
    "### 5.2",
    "协程：从 suspend 到端到端取消",
    "languages",
    ["Coroutine", "Flow", "并发"],
  ],
  [
    "compose-interview",
    "### 5.3",
    "Compose：重组、编译器与性能证据",
    "compose",
    ["重组", "Compiler", "性能"],
  ],
  [
    "performance-proof",
    "### 5.4",
    "性能：如何证明一次优化有效",
    "performance",
    ["指标", "证据", "归因"],
  ],
  [
    "cross-boundaries",
    "### 5.5",
    "跨端：协议、通信与生命周期",
    "cross-platform",
    ["Flutter", "JSBridge", "生命周期"],
  ],
  [
    "ai-client",
    "### 5.6",
    "AI 客户端：从聊天界面到系统约束",
    "ai",
    ["RAG", "Agent", "流式", "网络"],
  ],
];
for (const [id, h, title, cat, tags] of outlines) {
  const body = section(docs.plan, h);
  add(
    id,
    title,
    cat,
    tags,
    body,
    "追问提纲",
    "以面经问题为起点，沿执行机制、故障与技术取舍继续追问。",
  );
}
add(
  "project-evidence",
  "个人项目成果与证据模板",
  "evidence",
  ["个人贡献", "性能", "架构", "项目"],
  section(docs.plan, "## 7."),
  "案例模板",
  "用背景、约束、备选方案、个人贡献和测量口径组织真实项目。",
);
add(
  "content-depth",
  "一个问题如何从浅入深",
  "decisions",
  ["L0", "L5", "证据", "决策"],
  section(docs.plan, "## 4."),
  "学习指南",
  "理解分层回答、原理、故障证据和长期治理的内容结构。",
);
add(
  "interview-sources",
  "近期中文面经与来源边界",
  "android",
  ["牛客", "面经", "腾讯", "字节", "小米", "美团"],
  section(docs.plan, "## 2."),
  "面经索引",
  "按独立流程记录来源，区分原帖提问和技术答案核验。",
);
add(
  "network-syllabus",
  "网络全链路：专题学习提纲",
  "network",
  ["DNS", "TCP", "TLS", "HTTP", "OkHttp", "弱网"],
  `## 学习边界\n本篇是待扩充的专题提纲，尚不是经完整源码与实验核验的标准答案。\n\n## 从请求过程组织复习\n1. DNS 解析、缓存和失效。\n2. TCP 建连与连接复用，TLS 身份认证与握手。\n3. HTTP 缓存、连接池、超时、重试与幂等。\n4. OkHttp 调度器、拦截器、连接和取消的边界。\n5. 弱网下的数据一致性与离线恢复。\n\n## 继续追问\n- 一次超时发生在哪一阶段，需要哪些证据？\n- 重试为何可能重复执行服务端操作？\n- UI 退出如何传递取消？如何拒绝过期响应？\n- 如何证明网络优化改善了用户体验？\n\n## 后续核验入口\n- [OkHttp 官方文档](https://square.github.io/okhttp/)\n- [HTTP 语义规范 RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)\n`,
  "追问提纲",
  "DNS → TCP/TLS → HTTP → OkHttp → 弱网。按链路复习，正文待逐步完善。",
);
const algo = [];
for (const line of docs.algorithms
  .split("\n")
  .filter((l) => /^\| [1-9] \|/.test(l))) {
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((s) => s.trim());
  const q = cells[1].match(/\[(\d+)\. (.*?)\]\((.*?)\)/);
  const src = cells[4].match(/\[(.*?)\]\((.*?)\)/);
  algo.push({
    number: Number(q[1]),
    title: q[2],
    url: q[3],
    difficulty: cells[2],
    category: cells[3],
    company: src[1],
    source: src[2],
    date: cells[4].match(/\d{4}-\d{2}-\d{2}/)?.[0],
    evidence: cells[5],
  });
}
// Editors may add content without modifying app components.
const extra = path.join(root, "content/articles.json");
if (fs.existsSync(extra))
  for (const x of JSON.parse(fs.readFileSync(extra, "utf8")))
    add(x.id, x.title, x.category, x.tags, read(x.file), x.type, x.summary, x);
const categories = JSON.parse(
  fs.readFileSync(path.join(root, "content/categories.json"), "utf8"),
);
const categoryIds = new Set(categories.map((c) => c.id));
const seen = new Set();
for (const a of articles) {
  if (seen.has(a.id) || !categoryIds.has(a.category))
    throw Error(`Invalid content metadata ${a.id}`);
  seen.add(a.id);
}
for (const a of articles) {
  for (const linked of a.related) {
    if (!seen.has(linked)) throw Error(`Missing related article ${a.id} -> ${linked}`);
  }
  if (["学习文章", "面经详解"].includes(a.type) && (!a.topic || !a.sources.length || a.markdown.length < 1200))
    throw Error(`Incomplete lesson ${a.id}`);
  if (a.type === "面经详解" && (!a.evidence.length || a.questionCount !== [...a.markdown.matchAll(/^## \d+\. /gm)].length))
    throw Error(`Interview answer count mismatch ${a.id}`);
  const inquiries = [...a.markdown.matchAll(/^## 第 (\d+) 问：[^\n]+\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  if (a.inquiryCount !== inquiries.length || inquiries.some((q, i) => Number(q[1]) !== i + 1 || q[2].trim().length < 60))
    throw Error(`Incomplete or unordered question answers ${a.id}`);
  for (const match of a.markdown.matchAll(/\]\(#\/article\/([^)]*)\)/g)) {
    if (!seen.has(match[1])) throw Error(`Broken article link ${a.id} -> ${match[1]}`);
  }
}
const registry = JSON.parse(fs.readFileSync(extra, "utf8"));
if (new Set(registry.map((a) => a.id)).size !== registry.length)
  throw Error("Duplicate article registry ID");
const paths = JSON.parse(fs.readFileSync(path.join(root, "content/learning-paths.json"), "utf8"));
for (const route of Object.values(paths)) {
  if (!categoryIds.has(route.category)) throw Error(`Invalid reading path category ${route.category}`);
  for (const id of [route.overview, ...route.core, ...Object.keys(route.stages), ...Object.values(route.stages).flat(), ...route.tracks.flatMap((track) => track.articles)])
    if (!seen.has(id)) throw Error(`Missing reading path article ${id}`);
}
const aiResearch = JSON.parse(fs.readFileSync(path.join(root, "content/ai-research.json"), "utf8"));
for (const source of aiResearch.sources) {
  const answer = articles.find((a) => a.id === source.answerArticle);
  if (!answer || answer.type !== "面经详解" || answer.questionCount !== source.selectedItems.length ||
    !answer.evidence.some((e) => e.url === source.url))
    throw Error(`AI interview scope mismatch ${source.id}`);
}
articles.sort((a, b) => Number(b.type === "学习文章") - Number(a.type === "学习文章"));
if (new Set(categories.map((c) => c.id)).size !== categories.length)
  throw Error("Duplicate category");
if (algo.length > 100) throw Error("Algorithm list exceeds 100");
fs.writeFileSync(
  path.join(root, "content/generated.json"),
  JSON.stringify(
    { articles, algorithms: algo, updated: articles.map((a) => a.updated).sort().at(-1), edition: "AI 与端侧工程扩展版", lessonCount: articles.filter((a) => a.type === "学习文章").length },
    null,
    2,
  ),
);
fs.mkdirSync(path.join(root, "public/documents"), { recursive: true });
for (const [key, file] of Object.entries(files))
  fs.copyFileSync(
    path.join(root, "content/source", file),
    path.join(root, "public/documents", `${ids[key]}.md`),
  );
console.log(
  `Content: ${articles.length} entries, ${categories.length} categories, ${algo.length} algorithms`,
);

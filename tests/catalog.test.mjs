import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { categoryContent, filterCatalog } from "../lib/catalog.ts";
import { initialState, setProgress, searchArticles } from "../lib/model.ts";
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../content/${name}`, import.meta.url)));
const { articles } = read("generated.json");
const categories = read("categories.json");
const paths = read("learning-paths.json");

test("network owns network lessons; coroutine, AI and interview collections remain separate", () => {
  const network = categoryContent(articles, categories, "network");
  assert.equal(network.filter((a) => a.type === "学习文章").length, 5);
  assert.ok(network.every((a) => a.category === "network"));
  assert.ok(!network.some((a) => ["coroutines", "ai-client"].includes(a.id)));
  assert.ok(network.find((a) => a.id === "okhttp-chain").related.includes("coroutines"));
  assert.equal(categories.filter((c) => !c.hidden).length, 12);
  assert.ok(categoryContent(articles, categories, "interviews").every((a) => a.type === "面经详解"));
});

test("new nested categories work without adding hard-coded subject relations", () => {
  const cats = [{ id: "new" }, { id: "sub", parent: "new" }, { id: "leaf", parent: "sub" }, { id: "elsewhere" }];
  const items = [{ id: "a", category: "leaf" }, { id: "b", category: "elsewhere", related: ["a"] }];
  assert.deepEqual(categoryContent(items, cats, "new").map((a) => a.id), ["a"]);
  assert.deepEqual(categoryContent(items, cats, "unknown"), []);
});

test("topic and evidence filters combine and full-text search reaches mechanisms", () => {
  const network = categoryContent(articles, categories, "network");
  assert.deepEqual(filterCatalog(network, { kind: "学习文章", topic: "HTTP 与缓存", origin: "面经 + 岗位必修" }).map((a) => a.id), ["http-cache"]);
  assert.equal(filterCatalog(network, { kind: "学习文章", topic: "HTTP 与缓存", origin: "岗位必修" }).length, 0);
  assert.ok(searchArticles(articles, "StateRecord").some((a) => a.id === "compose-snapshot"));
  assert.ok(searchArticles(articles, "MMKV").some((a) => a.id === "interview-metaapp-2026"));
});

test("reading paths, related articles and in-body links point to existing content", () => {
  const ids = new Set(articles.map((a) => a.id));
  for (const path of Object.values(paths)) {
    for (const id of [path.overview, ...path.core, ...Object.keys(path.stages), ...Object.values(path.stages).flat(), ...path.tracks.flatMap((t) => t.articles)]) assert.ok(ids.has(id), id);
    for (const id of path.core) assert.equal(articles.find((a) => a.id === id).type, "学习文章");
  }
  for (const a of articles) {
    for (const id of a.related) assert.ok(ids.has(id), `${a.id} -> ${id}`);
    for (const [, id] of a.markdown.matchAll(/\]\(#\/article\/([^)]*)\)/g)) assert.ok(ids.has(id), `${a.id} -> ${id}`);
  }
});

test("interview answers retain source scope and distinguish original items from editorial follow-ups", () => {
  const expected = { "interview-meituan-2025": 20, "interview-xiaomi-2025": 23, "interview-metaapp-2026": 6, "interview-ai-infra-byte": 6, "interview-ai-tencent": 4, "interview-ai-agent-byte": 8, "interview-ai-qwen": 8 };
  for (const [id, count] of Object.entries(expected)) {
    const a = articles.find((x) => x.id === id);
    assert.equal(a.questionCount, count);
    assert.equal([...a.markdown.matchAll(/^## \d+\. /gm)].length, count);
    assert.equal([...a.markdown.matchAll(/^### 参考回答$/gm)].length, count);
    assert.equal([...a.markdown.matchAll(/^### 原理与继续追问（编辑扩展）$/gm)].length, count);
    assert.ok(a.evidence.every((e) => new URL(e.url).hostname === "www.nowcoder.com"));
    assert.ok(a.role && a.interviewDate && a.sources.length);
  }
});

test("AI paths cover all AI lessons, with interview collections linked but not reclassified", () => {
  const ai = categoryContent(articles, categories, "ai");
  const readings = new Set([paths.ai.overview, ...paths.ai.tracks.flatMap((t) => t.articles)]);
  for (const a of ai.filter((a) => a.type === "学习文章")) assert.ok(readings.has(a.id), a.id);
  for (const id of readings) {
    const a = articles.find((a) => a.id === id);
    assert.ok(a.category === "ai" || (a.category === "interviews" && a.role === "AI 专项节选"), id);
  }
  assert.ok(ai.every((a) => a.type !== "面经详解"));
  const filters = { kind: "学习文章", topic: "端侧架构与部署", origin: "岗位必修" };
  assert.deepEqual(filterCatalog(ai, filters).map((a) => a.id).sort(), ["ai-edge-architecture", "ai-edge-runtime"]);
  assert.ok(searchArticles(ai, "HNSW").some((a) => a.id === "ai-retrieval"));
  assert.ok(searchArticles(ai, "512 MiB").some((a) => a.id === "ai-inference"));
  assert.ok(searchArticles(ai, "PTQ").some((a) => a.id === "ai-quantization"));
  const state = initialState();
  assert.equal(state.settings.progress, false);
  assert.equal(state.settings.practice, false);
  assert.deepEqual(state.progress, {});
});

test("AI evidence records match selected original items and retain uncertain dates", () => {
  const research = read("ai-research.json");
  for (const source of research.sources) {
    const answer = articles.find((a) => a.id === source.answerArticle);
    assert.equal(source.selectedItems.length, answer.questionCount);
    assert.equal(new Set(source.selectedItems).size, source.selectedItems.length);
    assert.ok(answer.evidence.some((e) => e.url === source.url));
    assert.ok(answer.markdown.includes("收录范围：仅展开原帖"));
    assert.ok(answer.summary.includes("节选"));
    for (const item of source.selectedItems) assert.match(answer.markdown, new RegExp(`原帖位置：[^\\n]*第 ${item} 项`));
    assert.ok(source.dateEvidence);
  }
  const uncertain = research.sources.find((s) => s.id === "agent");
  assert.equal(uncertain.publishedAt, null);
  assert.match(articles.find((a) => a.id === uncertain.answerArticle).interviewDate, /年份未明确核验/);
});

test("Compose stages link knowledge points to actual answers with valid question numbers", () => {
  const byId = new Map(articles.map((a) => [a.id, a]));
  assert.equal(Object.keys(paths.compose.stages).length, 11);
  for (const [stageId, readings] of Object.entries(paths.compose.stages)) {
    const stage = byId.get(stageId);
    const mappingRows = [...stage.markdown.matchAll(/^\| [^\n]+ \| \[[^\]]+\]\(#\/article\/([^)]*)\) \| 第 ([\d、–]+) 问 \|$/gm)];
    assert.ok(mappingRows.length > 0, `${stageId} needs a knowledge-to-answer mapping`);
    assert.deepEqual(new Set(mappingRows.map((row) => row[1])), new Set(readings));
    for (const [, id, range] of mappingRows) {
      const lesson = byId.get(id);
      assert.equal(lesson?.type, "学习文章", `${id} must be an article, not an outline`);
      assert.equal(lesson.category, "compose");
      for (const num of range.match(/\d+/g).map(Number)) {
        assert.ok(num >= 1 && num <= lesson.inquiryCount, `${stageId} links missing question ${id}/${num}`);
      }
      assert.ok(lesson.sources.length > 0, `${id} needs principle sources`);
    }
  }
  for (const id of ["compose-foundations", "compose-components", "compose-layout", "compose-graphics-animation", "compose-input", "compose-lazy", "compose-performance", "compose-testing", "compose-navigation", "compose-interop"]) {
    assert.ok(Object.values(paths.compose.stages).flat().includes(id), `${id} must be reachable from a stage`);
  }
});

test("technical lessons expose ordered, answered question chains across subjects", () => {
  const technical = new Set(["android", "network", "languages", "compose", "cross-platform", "ai", "diagnosis", "performance"]);
  const maps = new Set(["ai-roadmap", "runtime-roadmap"]);
  for (const a of articles.filter((a) => a.type === "学习文章" && technical.has(a.category) && !maps.has(a.id))) {
    const questions = [...a.markdown.matchAll(/^## 第 (\d+) 问：([^\n]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
    assert.ok(questions.length >= 4, a.id);
    assert.equal(a.inquiryCount, questions.length);
    questions.forEach((q, i) => {
      assert.equal(Number(q[1]), i + 1, a.id);
      assert.ok(q[3].trim().length >= 60, `${a.id} question ${i + 1} has an answer`);
      assert.ok(a.toc.some((h) => h.text === `第 ${i + 1} 问：${q[2]}`), `${a.id} question in TOC`);
    });
  }
  const expected = { "jvm-runtime": "languages", "java-threads": "languages", "java-locks": "languages", "gc-runtime": "languages", "handler": "android", "memory-art": "android", "oom-diagnosis": "diagnosis" };
  for (const [id, category] of Object.entries(expected)) {
    const a = articles.find((a) => a.id === id);
    assert.equal(a.category, category);
    assert.ok(a.inquiryCount >= 9, id);
    assert.ok(paths.runtime.core.includes(id));
  }
  assert.ok(searchArticles(articles, "Metaspace").some((a) => a.id === "jvm-runtime"));
  assert.ok(searchArticles(articles, "happens-before").some((a) => a.id === "jmm-concurrency"));
});

test("expanded old articles keep bookmark, note and selected progress IDs", () => {
  const state = initialState();
  state.settings.progress = true;
  state.bookmarks = ["handler"];
  state.notes.handler = "个人旧笔记";
  const saved = setProgress(state, "handler", 1, "已掌握");
  const updated = articles.find((a) => a.id === "handler");
  assert.equal(updated.type, "学习文章");
  assert.ok(updated.version > saved.progress.handler.version);
  assert.equal(saved.notes[updated.id], "个人旧笔记");
  assert.ok(saved.bookmarks.includes(updated.id));
  assert.equal(Object.keys(saved.progress).length, 1);
});

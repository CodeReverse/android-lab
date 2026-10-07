import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  initialState,
  setProgress,
  savePractice,
  validateState,
  mergedCategories,
  searchArticles,
} from "../lib/model.ts";
const data = JSON.parse(
  fs.readFileSync(new URL("../content/generated.json", import.meta.url)),
);
test("four switch combinations do not leak progress or practice writes", () => {
  const record = {
    id: "practice",
    articleId: "handler",
    question: "why?",
    answer: "answer",
    score: 2,
    seconds: 1,
    date: "2026-10-06",
  };
  for (const p of [false, true])
    for (const q of [false, true]) {
      const s = initialState();
      s.settings.progress = p;
      s.settings.practice = q;
      s.settings.savePractice = true;
      assert.equal(
        Object.keys(setProgress(s, "handler", 1, "已掌握").progress).length,
        p ? 1 : 0,
      );
      assert.equal(savePractice(s, record).practice.length, q ? 1 : 0);
      assert.equal(Object.keys(savePractice(s, record).progress).length, 0);
    }
  const s = initialState();
  s.settings.practice = true;
  assert.equal(savePractice(s, record).practice.length, 0);
});
test("category rename does not change content or progress identity", () => {
  const s = setProgress(
    {
      ...initialState(),
      settings: { ...initialState().settings, progress: true },
    },
    "handler",
    1,
    "学习中",
  );
  const base = [{ id: "android", name: "Android", order: 1 }];
  const next = mergedCategories(base, [
    { id: "android", name: "安卓", order: 99 },
  ]);
  assert.equal(next[0].id, "android");
  assert.equal(s.progress.handler.status, "学习中");
  assert.equal(next.length, 1);
});
test("invalid backup, oversized note, and hierarchy cycles are rejected", () => {
  assert.throws(() => validateState({ schemaVersion: 2 }));
  assert.throws(() =>
    validateState({ ...initialState(), notes: { a: "x".repeat(100001) } }),
  );
  const category = (id, parent) => ({
    id,
    parent,
    name: id,
    group: "技术知识",
    description: "",
    topics: [],
    icon: "",
    order: 1,
  });
  assert.throws(() =>
    validateState({
      ...initialState(),
      categories: [category("a", "b"), category("b", "a")],
    }),
  );
  assert.deepEqual(validateState(initialState()), initialState());
});
test("content is complete, searchable, and canonical links are preserved", () => {
  assert.equal(data.algorithms.length, 9);
  assert.equal(
    data.articles.filter((a) => a.id.startsWith("compose-stage-")).length,
    11,
  );
  assert.equal(
    new Set(data.articles.map((a) => a.id)).size,
    data.articles.length,
  );
  for (const a of data.articles) {
    assert.ok(a.markdown.length > 100, a.id);
    assert.ok(a.html.length > 100, a.id);
    assert.ok(a.toc.length, a.id);
  }
  assert.ok(searchArticles(data.articles, "Snapshot").length);
  assert.ok(searchArticles(data.articles, "状态").length);
  assert.equal(
    searchArticles(data.articles, "completelynonexistent").length,
    0,
  );
  assert.ok(
    data.articles
      .find((a) => a.id === "project-plan")
      .html.includes("#/article/compose-roadmap"),
  );
});

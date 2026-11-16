import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArticleRoute, articleSectionAnchor } from "../lib/article-route.ts";

test("chapter routes keep article identity and accept direct hash entry", () => {
  for (const route of ["article/compose-snapshot?section=5", "#/article/compose-snapshot?section=5", "/article/compose-snapshot?section=5"]) {
    assert.deepEqual(parseArticleRoute(route), { id: "compose-snapshot", section: 5 });
  }
  assert.deepEqual(parseArticleRoute("article/compose-state"), { id: "compose-state" });
  for (const route of ["home", "article/../a", "article/a?section=0", "article/a?section=-1", "article/a?section=1.5", "article/a?section=x", "article/a?section=", "article/a?section=1&section=2", "article/a?other=2", "article/a?section=99999999999999999999"]) {
    assert.equal(parseArticleRoute(route), null, route);
  }
});

test("chapter lookup uses numbered H2 rather than generated TOC position", () => {
  const toc = [{ id: "heading-0", level: 1, text: "Title" }, { id: "heading-1", level: 2, text: "1. First" }, { id: "heading-2", level: 3, text: "2. Nested" }, { id: "heading-3", level: 2, text: "2. Second" }];
  assert.equal(articleSectionAnchor(toc, 2), "heading-3");
  assert.equal(articleSectionAnchor(toc, 3), undefined);
  assert.equal(articleSectionAnchor(toc), undefined);
});

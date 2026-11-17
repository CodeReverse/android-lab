import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripRepeatedTitle } from '../lib/article-body.ts';
test('extracted chapter titles appear once without removing real content sections', () => {
  assert.equal(stripRepeatedTitle('## 2. 阶段 0：起点\n\n正文\n', '阶段 0：起点'), '正文\n');
  assert.equal(stripRepeatedTitle('# 全文标题\n\n## 1. 概念\n正文', '全文标题'), '## 1. 概念\n正文');
  assert.equal(stripRepeatedTitle('## 1. 原理\n\n正文', '学习指南'), '## 1. 原理\n\n正文');
  assert.equal(stripRepeatedTitle('正文\n## 1. 原理', '原理'), '正文\n## 1. 原理');
});
test('all standalone Compose stages omit source outline numbering and empty TOCs', () => {
  const {articles} = JSON.parse(fs.readFileSync(new URL('../content/generated.json', import.meta.url)));
  const stages = articles.filter(a => a.id.startsWith('compose-stage-'));
  assert.equal(stages.length, 11);
  for (const a of stages) {
    assert.ok(a.markdown.startsWith('本阶段重点：'), a.id);
    assert.ok(!a.html.includes(`<h2`), a.id);
    assert.equal(a.toc.length, 0, a.id);
    assert.ok(a.html.includes('<table>'), a.id);
  }
});

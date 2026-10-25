import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { z } from 'zod';

export const digest = (text) => createHash('sha256').update(text).digest('hex');
export function allowedUrl(value, domains) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !domains.some(d => u.hostname === d || u.hostname.endsWith(`.${d}`))) throw Error('来源地址不在允许范围');
  return u;
}
export function canonicalUrl(value, domains) {
  const u = allowedUrl(value, domains);
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|spm$|from$|track|source$|sourceSSR$|urlSource$)/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.href;
}
export async function fetchPublic(value, domains, fetcher = fetch) {
  let url = allowedUrl(value, domains).href;
  for (let i = 0; i < 4; i++) {
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'AndroidLabResearch/1.0 (+https://github.com/CodeReverse/android-lab)' } });
    if ([301,302,303,307,308].includes(response.status)) {
      url = allowedUrl(new URL(response.headers.get('location'), url).href, domains).href;
      continue;
    }
    if (!response.ok) throw Error(`来源访问失败 HTTP ${response.status}（不绕过登录或验证）`);
    const reader = response.body.getReader(); let total = 0; const chunks = [];
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > 2500000) throw Error('来源页面超过读取上限'); chunks.push(value); }
    } finally { await reader.cancel(); }
    return { url, text: Buffer.concat(chunks).toString('utf8') };
  }
  throw Error('来源重定向过多');
}
export function parseSearch(xml, domains) {
  const $ = load(xml, { xmlMode: true }); const result = [];
  $('item').each((_, e) => {
    try { result.push({ url: canonicalUrl($(e).find('link').text(), domains), title: $(e).find('title').text().slice(0,200) }); } catch { /* Search snippets never become sources. */ }
  });
  return [...new Map(result.map(r => [r.url, r])).values()];
}
export function extractPage(html) {
  const $ = load(html);
  const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || $('title').text();
  let publishedAt = null;
  for (const v of [$('meta[property="article:published_time"]').attr('content'), $('meta[name="publishdate"]').attr('content'), $('time[itemprop="datePublished"]').first().attr('datetime')]) {
    if (v && /^\d{4}-\d{2}-\d{2}/.test(v) && Number.isFinite(Date.parse(v))) { publishedAt = v.slice(0,10); break; }
  }
  let jsonBody = '';
  const articleNodes=[];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const obj=JSON.parse($(el).text()); const nodes=Array.isArray(obj)?obj:obj['@graph']||[obj];
      for (const n of nodes) if (/Article|Posting/.test(n['@type'] || '')) articleNodes.push(n);
    } catch { /* A malformed metadata block is not evidence. */ }
  });
  if (articleNodes.length===1) {
    const n=articleNodes[0];
    if(typeof n.articleBody==='string') jsonBody=n.articleBody;
    if(!publishedAt && /^\d{4}-\d{2}-\d{2}/.test(n.datePublished||'') && Number.isFinite(Date.parse(n.datePublished))) publishedAt=n.datePublished.slice(0,10);
  }
  $('script,style,nav,footer,header,aside,noscript').remove();
  $('br').replaceWith('\n'); $('p,li,h2,h3').append('\n');
  const selectors=['.feed-content-text','#content_views','.devsite-article-body','.article-content','.markdown-body','article','main'];
  let text=jsonBody;
  if (!text) for (const selector of selectors) { const candidate=$(selector).first().text().trim(); if (candidate.length>150) { text=candidate; break; } }
  // Do not use the entire page: recommendations/comments can contain unrelated interviews.
  text=text.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  return { title:title.trim().slice(0,200), text:text.slice(0,22000), publishedAt, dateEvidence:publishedAt?'原页面发布元数据':'未核验发布时间；不能把搜索收录或抓取时间当面试日期' };
}
export function eligible(page, config, now = new Date()) {
  if (page.text.length < 180 || !/[\u3400-\u9fff]/.test(page.text) || !/面试|面经|一面|二面|三面/.test(page.title+' '+page.text)) return '未取得可核验的中文面经正文';
  if (!config.companies.some(c => (page.title+' '+page.text).includes(c))) return '尚未确认国内互联网公司归属';
  if (page.publishedAt) {
    const age=(now-Date.parse(page.publishedAt))/86400000;
    if (age < -1 || age > config.lookbackDays) return '发布时间不在设定范围';
  }
  return '';
}
export const extractionSchema=z.object({
  company:z.string().min(1).max(40), topic:z.string().min(2).max(80), category:z.string().min(1),
  questions:z.array(z.object({summary:z.string().min(6).max(150),quote:z.string().min(3).max(40)})).min(1).max(3),
});
export function validateExtraction(raw, page, categories, config) {
  const data=extractionSchema.parse(raw);
  if (!categories.some(c=>c.id===data.category && !c.hidden && c.id!=='algorithms')) throw Error('分类无效或不适合自动正文');
  if (!config.companies.includes(data.company) || !(page.title+' '+page.text).includes(data.company)) throw Error('公司证据不足');
  const owners=Object.entries(config.topicOwnership || {}).filter(([,terms])=>terms.some(t=>data.topic.toLowerCase().includes(t.toLowerCase()))).map(([category])=>category);
  if (owners.length===1 && owners[0]!==data.category) throw Error(`知识点应归入 ${owners[0]}，分类需要核验`);
  const normalized=page.text.replace(/\s/g,'');
  for (const q of data.questions) if (!normalized.includes(q.quote.replace(/\s/g,''))) throw Error('原题证据不在正文中');
  return data;
}
export const draftSchema=z.object({
  title:z.string().min(8).max(120), summary:z.string().min(30).max(250),
  sections:z.array(z.object({question:z.string().min(5).max(150),answer:z.string().min(180).max(5000)})).min(6).max(12),
  answers:z.array(z.object({sourceQuestion:z.number().int().min(1).max(3),answer:z.string().min(180).max(3000)})).min(1).max(3),
  references:z.array(z.object({url:z.string().url(),supports:z.string().min(10).max(250)})).min(1).max(5),
  versionScope:z.string().min(20).max(700), exercise:z.string().min(120).max(1800),
});
export function validateDraft(raw, extraction, references) {
  const data=draftSchema.parse(raw);
  const covered=new Set(data.answers.map(x=>x.sourceQuestion));
  if (covered.size!==extraction.questions.length || data.answers.length!==covered.size || [...covered].some(n=>n>extraction.questions.length)) throw Error('面经问题未逐项解答');
  for (const ref of data.references) if (!references.some(r=>r.url===ref.url && r.text.length>=150)) throw Error('引用没有可读原理证据');
  const generated=[data.title,data.summary,data.versionScope,...data.sections.flatMap(x=>[x.question,x.answer]),...data.answers.map(x=>x.answer),data.exercise].join('\n');
  if (/https?:\/\/|^#{1,2} |<script|javascript:/im.test(generated)) throw Error('正文含未核验链接或非法结构');
  if (data.sections.reduce((s,x)=>s+x.answer.length,0)<1800) throw Error('正文深度不足');
  return data;
}
export function renderDraft(id, extraction, data, candidate, now) {
  const esc=s=>s.replace(/[<>]/g,'').replace(/[\r\n]+/g,' ');
  let md=`## 阅读方式与讨论边界\n\n由公开面经选题、AI 辅助生成，尚需技术核验。核验后发布也不等于完成设备实验。采集：${now}；发布时间：${candidate.publishedAt || '未核验'}；面试日期：未独立核验。${esc(data.versionScope)}\n\n`;
  md+='## 面经问题与对应答案\n\n以下为原题意图概述，非逐字转录；后续连续问答属于编辑设计，不代表公司原题。\n\n';
  for (const [i,q] of extraction.questions.entries()) md+=`### 原题概述 ${i+1}：${esc(q.summary)}\n\n${data.answers.find(a=>a.sourceQuestion===i+1).answer}\n\n`;
  for (const [i,s] of data.sections.entries()) md+=`## 第 ${i+1} 问：${esc(s.question)}\n\n${s.answer}\n\n`;
  md+=`## 验证设计（未执行）\n\n${data.exercise}\n\n## 原理依据\n\n`;
  for (const r of data.references) md+=`- [原理资料](${r.url})：${esc(r.supports)}\n`;
  md+=`\n## 面经来源与事实边界\n\n- [原帖](${candidate.url})：${esc(candidate.title)}。${candidate.dateEvidence}。这里只证明主题被提及，不证明本文所有追问都被问过，也不据此计算行业频率。\n`;
  return {markdown:md,metadata:{id,title:data.title,category:extraction.category,topic:extraction.topic,tags:[extraction.topic,'面经拓展','AI 辅助'],summary:data.summary,file:`lessons/${id}.md`,type:'学习文章',origin:'面经 + 岗位必修',version:1,related:[],sources:data.references.map(r=>({title:r.supports,url:r.url})),evidence:[{title:candidate.title,url:candidate.url,claim:extraction.questions.map(q=>q.summary).join('；')}],updated:now}};
}

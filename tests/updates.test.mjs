import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedUrl, canonicalUrl, fetchPublic, parseSearch, extractPage, eligible, validateExtraction, validateDraft, renderDraft } from '../scripts/updates/core.mjs';
const domains=['nowcoder.com'];
const config={companies:['腾讯'],lookbackDays:730};
const categories=[{id:'android',hidden:false},{id:'interviews',hidden:true}];
const page={title:'腾讯 Android 面试',text:'Handler 线程切换怎样实现？'.repeat(30),publishedAt:'2026-10-10'};
const extraction={company:'腾讯',topic:'Handler',category:'android',questions:[{summary:'解释 Handler 的线程切换过程',quote:'Handler 线程切换怎样实现？'}]};
const ref={url:'https://developer.android.com/example',text:'a'.repeat(200)};
function generated(){return {title:'Handler：线程切换与消息队列原理',summary:'这是通过面经问题归纳的原创主题说明，用以说明消息队列和线程切换的学习范围。',versionScope:'具体实现需核对使用的 Android API 版本，实验还没有运行。',answers:[{sourceQuestion:1,answer:'解释线程切换依赖目标线程运行消息循环，调用方只负责入队。'.repeat(10)}],sections:Array.from({length:6},(_,i)=>({question:`第${i}层的具体运行原理是什么？`,answer:'这是机制讲解，说明责任、输入、执行、限制和需要实际验证的条件。'.repeat(12)})),references:[{url:ref.url,supports:'对应解释线程和消息分发的官方契约。'}],exercise:'在固定 Android 版本下设计消息时序实验，分别记录发送线程和处理线程；这里未执行，不提供虚构测量。'.repeat(4)}}
test('update fetch restricts source hosts, schemes, redirects, and payload sizes',async()=>{
 for(const url of ['http://www.nowcoder.com/a','https://nowcoder.com.evil.test/a','https://user:pass@www.nowcoder.com/a','https://127.0.0.1/a'])assert.throws(()=>allowedUrl(url,domains));
 await assert.rejects(()=>fetchPublic('https://www.nowcoder.com/a',domains,async()=>new Response('',{status:302,headers:{location:'http://169.254.169.254/'}})));
 await assert.rejects(()=>fetchPublic('https://www.nowcoder.com/a',domains,async()=>new Response('x'.repeat(2500001))));
});
test('discovery deduplicates URLs and never treats search snippets as article text',()=>{
 assert.equal(canonicalUrl('https://www.nowcoder.com/a?utm_source=x&b=2#reply',domains),'https://www.nowcoder.com/a?b=2');
 const rss='<rss><channel><item><title>腾讯面试</title><link>https://www.nowcoder.com/a</link></item><item><link>https://evil.test/</link></item><item><link>https://www.nowcoder.com/a?utm_source=x</link></item></channel></rss>';
 assert.equal(parseSearch(rss,domains).length,1);
 assert.equal(extractPage('<html><meta name="description" content="面经摘要"><body>推荐文章：腾讯面经</body></html>').text,'');
});
test('source extraction separates metadata dates and excludes recommendation scripts',()=>{
 const html=`<meta property="article:published_time" content="2026-10-10T09:00:00Z"><h1>腾讯面试</h1><article>${page.text}</article><aside>百度面经</aside><script>createTime=2030</script>`;
 const parsed=extractPage(html);assert.equal(parsed.publishedAt,'2026-10-10');assert.ok(!parsed.text.includes('百度'));
 assert.equal(eligible(parsed,config,new Date('2026-10-25')),'');
 assert.match(eligible({...parsed,publishedAt:'2020-01-01'},config,new Date('2026-10-25')),/范围/);
 assert.equal(extractPage(`<h1>2026 腾讯面经</h1><article>${page.text}</article>`).publishedAt,null);
});
test('invented questions, companies and hidden categories cannot become evidence',()=>{
 assert.deepEqual(validateExtraction(extraction,page,categories,config),extraction);
 assert.throws(()=>validateExtraction({...extraction,company:'百度'},page,categories,config));
 assert.throws(()=>validateExtraction({...extraction,category:'interviews'},page,categories,config));
 assert.throws(()=>validateExtraction({...extraction,questions:[{summary:'解释一个不存在的问题',quote:'面试官让我写红黑树'}]},page,categories,config));
});
test('generation requires complete answers, sufficient depth and fetched principle citations',()=>{
 const good=generated();assert.ok(validateDraft(good,extraction,[ref]));
 assert.throws(()=>validateDraft({...good,answers:[]},extraction,[ref]));
 assert.throws(()=>validateDraft({...good,references:[{url:'https://evil.test/doc',supports:'这是未被读取的所谓原理依据'}]},extraction,[ref]));
 assert.throws(()=>validateDraft({...good,sections:good.sections.slice(0,2)},extraction,[ref]));
 const bad=generated();bad.sections[0].answer+='\n## 伪造标题';assert.throws(()=>validateDraft(bad,extraction,[ref]));
 const out=renderDraft('research-0123456789abcdef',extraction,good,{url:'https://www.nowcoder.com/a',title:page.title,publishedAt:null,dateEvidence:'发布时间未核验'},'2026-10-25');
 assert.match(out.markdown,/发布时间：未核验/);assert.match(out.markdown,/验证设计（未执行）/);
 assert.equal([...out.markdown.matchAll(/^## 第 \d+ 问：/gm)].length,6);assert.equal(out.metadata.category,'android');
});
test('topic ownership rules stop coroutine and AI subjects being filed under networking',()=>{
 const p={title:'腾讯面经',text:'协程是什么？'.repeat(60)};
 const raw={company:'腾讯',topic:'协程原理',category:'network',questions:[{summary:'解释协程运行机制与线程的差异',quote:'协程是什么？'}]};
 assert.throws(()=>validateExtraction(raw,p,[{id:'network'},{id:'languages'}],{...config,topicOwnership:{languages:['协程']}}),/分类需要核验/);
});

test('update runner generates, deduplicates and publishes only an explicitly selected draft', async()=>{
 const fs=await import('node:fs/promises');
 const path=await import('node:path');
 const {execFileSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const dir=await fs.mkdtemp(path.join(root,'.research-test-'));
 try {
  await fs.mkdir(path.join(dir,'scripts/updates'),{recursive:true});await fs.mkdir(path.join(dir,'content/updates'),{recursive:true});await fs.mkdir(path.join(dir,'content/source/lessons'),{recursive:true});
  for(const file of ['run.mjs','core.mjs'])await fs.copyFile(path.join(root,'scripts/updates',file),path.join(dir,'scripts/updates',file));
  const put=(name,value)=>fs.writeFile(path.join(dir,name),JSON.stringify(value));
  await put('content/update-config.json',{...config,enabled:false,sourceDomains:domains,principleDomains:['developer.android.com'],queries:['安卓面经'],maxCandidates:3,maxDraftsPerRun:1,model:'test',modelEndpoint:'https://model.test/chat/completions'});
  await put('content/updates/state.json',{lastRun:null,history:[],candidates:[]});
  await put('content/articles.json',[]);await put('content/categories.json',categories);await fs.writeFile(path.join(dir,'content/ARTICLE_TEMPLATE.md'),'技术正文六层问答，原题与编辑追问分开。');
  const fixture={extraction,generated:generated(),html:`<h1>腾讯面试</h1><article>${page.text}</article>`,refHtml:`<article>${ref.text}</article>`};
  await put('fixtures.json',fixture);
  await fs.writeFile(path.join(dir,'mock.mjs'),`
import fs from 'node:fs';
const f=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url)));
let calls=0;
globalThis.fetch=async (u,options)=>{
 const url=String(u);
 if(url.includes('nowcoder.com')) return new Response(f.html);
 if(url.includes('bing.com')) return new Response('<rss><channel><item><title>官方资料</title><link>https://developer.android.com/example</link></item></channel></rss>');
 if(url.includes('developer.android.com')) return new Response(f.refHtml);
 if(url.includes('model.test')) { const data=calls++===0?f.extraction:f.generated;return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]}) }
 throw Error('Unexpected network request in test');
};
`);
  const env={...process.env,ARTICLE_AI_KEY:'test-only-not-real',ARTICLE_AI_ENDPOINT:'',ARTICLE_AI_MODEL:'',SEARCH_API_KEY:'',SOURCE_URL:'https://www.nowcoder.com/test',GITHUB_EVENT_NAME:'workflow_dispatch',UPDATE_OPERATION:'refresh'};
  const run=(overrides={})=>execFileSync(process.execPath,['--import',path.join(dir,'mock.mjs'),path.join(dir,'scripts/updates/run.mjs')],{env:{...env,...overrides},stdio:'pipe'});
  const read=async file=>JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));
  run();let state=await read('content/updates/state.json');assert.equal(state.lastRun.generated,1);assert.equal(state.candidates[0].status,'draft');assert.equal((await read('content/articles.json')).length,0);
  run();state=await read('content/updates/state.json');assert.equal(state.lastRun.generated,0);assert.equal(state.candidates.length,1);
  const id=state.candidates[0].id;
  run({UPDATE_OPERATION:'publish',DRAFT_ID:id});const articles=await read('content/articles.json');assert.equal(articles.length,1);assert.equal(articles[0].id,id);assert.match(await fs.readFile(path.join(dir,'content/source/lessons',id+'.md'),'utf8'),/经仓库维护者确认收录/);
  assert.throws(()=>run({UPDATE_OPERATION:'publish',DRAFT_ID:id}));assert.equal((await read('content/articles.json')).length,1);
  assert.throws(()=>run({UPDATE_OPERATION:'publish',DRAFT_ID:'../../escape'}));
  run({UPDATE_OPERATION:'enable_auto'});assert.equal((await read('content/update-config.json')).enabled,true);
  run({UPDATE_OPERATION:'disable_auto'});assert.equal((await read('content/update-config.json')).enabled,false);
 } finally {await fs.rm(dir,{recursive:true,force:true})}
});

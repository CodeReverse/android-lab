import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import initial from "@/public/update-status.json";

type Run = { at: string; status: string; discovered: number; generated: number; published: number; warnings: string[]; modelConfigured: boolean; runUrl: string | null };
type Candidate = { id: string; title: string; url: string; status: string; reason?: string; publishedAt?: string | null; draftId?: string; publishedArticle?: string };
type Status = { version: string; updated: string; enabled: boolean; scheduleLabel: string; lookbackDays: number; maxDraftsPerRun: number; lastRun: Run | null; candidates: Candidate[] };
const repo = "https://github.com/CodeReverse/android-lab";
const workflow = `${repo}/actions/workflows/research.yml`;
const labels: Record<string,string> = { pending: "待处理", blocked: "来源待核验", retry: "待重试", waiting_model: "等待模型配置", duplicate: "已去重", draft: "草稿待核验", published: "已发布", success: "完成", needs_attention: "需处理", failed: "失败", running: "执行中" };
const time = (value: string) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

export default function UpdateCenter() {
  const [status, setStatus] = useState<Status>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [autoCheck, setAutoCheck] = useState(false);
  const [newVersion, setNewVersion] = useState(false);
  const check = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}update-status.json?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw Error(`HTTP ${res.status}`);
      const next = await res.json() as Status;
      if (typeof next.version !== "string" || !Array.isArray(next.candidates) || typeof next.enabled !== "boolean") throw Error("状态文件格式不正确");
      setStatus(next); setNewVersion(next.version !== initial.version);
      setMessage(next.version !== initial.version ? "有新的已发布内容。保存完当前编辑后刷新页面即可阅读。" : "已获取最新发布状态。后台检索任务请查看 GitHub 运行记录。");
    } catch (e) { setMessage(`检查失败：${e instanceof Error ? e.message : "网络异常"}。保留当前内容，可稍后重试。`); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { try { setAutoCheck(localStorage.getItem("android-lab.auto-update-check") === "true"); } catch { /* Optional preference. */ } }, []);
  useEffect(() => {
    if (!autoCheck) return;
    void check();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void check(); }, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoCheck, check]);
  function toggleAuto(value: boolean) { setAutoCheck(value); try { localStorage.setItem("android-lab.auto-update-check", String(value)); } catch { setMessage("浏览器未允许保存偏好，本次页面仍可使用。"); } }
  const link = (href: string, text: string) => <a className="update-action" href={href} target="_blank" rel="noopener noreferrer">{text}<ExternalLink size={14}/></a>;
  return <div className="update-center">
    <section className="settings-section">
      <span className="kind">面经检索与文章生成</span>
      <h2>从新面经到可学习的文章</h2>
      <p>检索中文原帖 → 去重与来源核验 → 提取知识点 → 核对官方原理资料 → 逐层问答草稿 → 核验后发布。模型不会自动覆盖已有文章。</p>
      <div className="button-row">
        {link(workflow, "手动更新 / 设置自动任务")}
        <Button variant="outline" onClick={check} disabled={busy}><RefreshCw size={16}/>{busy ? "检查中…" : "检查最新状态"}</Button>
        {newVersion && <Button onClick={() => location.reload()}>刷新以加载新版</Button>}
      </div>
      <p className="small-note">点击手动更新后，在 GitHub 点击 Run workflow，operation 选择 refresh。可填写 source_url 指定原帖，也可留空自动检索。只有仓库维护者能执行。</p>
      {message && <p className="notice-box" role="status">{message}</p>}
    </section>
    <div className="update-grid">
      <section className="settings-section">
        <h2>后台自动检索</h2>
        <p><strong>{status.enabled ? "已开启" : "未开启"}</strong> · {status.scheduleLabel}</p>
        <p>不需要保持网站打开。默认检索近 {Math.round(status.lookbackDays / 365)} 年资料，每次最多生成 {status.maxDraftsPerRun} 篇草稿；发布时间无法确认的来源单独标注。</p>
        {link(workflow, status.enabled ? "关闭或修改自动更新" : "开启自动更新")}
        <p className="small-note">Run workflow 选择 enable_auto 开启、disable_auto 关闭。开关保存在仓库，全设备共用。GitHub 定时任务可能延迟，长期无提交的公开仓库可能暂停调度。</p>
      </section>
      <section className="settings-section">
        <h2>检查本站已发布内容</h2>
        <label className="update-toggle"><span>每 30 分钟自动检查新版</span><Switch checked={autoCheck} onCheckedChange={toggleAuto} aria-label="自动检查已发布版本"/></label>
        <p>此开关只在当前浏览器的更新中心打开时生效，与后台面经检索独立。发现新版会提示，不自动刷新，不改动笔记、收藏或学习进度。</p>
        <p className="small-note">当前页面内容日期：{initial.updated}；最新发布内容日期：{status.updated}。</p>
      </section>
    </div>
    <section className="settings-section">
      <h2>最近一次任务</h2>
      {status.lastRun ? <>
        <p>{time(status.lastRun.at)} · {labels[status.lastRun.status] || status.lastRun.status}</p>
        <p>检索候选 {status.lastRun.discovered} · 生成草稿 {status.lastRun.generated} · 发布文章 {status.lastRun.published}</p>
        {status.lastRun.warnings.map((w,i)=><p className="small-note" key={i}>{w}</p>)}
        {status.lastRun.runUrl && link(status.lastRun.runUrl,"查看任务日志")}
      </> : <p>尚未执行。配置模型后可生成正文；未配置时仍可检索和核验来源。</p>}
      <p className="small-note">这里展示已发布的运行报告；正在执行的任务以 GitHub Actions 为准。无结果、网页拦截和模型错误会明确记录，不表示已完成内容更新。</p>
    </section>
    <section className="settings-section">
      <h2>来源与文章草稿</h2>
      {!status.candidates.length && <p>执行更新后，候选来源、核验失败原因和生成草稿会显示在这里。</p>}
      <div className="update-items">{status.candidates.map(c=><article key={c.id} className="update-item">
        <span className="kind">{labels[c.status] || c.status}</span><h3>{c.title}</h3>
        <p>{c.reason} · 发布时间：{c.publishedAt || "未核验"}</p>
        <div className="button-row">{link(c.url,"查看原帖")}{c.draftId && link(`${repo}/blob/main/content/updates/drafts/${c.draftId}.md`,"阅读草稿")}{c.publishedArticle && <a className="update-action" href={`#/article/${c.publishedArticle}`}><FileText size={15}/>阅读已发布正文</a>}</div>
        {c.status === "draft" && <p className="small-note">核验后在工作流选择 publish，并填写 draft_id：<code>{c.id}</code>。需要修改时编辑同名 JSON 中的 data；发布时会重新生成正文并检查。</p>}
      </article>)}</div>
    </section>
    <section className="settings-section">
      <h2>首次配置与生成规则</h2>
      <p>在仓库 Secrets 中添加 ARTICLE_AI_KEY。默认使用 DeepSeek；其他兼容服务可通过 Variables 设置 ARTICLE_AI_ENDPOINT（完整 chat/completions 地址）和 ARTICLE_AI_MODEL。密钥不会进入网页、文章或个人备份。</p>
      <p>检索默认使用公开搜索 RSS；如结果不足，可添加 SEARCH_API_KEY 使用 Tavily 检索，或手动指定原帖。模型与搜索服务可能产生费用，额度由对应服务账户控制。</p>
      <div className="button-row">{link(`${repo}/settings/secrets/actions`,"配置密钥与变量")}{link(`${repo}/blob/main/content/UPDATE_RULES.md`,"查看更新与核验规则")}{link(`${repo}/edit/main/content/update-config.json`,"修改来源、范围与数量")}</div>
      <p className="small-note">文章按“定义 → 结构 → 执行 → 底层实现 → 边界 → 验证”展开，原题概述与编辑追问分开。程序检查不等于技术事实核验，草稿需检查引用和版本后再收录。</p>
    </section>
  </div>;
}

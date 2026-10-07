"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  BookOpen,
  Search,
  Layers,
  Settings2,
  Bookmark,
  Route,
  Code2,
  Plus,
  Smartphone,
  Network,
  Braces,
  Blocks,
  Binary,
  Sparkles,
  GitBranch,
  ScanSearch,
  Gauge,
  Workflow,
  FolderCheck,
  Library,
  Clock,
  Check,
  Download,
  Upload,
  Moon,
  Sun,
  ExternalLink,
  Pencil,
  X,
  Play,
  ListChecks,
  History,
  FileText,
  Archive,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  initialState,
  validateState,
  stateSchema,
  mergedCategories,
  setProgress,
  savePractice,
  searchArticles,
  type LabState,
  type Category,
} from "@/lib/model";
import { loadState, persistState } from "@/lib/storage";
import baseCategories from "@/content/categories.json";
import content from "@/content/generated.json";
import learningPaths from "@/content/learning-paths.json";
import { categoryContent, filterCatalog } from "@/lib/catalog";
import Comparison from "@/components/comparison";
const articles = content.articles;
type Article = (typeof articles)[number];
const icons = {
  Smartphone,
  Network,
  Layers,
  Braces,
  Blocks,
  Binary,
  Sparkles,
  GitBranch,
  ScanSearch,
  Gauge,
  Workflow,
  FolderCheck,
};
const routes: Record<string, string> = {
  home: "知识库",
  paths: "学习路径",
  compare: "跨端对比",
  algorithms: "算法原题",
  interviews: "面经逐题详解",
  saved: "收藏与笔记",
  settings: "偏好与设置",
  progress: "我的学习范围",
  updates: "内容更新",
};
const lessons = articles.filter((a) => a.type === "学习文章");
const interviews = articles.filter((a) => a.type === "面经详解");
type ReadingPath = {
  title: string;
  category: string;
  overview: string;
  description: string;
  core: string[];
  stages: Record<string, string[]>;
  tracks: { title: string; description: string; articles: string[] }[];
};
const readingPaths: Record<string, ReadingPath> = learningPaths;
function Picker({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Blank({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <BookOpen size={27} />
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
function download(name: string, data: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function KnowledgeLab() {
  return (
    <SidebarProvider>
      <Lab />
    </SidebarProvider>
  );
}
function Lab() {
  const [state, setState] = useState<LabState>(initialState);
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(""),
    [saveStatus, setSaveStatus] = useState("正在读取本地数据");
  const [route, setRoute] = useState("home"),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState("全部分类"),
    [kind, setKind] = useState("全部内容"),
    [topic, setTopic] = useState("全部专题"),
    [origin, setOrigin] = useState("全部依据");
  const [searchOpen, setSearchOpen] = useState(false),
    [categoryEditor, setCategoryEditor] = useState<Category | null>(null),
    [practiceArticle, setPracticeArticle] = useState<Article | null>(null);
  const [restore, setRestore] = useState<LabState | null>(null),
    [confirmClear, setConfirmClear] = useState(false),
    [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const { setOpenMobile } = useSidebar();
  const cats = useMemo(
    () => mergedCategories(baseCategories as Category[], state.categories),
    [state.categories],
  );
  const visibleCats = cats.filter((c) => !c.hidden);
  const categoryId = route.startsWith("category/") ? route.slice(9) : "";
  const category = cats.find((c) => c.id === categoryId);
  const categoryPath = Object.entries(readingPaths).find(([, path]) => path.category === categoryId);
  const pathId = route === "paths" ? "compose" : route.startsWith("paths/") ? route.slice(6) : "";
  const selectedPath = readingPaths[pathId];
  const article = route.startsWith("article/")
    ? articles.find((a) => a.id === route.slice(8))
    : undefined;
  const navigate = (target: string) => {
    location.hash = `/${target}`;
    setQuery("");
    setKind("全部内容");
    setTopic("全部专题");
    setOrigin("全部依据");
    setOpenMobile(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const change = () => {
      setKind("全部内容");
      setTopic("全部专题");
      setOrigin("全部依据");
      try {
        setRoute(
          decodeURIComponent(location.hash.replace(/^#\/?/, "")) || "home",
        );
      } catch {
        setRoute("not-found");
      }
      window.scrollTo(0, 0);
    };
    change();
    window.addEventListener("hashchange", change);
    loadState()
      .then((s) => {
        setState(s);
        setReady(true);
        setSaveStatus("保存在此浏览器");
      })
      .catch(() => {
        setStorageError(
          "无法读取本地数据，已暂停自动保存。阅读仍可用，可导出当前编辑或刷新重试。",
        );
        setSaveStatus("本地存储不可用");
      });
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("正在保存…");
    let active = true;
    const timer = setTimeout(() => {
      persistState(state)
        .then(() => {
          if (active) {
            setSaveStatus("已保存到此浏览器");
            setStorageError("");
          }
        })
        .catch(() => {
          if (active) {
            setStorageError(
              "本地保存失败，请导出备份；当前编辑仍保留在页面中。",
            );
            setSaveStatus("保存失败");
          }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state, ready]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.dark);
  }, [state.settings.dark]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    document.title = `${article?.title || category?.name || selectedPath?.title || routes[route] || "知识库"} · Android Lab`;
  }, [route, article, category, selectedPath]);
  useEffect(() => {
    if (!state.settings.practice) setPracticeArticle(null);
  }, [state.settings.practice]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  // Structured search uses the same index and navigation as the visible interface.
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const tool = {
      name: "search_android_knowledge",
      title: "搜索 Android 知识库",
      description: "只读搜索现有学习内容，返回稳定 ID 与摘要，不记录学习进度。",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1, maxLength: 200 } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input: unknown) => {
        if (
          !input ||
          typeof input !== "object" ||
          !("query" in input) ||
          typeof input.query !== "string" ||
          !input.query.trim() ||
          input.query.length > 200
        )
          throw Error("需要 1–200 字的搜索词");
        return searchArticles(articles, input.query)
          .slice(0, 8)
          .map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            url: `#/article/${a.id}`,
          }));
      },
    };
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: controller.signal }),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
  function setting(key: keyof LabState["settings"], value: boolean) {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        [key]: value,
        ...(key === "practice" && !value ? { savePractice: false } : {}),
      },
    }));
  }
  function bookmarked(a: Article) {
    return state.bookmarks.includes(a.id);
  }
  function toggleBookmark(a: Article) {
    setState((s) => ({
      ...s,
      bookmarks: s.bookmarks.includes(a.id)
        ? s.bookmarks.filter((id) => id !== a.id)
        : [...s.bookmarks, a.id],
    }));
  }
  function categoryArticles(id: string) {
    return categoryContent(articles, cats, id);
  }
  const filtered = filterCatalog(searchArticles(
    categoryId ? categoryArticles(categoryId) : articles,
    query,
  ), {kind, topic, origin});
  const personalLinks = articles.filter((a) => state.links[categoryId]?.includes(a.id) && !categoryArticles(categoryId).some((x) => x.id === a.id));
  const title = query
    ? `搜索“${query}”`
    : article?.title || category?.name || selectedPath?.title || routes[route] || "页面未找到";
  const openArticle = (id: string) => navigate(`article/${id}`);
  const addCategory = () =>
    setCategoryEditor({
      id: `custom-${crypto.randomUUID()}`,
      name: "",
      description: "",
      group: "技术知识",
      topics: [],
      icon: "BookOpen",
      order: cats.length + 1,
    });
  function articleRows(items: Article[]) {
    return (
      <div className="article-list">
        {items.map((a) => (
          <div className="article-row" key={a.id}>
            <button
              className="article-row-main"
              onClick={() => openArticle(a.id)}
            >
              <div className="article-meta">
                <span
                  className={`kind ${a.type === "追问提纲" ? "outline" : ""}`}
                >
                  {a.type}
                </span>
                <span>{cats.find((c) => c.id === a.category)?.name}</span>
                {a.type === "学习文章" && <span>{a.topic}</span>}
                {a.inquiryCount > 0 && <span>逐层追问 · {a.inquiryCount} 问</span>}
                <span>{a.minutes} 分钟</span>
              </div>
              <h3>{a.title}</h3>
              <p>{a.summary}</p>
              {a.type === "学习文章" && <span className="small-note">{a.origin} · {a.inquiryCount > 0 ? "定义 → 机制 → 边界 → 验证" : "学习地图与工程判断"}</span>}
              {a.type === "面经详解" && <span className="small-note">{a.company} · {a.interviewDate} · {a.questionCount} 个原帖条目 · {a.role}</span>}
            </button>
            <button
              className={`icon-button ${bookmarked(a) ? "bookmarked" : ""}`}
              aria-label={`${bookmarked(a) ? "取消收藏" : "收藏"} ${a.title}`}
              onClick={() => toggleBookmark(a)}
            >
              <Bookmark
                size={18}
                fill={bookmarked(a) ? "currentColor" : "none"}
              />
            </button>
          </div>
        ))}
      </div>
    );
  }
  const nav = [
    ["home", "知识库", Library],
    ["paths", "学习路径", Route],
    ["compare", "跨端对比", Layers],
    ["interviews", "面经逐题详解", FileText],
    ["algorithms", "算法原题", Code2],
    ["saved", "收藏与笔记", Bookmark],
    ...(state.settings.progress
      ? [["progress", "我的学习范围", ListChecks]]
      : []),
    ["updates", "内容更新", History],
  ] as const;
  async function importBackup(file: File) {
    try {
      if (file.size > 10_000_000) throw Error("备份不能超过 10 MB");
      const parsed = JSON.parse(await file.text());
      setRestore(validateState(parsed.data ?? parsed));
    } catch (e) {
      setNotice(`无法导入：${e instanceof Error ? e.message : "备份格式无效"}`);
    }
    if (importRef.current) importRef.current.value = "";
  }
  return (
    <>
      <Sidebar>
        <SidebarHeader className="brand">
          <button
            className="brand-mark"
            onClick={() => navigate("home")}
            aria-label="回到知识库"
          >
            <Code2 size={23} />
          </button>
          <div>
            <strong>
              Android Lab<span>INTERVIEW KNOWLEDGE</span>
            </strong>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-heading">我的知识空间</div>
          <nav className="nav-list" aria-label="主要导航">
            {nav.map(([id, label, Icon]) => (
              <button
                key={id as string}
                className={route === id || (id === "paths" && !!selectedPath) ? "active" : ""}
                onClick={() => navigate(id as string)}
              >
                <Icon />
                {label as string}
              </button>
            ))}
          </nav>
          <div className="nav-heading">分类目录</div>
          <nav className="nav-list compact" aria-label="分类目录">
            {visibleCats.map((c, i) => (
              <button
                key={c.id}
                className={categoryId === c.id ? "active" : ""}
                onClick={() => navigate(`category/${c.id}`)}
                style={c.parent ? { paddingLeft: 28 } : undefined}
              >
                <span className="nav-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {c.name}
              </button>
            ))}
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <button className="nav-setting" onClick={() => navigate("settings")}>
            <Settings2 />
            偏好与设置
          </button>
          <div className="sidebar-foot">
            {state.settings.progress
              ? "自主跟踪学习范围"
              : "按需阅读 · 自由探索"}
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger />
            <button onClick={() => navigate("home")}>知识空间</button>
            <span>/</span>
            <strong>
              {article ? "阅读" : category ? "分类" : routes[route] || "知识库"}
            </strong>
          </div>
          <div className="top-actions">
            <button className="top-search" onClick={() => setSearchOpen(true)}>
              <Search size={17} />
              搜索知识点、源码符号…<kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              aria-label={state.settings.dark ? "切换浅色" : "切换深色"}
              onClick={() => setting("dark", !state.settings.dark)}
            >
              {state.settings.dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </header>
        <main
          className={`workspace ${article && !query ? "reading-workspace" : ""}`}
        >
          {storageError && (
            <div className="warning" role="alert">
              {storageError}
            </div>
          )}
          {(!article || query) && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {route === "home" && !query
                    ? "YOUR KNOWLEDGE, CONNECTED"
                    : "ANDROID INTERVIEW LAB"}
                </div>
                <h1>{title}</h1>
                <p>
                  {query
                    ? `找到 ${filtered.length} 篇相关内容`
                    : category
                      ? category.description
                      : route === "home"
                        ? "从一个问题出发，读懂原理与背后的技术决策。"
                        : selectedPath
                          ? "按前置关系系统复习，也可以直接跳到你关心的章节。"
                          : route === "compare"
                            ? "先理解复用边界，再讨论体验、成本与适用场景。"
                            : route === "algorithms"
                              ? "从中文面经追溯原题。当前 9 道，上限 100 道，不为数量凑题。"
                              : route === "interviews"
                                ? "真实题目是起点，参考回答、底层机制与编辑追问逐项展开。"
                              : route === "saved"
                                ? "把有用的内容和自己的思考放在一起。"
                                : route === "settings"
                                  ? "你的阅读方式，由你决定。"
                                  : route === "progress"
                                    ? "只计算你主动加入的内容，不把全站未读当作欠缺。"
                                    : "公开资料与核验状态，持续维护。"}
                </p>
              </div>
              {route === "home" && !query && (
                <span className="reading-mode">
                  <BookOpen size={16} />
                  {state.settings.progress ? "自主学习" : "自由阅读"}
                </span>
              )}
            </div>
          )}
          {query ? (
            <>
              <div className="filter-bar">
                <input
                  className="search-field"
                  aria-label="搜索内容"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Button variant="outline" onClick={() => setQuery("")}>
                  清除搜索
                </Button>
              </div>
              {filtered.length ? (
                articleRows(filtered)
              ) : (
                <Blank
                  title="没有找到相关内容"
                  description="试试中文、英文或源码符号，例如：状态、Snapshot、Looper。"
                />
              )}
            </>
          ) : article ? (
            <ArticleView
              article={article}
              state={state}
              setState={setState}
              bookmarked={bookmarked(article)}
              toggleBookmark={() => toggleBookmark(article)}
              cats={cats}
              saveStatus={saveStatus}
              startPractice={() => setPracticeArticle(article)}
              openArticle={openArticle}
            />
          ) : route === "home" ? (
            <>
              <div className="feature-grid">
                <button
                  className="feature-main"
                  onClick={() => navigate("paths")}
                >
                  <span className="feature-label">专题路径 / 01</span>
                  <h2>重新认识 Compose</h2>
                  <p>State → Snapshot → SlotTable → Compiler</p>
                  <div className="feature-bottom">
                    <span>6 篇机制正文 · 11 阶段复习地图</span>
                    <Blocks size={42} />
                  </div>
                </button>
                <button
                  className="feature-secondary"
                  onClick={() => navigate("compare")}
                >
                  <span className="feature-label">技术全景 / 02</span>
                  <h2>跨端，从原理到取舍</h2>
                  <p>Flutter · React Native · KMP · JSBridge</p>
                  <div className="feature-bottom">
                    <span>技术对比 / 场景选型 / App 实践</span>
                    <Layers size={32} />
                  </div>
                </button>
              </div>
              <div className="content-overview">
                <div><strong>{lessons.length} 篇学习文章</strong><span>原理讲解、工程场景、追问支点与验证方法</span></div>
                <div className="button-row"><button className="text-button" onClick={() => navigate("interviews")}>{interviews.length} 份面经逐题详解 <ChevronRight size={16} /></button><button className="text-button" onClick={() => openArticle("senior-capability-map")}>资深岗位能力地图 <ChevronRight size={16} /></button></div>
              </div>
              <div className="path-intro">
                <div><span className="kind">逐层追问 · 新专题</span><h2>从基础问题走到实现与故障现场</h2><p>AI 与端侧工程；JVM、JMM、线程、锁、GC、Handler 和 OOM。</p></div>
                <div className="button-row"><Button variant="outline" onClick={() => navigate("paths/ai")}>AI 学习路径</Button><Button variant="outline" onClick={() => navigate("paths/runtime")}>运行时与并发</Button></div>
              </div>
              <div className="section-head">
                <Tabs value={group} onValueChange={setGroup}>
                  <TabsList>
                    <TabsTrigger value="全部分类">
                      全部分类 <span>{visibleCats.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="技术知识">技术知识</TabsTrigger>
                    <TabsTrigger value="资深能力">资深能力</TabsTrigger>
                  </TabsList>
                </Tabs>
                <button className="text-button" onClick={addCategory}>
                  <Plus size={16} />
                  新增分类
                </button>
              </div>
              <div className="category-grid">
                {visibleCats
                  .filter((c) => group === "全部分类" || c.group === group)
                  .map((c) => {
                    const Icon =
                      icons[c.icon as keyof typeof icons] || BookOpen;
                    return (
                      <button
                        className="category-card"
                        key={c.id}
                        onClick={() => navigate(`category/${c.id}`)}
                      >
                        <div className="card-top">
                          <span className="category-icon">
                            <Icon size={21} />
                          </span>
                          <span className="card-number">
                            {c.id === "algorithms" ? `${content.algorithms.length} 道原题` : `${categoryArticles(c.id).filter((a) => a.type === "学习文章").length} 篇正文`}
                          </span>
                        </div>
                        <h3>{c.name}</h3>
                        <p>{c.description || "为新的想法留一个位置。"}</p>
                        <div className="tags">
                          {c.topics.map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
              </div>
              <div className="section-title">
                <h2>从这里开始阅读</h2>
                <span>从机制解释到可验证的工程判断</span>
              </div>
              {articleRows(
                [
                  "handler",
                  "compose-state",
                  "okhttp-chain",
                  "performance-proof",
                  "project-evidence",
                ].map((id) => articles.find((a) => a.id === id)!),
              )}
            </>
          ) : category ? (
            <>
              <p className="small-note">按知识点归属组织正文。跨领域延伸放在文章末尾，个人关联单独展示。</p>
              {categoryPath && <div className="path-intro"><div><span className="kind">专题学习路径</span><h2>{categoryPath[1].title}</h2><p>{categoryPath[1].description}</p></div><div className="button-row"><Button variant="outline" onClick={() => navigate(`paths/${categoryPath[0]}`)}>按路线阅读</Button><Button variant="outline" onClick={() => openArticle(categoryPath[1].overview)}>阅读专题地图</Button></div></div>}
              <div className="filter-bar">
                <Picker label="二级专题" value={topic} onChange={setTopic} items={["全部专题", ...new Set(categoryArticles(category.id).map((a) => a.topic))].map((v) => ({value: v, label: v}))} />
                <Picker label="收录依据" value={origin} onChange={setOrigin} items={["全部依据", ...new Set(categoryArticles(category.id).map((a) => a.origin))].map((v) => ({value: v, label: v}))} />
                <Picker
                  label="内容类型"
                  value={kind}
                  onChange={setKind}
                  items={[
                    "全部内容",
                    ...new Set(
                      categoryArticles(category.id).map((a) => a.type),
                    ),
                  ].map((v) => ({ value: v, label: v }))}
                />
                <span>{filtered.filter((a) => a.type === "学习文章").length} 篇正文 · {filtered.filter((a) => a.type !== "学习文章").length} 份资料</span>
                <button
                  className="text-button push-right"
                  onClick={() => setCategoryEditor({ ...category })}
                >
                  <Pencil size={16} />
                  编辑分类 / 关联内容
                </button>
              </div>
              {filtered.length ? (
                <>
                  {filtered.some((a) => a.type === "学习文章") && articleRows(filtered.filter((a) => a.type === "学习文章"))}
                  {filtered.some((a) => a.type !== "学习文章") && (
                    <details className="reference-fold" key={`${category.id}-${kind}-${topic}-${origin}`} open={kind !== "全部内容" || topic === "路线与资料" || origin === "参考资料" || !filtered.some((a) => a.type === "学习文章")}>
                      <summary>辅助资料：路线、面经索引与原有提纲（{filtered.filter((a) => a.type !== "学习文章").length}）</summary>
                      {articleRows(filtered.filter((a) => a.type !== "学习文章"))}
                    </details>
                  )}
                </>
              ) : (
                <Blank
                  title="当前条件下没有正文或资料"
                  description="可以调整筛选条件。个人关联在下方独立展示；新增正文不会改变已有文章的归属。"
                />
              )}
              {personalLinks.length > 0 && <section className="personal-relations"><div className="section-title"><h2>我的关联内容</h2><span>保留原分类，不计入本分类正文</span></div>{articleRows(searchArticles(personalLinks, query))}</section>}
            </>
          ) : selectedPath ? (
            <>
              <div className="button-row" aria-label="选择学习路径">
                {Object.entries(readingPaths).map(([id, path]) => <Button key={id} variant={pathId === id ? "default" : "outline"} onClick={() => navigate(`paths/${id}`)} aria-pressed={pathId === id}>{path.title}</Button>)}
              </div>
              {pathId !== "compose" ? <>
                <div className="path-intro"><div><span className="kind">专题路径 · 自由阅读</span><h2>{selectedPath.title}</h2><p>{selectedPath.description}</p></div><Button variant="outline" onClick={() => openArticle(selectedPath.overview)}>学习地图与来源</Button></div>
                {selectedPath.tracks.map((track) => <section key={track.title}><div className="section-title"><h2>{track.title}</h2><span>{track.description}</span></div>{articleRows(track.articles.map((id) => articles.find((a) => a.id === id)!))}</section>)}
              </> : <>
              <div className="path-intro">
                <div>
                  <span className="kind">Compose 专项</span>
                  <h2>从开发使用到 Runtime 与编译器</h2>
                  <p>
                    先沿六篇正文理解机制，再用十一阶段地图查缺补漏。可自由跳读，不设置关卡。
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => openArticle("compose-roadmap")}
                >
                  阅读完整路径
                </Button>
              </div>
              <div className="section-title"><h2>正文主线</h2><span>State → Snapshot → 组合结构 → Compiler → Phases → Effects</span></div>
              {articleRows(learningPaths.compose.core.map((id) => articles.find((a) => a.id === id)!))}
              <div className="section-title"><h2>分阶段复习地图</h2><span>原有检查点及对应正文</span></div>
              <div className="path-list">
                {articles
                  .filter((a) => a.id.startsWith("compose-stage-"))
                  .map((a, i) => (
                    <div key={a.id} className="path-stage">
                    <button
                      className="path-step"
                      key={a.id}
                      onClick={() => openArticle(a.id)}
                    >
                      <span className="step-number">
                        {String(i).padStart(2, "0")}
                      </span>
                      <div>
                        <span className="article-meta">
                          阶段 {i} · 复习地图
                        </span>
                        <h3>{a.title.replace(/^阶段 \d+：/, "")}</h3>
                        <p>
                          {a.tags.slice(1).join(" / ") || "基础概念与版本边界"}
                        </p>
                      </div>
                      <ChevronRight size={18} />
                    </button>
                    <div className="path-readings">{(learningPaths.compose.stages[a.id as keyof typeof learningPaths.compose.stages] || []).map((id) => <button key={id} className="text-button" onClick={() => openArticle(id)}><FileText size={15} />{articles.find((x) => x.id === id)?.title}</button>)}</div>
                    </div>
                  ))}
              </div>
              <div className="section-title">
                <h2>其他阅读路线</h2>
              </div>
              {articleRows(
                articles.filter((a) =>
                  [
                    "cross-overview",
                    "content-depth",
                    "project-evidence",
                  ].includes(a.id),
                ),
              )}
              </>}
            </>
          ) : route === "compare" ? (
            <Comparison openArticle={openArticle} />
          ) : route === "interviews" ? (
            <>
              <div className="notice-box">收录 {interviews.length} 份面经，已解答 {interviews.reduce((n, a) => n + a.questionCount, 0)} 个原帖条目。标为“AI 专项节选”的文章只覆盖明确列出的题目；其他来源仍是选题索引。题目按原帖语义转述，答案与新增追问由知识库编写，不是公司官方答案。</div>
              <div className="filter-bar"><Picker label="选择公司" value={topic} onChange={setTopic} items={[{value:"全部专题", label:"全部公司"}, ...[...new Set(interviews.map((a) => a.company))].map((company) => ({value:company,label:company}))]} /><Button variant="outline" onClick={() => openArticle("interview-sources")}>Android 面经来源</Button><Button variant="outline" onClick={() => openArticle("ai-roadmap")}>AI 面经来源与范围</Button></div>
              {articleRows(interviews.filter((a) => topic === "全部专题" || a.company === topic))}
            </>
          ) : route === "algorithms" ? (
            <AlgorithmView openArticle={openArticle} />
          ) : route === "saved" ? (
            <>
              <div className="filter-bar">
                <span>
                  {state.bookmarks.length} 篇收藏 ·{" "}
                  {Object.values(state.notes).filter(Boolean).length} 篇笔记
                </span>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      "android-lab-notes.md",
                      articles
                        .filter((a) => state.notes[a.id])
                        .map((a) => `# ${a.title}\n\n${state.notes[a.id]}\n`)
                        .join("\n"),
                      "text/markdown",
                    )
                  }
                >
                  导出笔记
                </Button>
              </div>
              {articles.some(
                (a) => state.bookmarks.includes(a.id) || state.notes[a.id],
              ) ? (
                articleRows(
                  articles.filter(
                    (a) => state.bookmarks.includes(a.id) || state.notes[a.id],
                  ),
                )
              ) : (
                <Blank
                  title="留住值得再读的内容"
                  description="在文章页点击收藏，或写下自己的笔记。无需开启进度与练习。"
                />
              )}
            </>
          ) : route === "progress" ? (
            state.settings.progress ? (
              <>
                <div className="progress-summary">
                  <div>
                    <strong>
                      {
                        Object.values(state.progress).filter(
                          (p) => p.status === "已掌握",
                        ).length
                      }
                      <span> / {Object.keys(state.progress).length}</span>
                    </strong>
                    <p>已掌握 / 自选内容</p>
                  </div>
                  <Progress
                    value={
                      Object.keys(state.progress).length
                        ? (Object.values(state.progress).filter(
                            (p) => p.status === "已掌握",
                          ).length /
                            Object.keys(state.progress).length) *
                          100
                        : 0
                    }
                  />
                </div>
                {Object.keys(state.progress).length ? (
                  <div className="article-list">
                    {Object.entries(state.progress).map(([id, p]) => {
                      const a = articles.find((x) => x.id === id);
                      return (
                        <div className="progress-row" key={id}>
                          <button onClick={() => a && openArticle(id)}>
                            <h3>{a?.title || "已归档内容"}</h3>
                            <span className="article-meta">
                              {p.updated.slice(0, 10)} · 内容版本 {p.version}
                              {a && a.version !== p.version
                                ? " · 正文已有更新"
                                : ""}
                            </span>
                          </button>
                          <Picker
                            label={`设置 ${a?.title || id} 的进度`}
                            value={p.status}
                            onChange={(v) =>
                              setState((s) =>
                                setProgress(
                                  s,
                                  id,
                                  a?.version || p.version,
                                  v as typeof p.status,
                                ),
                              )
                            }
                            items={["待学习", "学习中", "已掌握"].map((v) => ({
                              value: v,
                              label: v,
                            }))}
                          />
                          <button
                            className="icon-button"
                            aria-label="移出学习范围"
                            onClick={() =>
                              setState((s) => {
                                const next = { ...s.progress };
                                delete next[id];
                                return { ...s, progress: next };
                              })
                            }
                          >
                            <X size={17} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Blank
                    title="先选择你想学的内容"
                    description="打开一篇文章，点击“加入学习范围”。新增文章不会自动扩大你的范围。"
                  />
                )}
              </>
            ) : (
              <Blank
                title="进度管理未开启"
                description="如有需要，可在偏好与设置中开启；所有内容仍可以自由阅读。"
              />
            )
          ) : route === "settings" ? (
            <>
              <section className="settings-section">
                <h2>阅读与学习</h2>
                <SettingRow
                  title="进度管理"
                  description="手动跟踪选定文章，掌握状态由你标记。"
                  checked={state.settings.progress}
                  change={(v) => setting("progress", v)}
                />
                <SettingRow
                  title="练习功能"
                  description="开启口答练习、计时与自评分；不自动改变学习进度。"
                  checked={state.settings.practice}
                  change={(v) => setting("practice", v)}
                />
                <SettingRow
                  title="保存练习记录"
                  description="关闭时练习只在当前会话中存在，关闭练习会同时关闭留存。"
                  checked={state.settings.savePractice}
                  disabled={!state.settings.practice}
                  change={(v) => setting("savePractice", v)}
                />
                <SettingRow
                  title="深色阅读"
                  description="适合晚间查阅，设置保存在此浏览器。"
                  checked={state.settings.dark}
                  change={(v) => setting("dark", v)}
                />
              </section>
              <section className="settings-section">
                <h2>分类管理</h2>
                <p>分类名称和顺序可以调整，内容与笔记由稳定 ID 关联。</p>
                <div className="manage-categories">
                  {cats.map((c) => (
                    <div key={c.id}>
                      <span>
                        {c.hidden ? "已归档 · " : ""}
                        {c.parent ? "↳ " : ""}
                        {c.name}
                      </span>
                      <span className="article-meta">{c.group}</span>
                      <button
                        className="text-button"
                        onClick={() => setCategoryEditor({ ...c })}
                      >
                        编辑
                      </button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" onClick={addCategory}>
                  <Plus size={16} />
                  新增分类
                </Button>
              </section>
              <section className="settings-section">
                <h2>本地数据与备份</h2>
                <p>
                  收藏、笔记、进度和自定义分类保存在当前浏览器的
                  IndexedDB。不会跨设备同步，也不会写入公开内容。换浏览器前请导出备份。
                </p>
                <div className="button-row">
                  <Button
                    onClick={() =>
                      download(
                        "android-lab-backup.json",
                        JSON.stringify(
                          { exportedAt: new Date().toISOString(), data: state },
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    <Download size={16} />
                    导出全部数据
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={16} />
                    恢复备份
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmClear(true)}
                  >
                    清空个人数据
                  </Button>
                </div>
                <input
                  hidden
                  type="file"
                  accept=".json,application/json"
                  ref={importRef}
                  onChange={(e) =>
                    e.target.files?.[0] && importBackup(e.target.files[0])
                  }
                />
                <p className="small-note" role="status">
                  {saveStatus}
                </p>
              </section>
              <section className="settings-section">
                <h2>内容维护</h2>
                <p>
                  当前有 {lessons.length} 篇学习正文、{interviews.length} 份面经详解、{articles.length - lessons.length - interviews.length} 份辅助资料和 {content.algorithms.length}
                  道算法原题。正文依据面经选题与资深岗位能力补充。新增正文修改 Markdown
                  与内容元数据后重新构建；个人数据独立保留。自动采集、提醒与 AI
                  面试尚未启用。
                </p>
                <Button
                  variant="outline"
                  onClick={() => openArticle("project-plan")}
                >
                  查看完整方案
                </Button>
              </section>
            </>
          ) : route === "updates" ? (
            <>
              <div className="update-card">
                <span className="kind">{content.updated} · {content.edition}</span>
                <h2>技术正文按面试追问组织，补齐 AI 与运行时专题</h2>
                <p>
                  {lessons.length} 篇学习文章覆盖运行机制、网络、语言、Compose、跨端、AI 与五项资深能力。
                  增加二级专题与收录依据筛选；所属分类、延伸阅读和个人关联分开。原有资料仍可查阅，实验设计不等于已复现结果。
                  AI 分类现有 {lessons.filter((a) => a.category === "ai").length} 篇正文。另有 {interviews.length} 份真实面经的 {interviews.reduce((n, a) => n + a.questionCount, 0)} 个原帖条目详解，AI 节选范围、原帖问题与编辑追问分开标注。
                  其中 {lessons.filter((a) => a.inquiryCount > 0).length} 篇技术正文采用连续问答；JVM、线程、锁、GC、Handler、JMM、ART 内存与 OOM 已重点扩写。
                </p>
                <div className="button-row">
                  <Button variant="outline" onClick={() => navigate("paths/ai")}>AI 学习路径</Button>
                  <Button variant="outline" onClick={() => navigate("paths/runtime")}>运行时与并发路径</Button>
                  <Button variant="outline" onClick={() => navigate("interviews")}>阅读面经详解</Button>
                  <Button
                    variant="outline"
                    onClick={() => openArticle("interview-sources")}
                  >
                    查看面经来源
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openArticle("cross-chapter-6")}
                  >
                    查看 App 采用证据
                  </Button>
                </div>
              </div>
              <div className="section-title">
                <h2>如何更新</h2>
              </div>
              <div className="notice-box">
                新面经和技术变化先进入核验，再更新正文与版本。此版没有后台自动抓取任务；你可以继续要求补充任意专题，更新内容不影响个人笔记和设置。
              </div>
            </>
          ) : (
            <Blank
              title="未找到这篇内容"
              description="请从知识目录重新选择；旧的个人记录不会因此删除。"
            />
          )}
          <footer className="page-footer">
            <span>Android Interview Lab · {content.updated}</span>
            <span>
              按需阅读 · 来源可追溯 ·{" "}
              {ready ? "本地数据独立保存" : "知识内容可直接阅读"}
            </span>
          </footer>
        </main>
      </SidebarInset>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="search-dialog">
          <DialogHeader>
            <DialogTitle>搜索知识库</DialogTitle>
            <DialogDescription>
              支持中文、英文、标签与正文关键词。
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            className="search-field"
            placeholder="例如 Snapshot、Handler、跨端、腾讯"
            aria-label="搜索知识库"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="search-results">
            {(query
              ? searchArticles(articles, query).slice(0, 10)
              : articles.slice(0, 4)
            ).map((a) => (
              <button key={a.id} onClick={() => openArticle(a.id)}>
                <span className="kind">{a.type}</span>
                <strong>{a.title}</strong>
              </button>
            ))}
            {query && !searchArticles(articles, query).length && (
              <p>未找到内容，试试其他关键词。</p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSearchOpen(false);
              setKind("全部内容");
              setTopic("全部专题");
              setOrigin("全部依据");
              location.hash = "/home";
              setRoute("home");
            }}
          >
            查看全部搜索结果
          </Button>
        </DialogContent>
      </Dialog>
      <CategoryEditor
        value={categoryEditor}
        onClose={() => setCategoryEditor(null)}
        cats={cats}
        state={state}
        save={(c, links) => {
          const categories = [
            ...state.categories.filter((x) => x.id !== c.id),
            c,
          ];
          try {
            validateState({
              ...state,
              categories: mergedCategories(
                baseCategories as Category[],
                categories,
              ),
            });
            setState((s) => ({
              ...s,
              categories,
              links: { ...s.links, [c.id]: links },
            }));
            setCategoryEditor(null);
            setNotice("分类已更新，已有内容与个人记录保持关联。");
          } catch {
            setNotice("无法保存：分类父级不能形成循环。");
          }
        }}
      />
      <Practice
        article={practiceArticle}
        onClose={() => setPracticeArticle(null)}
        state={state}
        save={(record) => {
          setState((s) => savePractice(s, record));
          setNotice("练习记录已加入本地保存队列。");
        }}
      />
      <AlertDialog
        open={!!restore}
        onOpenChange={(v) => !v && setRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>用备份替换当前个人数据？</AlertDialogTitle>
            <AlertDialogDescription>
              备份包含 {restore?.bookmarks.length || 0} 篇收藏、
              {Object.keys(restore?.notes || {}).length} 篇笔记、
              {Object.keys(restore?.progress || {}).length}{" "}
              条进度。当前数据将被替换，建议先导出备份。文章正文不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (restore) {
                  setState(restore);
                  setReady(true);
                  setRestore(null);
                }
              }}
            >
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空此浏览器的个人数据？</AlertDialogTitle>
            <AlertDialogDescription>
              将清空收藏、笔记、进度、练习记录和自定义分类，所有开关恢复默认关闭。知识库正文不会删除。此操作无法撤销，请先导出备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setState(initialState());
                setReady(true);
                navigate("home");
              }}
            >
              清空个人数据
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {notice && (
        <div className="toast-message" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
function SettingRow({
  title,
  description,
  checked,
  change,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  change: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = `setting-${title}`;
  return (
    <div className="setting-row">
      <div>
        <label htmlFor={id}>{title}</label>
        <p>{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={change}
        disabled={disabled}
      />
    </div>
  );
}
function ArticleView({
  article: a,
  state,
  setState,
  bookmarked,
  toggleBookmark,
  cats,
  saveStatus,
  startPractice,
  openArticle,
}: {
  article: Article;
  state: LabState;
  setState: Dispatch<SetStateAction<LabState>>;
  bookmarked: boolean;
  toggleBookmark: () => void;
  cats: Category[];
  saveStatus: string;
  startPractice: () => void;
  openArticle: (id: string) => void;
}) {
  const [tocOpen, setTocOpen] = useState(false);
  const progress = state.progress[a.id];
  const pathReadings = Object.values(readingPaths).flatMap((path) => path.stages[a.id] || []);
  const relatedIds = [...new Set([...pathReadings, ...a.related])];
  const related = relatedIds.length
    ? relatedIds.map((id) => articles.find((x) => x.id === id)!).filter(Boolean)
    : articles.filter((x) => x.id !== a.id && x.category === a.category && x.type === "学习文章").slice(0, 3);
  const scroll = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <>
      <div className="article-topline">
        <span>{cats.find((c) => c.id === a.category)?.name}</span>
        <span>/</span>
        <span>{a.topic}</span>
        <span>/</span>
        <span>{a.type}</span>
      </div>
      <div className="reader-layout">
        <article className="reader-main">
          <header className="article-header">
            <div className="article-meta">
              <span
                className={`kind ${a.type === "追问提纲" ? "outline" : ""}`}
              >
                {a.type}
              </span>
              <span>更新 {a.updated} · v{a.version}</span>
              {a.type === "学习文章" && <span>{a.origin}</span>}
              {a.inquiryCount > 0 && <span>逐层追问 · {a.inquiryCount} 问</span>}
              <span>{a.minutes} 分钟</span>
            </div>
            <h1>{a.title}</h1>
            <div className="article-toolbar">
              <Button variant="outline" onClick={toggleBookmark}>
                <Bookmark
                  size={16}
                  fill={bookmarked ? "currentColor" : "none"}
                />
                {bookmarked ? "已收藏" : "收藏"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  download(`${a.title}.md`, a.markdown, "text/markdown")
                }
              >
                <Download size={16} />
                导出 Markdown
              </Button>
              {state.settings.practice && (
                <Button variant="outline" onClick={startPractice}>
                  <Play size={16} />
                  练习
                </Button>
              )}
              {state.settings.progress &&
                (progress ? (
                  <Picker
                    label="当前文章进度"
                    value={progress.status}
                    onChange={(v) =>
                      setState((s) =>
                        setProgress(
                          s,
                          a.id,
                          a.version,
                          v as typeof progress.status,
                        ),
                      )
                    }
                    items={["待学习", "学习中", "已掌握"].map((v) => ({
                      value: v,
                      label: v,
                    }))}
                  />
                ) : (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setState((s) => setProgress(s, a.id, a.version, "待学习"))
                    }
                  >
                    <Plus size={16} />
                    加入学习范围
                  </Button>
                ))}
            </div>
          </header>
          {a.type === "学习文章" && <div className="lesson-context"><strong>本篇学习目标</strong><p>{a.summary}</p><span>含机制讲解、工程推演与逐层追问；实验步骤需在实际项目版本中验证。原理来源与面经映射见文末。</span></div>}
          {a.type === "面经详解" && <div className="lesson-context"><strong>{a.company} · {a.interviewDate} · {a.questionCount} 个条目</strong><p>{a.role}</p><span>原帖问题与编辑追问分开标注。下文是原创参考解答，不是面试官官方答案，也不虚构候选人经历。</span></div>}
          {progress && progress.version < a.version && <div className="notice-box">正文已更新到 v{a.version}，你记录进度时是 v{progress.version}。原进度与笔记保留，可自行决定是否复习。</div>}
          {a.type === "追问提纲" && (
            <div className="notice-box">
              这篇内容是追问与学习提纲，尚未提供全部标准答案和实验验证。可作为复习地图，不作为已核验结论直接背诵。
            </div>
          )}
          <button
            className="mobile-toc text-button"
            onClick={() => setTocOpen(!tocOpen)}
          >
            本篇目录 {tocOpen ? "收起" : "展开"}
          </button>
          {tocOpen && (
            <nav className="inline-toc">
              {a.toc.filter((t) => a.type !== "面经详解" || t.level === 2).map((t) => (
                <button key={t.id} onClick={() => scroll(t.id)}>
                  {t.text}
                </button>
              ))}
            </nav>
          )}
          <div className="prose" dangerouslySetInnerHTML={{ __html: a.html }} />
          <section className="note-panel">
            <div className="section-head">
              <h2>我的笔记</h2>
              <span className="small-note" role="status">
                {saveStatus}
              </span>
            </div>
            <textarea
              aria-label="我的笔记"
              placeholder="写下你的理解、待验证的问题，或项目中的真实经历…"
              value={state.notes[a.id] || ""}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  notes: { ...s.notes, [a.id]: e.target.value },
                }))
              }
            />
            <p>仅保存在此浏览器，不进入知识库正文或公开搜索。</p>
          </section>
          {state.settings.practice &&
            state.settings.savePractice &&
            state.practice.filter((p) => p.articleId === a.id).length > 0 && (
              <section className="note-panel">
                <h2>已保存的练习</h2>
                {state.practice
                  .filter((p) => p.articleId === a.id)
                  .map((p) => (
                    <details className="practice-history" key={p.id}>
                      <summary>
                        {p.date.slice(0, 10)} · 自评分 {p.score}/4 ·{" "}
                        {Math.floor(p.seconds / 60)} 分 {p.seconds % 60} 秒
                      </summary>
                      <strong>{p.question}</strong>
                      <p>{p.answer}</p>
                    </details>
                  ))}
              </section>
            )}
          <section className="related">
            <h2>{pathReadings.length ? "对应学习正文" : "延伸阅读"}</h2>
            <p className="small-note">关联帮助继续学习，不改变文章所属分类。</p>
            {related.map((x) => (
              <button key={x.id} onClick={() => openArticle(x.id)}>
                <FileText size={17} />
                {x.title}
                <span className="small-note">{cats.find((c) => c.id === x.category)?.name}</span>
                <ChevronRight size={17} />
              </button>
            ))}
          </section>
        </article>
        <aside className="reader-toc">
          <span>本篇目录</span>
          {a.toc
            .filter((t) => a.type === "面经详解" ? t.level === 2 : t.level <= 3)
            .map((t) => (
              <button
                key={t.id}
                style={{ paddingLeft: t.level === 3 ? 12 : 0 }}
                onClick={() => scroll(t.id)}
              >
                {t.text.replace(/^\d+\. /, "")}
              </button>
            ))}
          <div className="toc-note">
            <BookOpen size={18} />
            <p>自由跳读，无需按顺序完成。</p>
          </div>
        </aside>
      </div>
    </>
  );
}
function CategoryEditor({
  value,
  onClose,
  cats,
  state,
  save,
}: {
  value: Category | null;
  onClose: () => void;
  cats: Category[];
  state: LabState;
  save: (c: Category, links: string[]) => void;
}) {
  const [draft, setDraft] = useState<Category | null>(null),
    [links, setLinks] = useState<string[]>([]);
  useEffect(() => {
    setDraft(value);
    setLinks(value ? state.links[value.id] || [] : []);
  }, [value]);
  return (
    <Dialog open={!!value} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>{value?.name ? "编辑分类" : "新增分类"}</DialogTitle>
          <DialogDescription>
            改变分类不改变文章 ID。你可以关联现有文章，内容仍只维护一份。
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save({ ...draft, name: draft.name.trim() }, links);
            }}
          >
            <label>
              分类名称
              <input
                required
                maxLength={60}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              简介
              <input
                maxLength={300}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <div className="field-row">
              <label>
                导航组
                <Picker
                  label="导航组"
                  value={draft.group}
                  onChange={(v) =>
                    setDraft({ ...draft, group: v as Category["group"] })
                  }
                  items={["技术知识", "资深能力"].map((v) => ({
                    value: v,
                    label: v,
                  }))}
                />
              </label>
              <label>
                排序
                <input
                  type="number"
                  min="1"
                  max="9999"
                  required
                  value={draft.order}
                  onChange={(e) =>
                    setDraft({ ...draft, order: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              父分类
              <Picker
                label="父分类"
                value={draft.parent || "root"}
                onChange={(v) =>
                  setDraft({ ...draft, parent: v === "root" ? undefined : v })
                }
                items={[
                  { value: "root", label: "一级分类" },
                  ...cats
                    .filter((c) => c.id !== draft.id)
                    .map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </label>
            <label>关联已有内容</label>
            <div className="association-list">
              {articles.map((a) => (
                <label key={a.id}>
                  <Checkbox
                    checked={links.includes(a.id)}
                    onCheckedChange={(v) =>
                      setLinks((xs) =>
                        v ? [...xs, a.id] : xs.filter((x) => x !== a.id),
                      )
                    }
                  />
                  <span>{a.title}</span>
                </label>
              ))}
            </div>
            <label className="check-row">
              <Checkbox
                checked={!!draft.hidden}
                onCheckedChange={(v) => setDraft({ ...draft, hidden: !!v })}
              />
              归档分类（保留内容和个人记录）
            </label>
            <Button type="submit" disabled={!draft.name.trim()}>
              保存分类
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
function Practice({
  article,
  onClose,
  state,
  save,
}: {
  article: Article | null;
  onClose: () => void;
  state: LabState;
  save: (r: LabState["practice"][number]) => void;
}) {
  const [answer, setAnswer] = useState(""),
    [score, setScore] = useState("2"),
    [seconds, setSeconds] = useState(0),
    [running, setRunning] = useState(false),
    [showReference, setShowReference] = useState(false),
    [index, setIndex] = useState(0),
    [saved, setSaved] = useState(false);
  const questions = useMemo(() => {
    const q =
      article?.markdown
        .split("\n")
        .filter((l) => /[？?]/.test(l) && !l.includes("http"))
        .map((l) => l.replace(/^\d+\.\s*|^-\s*|^#+\s*/g, "")) || [];
    return q.length
      ? q
      : [
          "请用 90 秒说明这个主题的关键机制、适用条件，以及一个需要验证的边界。",
        ];
  }, [article]);
  useEffect(() => {
    setAnswer("");
    setScore("2");
    setSeconds(0);
    setRunning(false);
    setShowReference(false);
    setIndex(0);
    setSaved(false);
  }, [article]);
  useEffect(() => {
    if (!running || !article || !state.settings.practice) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, article, state.settings.practice]);
  return (
    <Dialog
      open={!!article && state.settings.practice}
      onOpenChange={(v) => !v && onClose()}
    >
      <DialogContent className="practice-dialog">
        <DialogHeader>
          <DialogTitle>专项练习</DialogTitle>
          <DialogDescription>
            {article?.title} · 自评分不代表面试结论
          </DialogDescription>
        </DialogHeader>
        <div className="practice-clock">
          <span>
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")}
          </span>
          <Button variant="outline" onClick={() => setRunning(!running)}>
            {running ? "暂停计时" : "开始计时"}
          </Button>
        </div>
        <div className="practice-question">
          <span>
            问题 {index + 1} / {questions.length}
          </span>
          <h3>{questions[index]}</h3>
        </div>
        <textarea
          aria-label="练习回答"
          placeholder="先写下你的解释，再查看原文核对。"
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value);
            setSaved(false);
          }}
        />
        <div className="button-row">
          <Button
            variant="outline"
            onClick={() => setShowReference(!showReference)}
          >
            {showReference ? "收起原文" : "查看原文核对"}
          </Button>
          <Picker
            label="自评分"
            value={score}
            onChange={setScore}
            items={[
              { value: "0", label: "0 · 尚不清楚" },
              { value: "1", label: "1 · 提示后能答" },
              { value: "2", label: "2 · 基本正确" },
              { value: "3", label: "3 · 能解释变式" },
              { value: "4", label: "4 · 能说明边界与取舍" },
            ]}
          />
        </div>
        {showReference && article && (
          <div
            className="practice-reference prose"
            dangerouslySetInnerHTML={{ __html: article.html }}
          />
        )}
        <div className="notice-box">
          {state.settings.savePractice
            ? "你可以手动保存本次练习；不会自动改变学习进度。"
            : "当前为临时练习，关闭后不留存。需要保留时，可先复制回答，再到设置开启练习记录。"}
        </div>
        <div className="button-row">
          {state.settings.savePractice && (
            <Button
              disabled={!answer.trim() || saved}
              onClick={() => {
                if (article) {
                  save({
                    id: crypto.randomUUID(),
                    articleId: article.id,
                    question: questions[index],
                    answer,
                    score: Number(score),
                    seconds,
                    date: new Date().toISOString(),
                  });
                  setSaved(true);
                  setRunning(false);
                }
              }}
            >
              {saved ? "已保存" : "保存本次练习"}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={index >= questions.length - 1}
            onClick={() => {
              setIndex((i) => i + 1);
              setAnswer("");
              setSaved(false);
              setSeconds(0);
              setRunning(false);
              setShowReference(false);
            }}
          >
            下一题
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function AlgorithmView({ openArticle }: { openArticle: (id: string) => void }) {
  const [difficulty, setDifficulty] = useState("全部难度"),
    [keyword, setKeyword] = useState("");
  const list = content.algorithms.filter(
    (a) =>
      (difficulty === "全部难度" || a.difficulty === difficulty) &&
      [a.number, a.title, a.company, a.category]
        .join(" ")
        .toLowerCase()
        .includes(keyword.toLowerCase()),
  );
  return (
    <>
      <div className="algorithm-intro">
        <div>
          <span className="kind">首批核验</span>
          <h2>少而有据，回到原题练习</h2>
          <p>A：原帖明确编号或题名。B：题意映射，现场完整约束可能有差别。</p>
        </div>
        <Button
          variant="outline"
          onClick={() => openArticle("interview-sources")}
        >
          面经来源索引
        </Button>
      </div>
      <div className="filter-bar">
        <input
          className="search-field"
          aria-label="筛选算法"
          placeholder="搜索题号、题名或公司"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Picker
          label="算法难度"
          value={difficulty}
          onChange={setDifficulty}
          items={["全部难度", "简单", "中等", "困难"].map((v) => ({
            value: v,
            label: v,
          }))}
        />
        <span>{list.length} 道</span>
      </div>
      <div className="table-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编号 / 题目</TableHead>
              <TableHead>难度</TableHead>
              <TableHead>考察内容</TableHead>
              <TableHead>面经出处</TableHead>
              <TableHead>匹配依据</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((a) => (
              <TableRow key={a.number}>
                <TableCell>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="problem-link"
                  >
                    <span>{a.number}</span>
                    {a.title}
                    <ExternalLink size={13} />
                  </a>
                </TableCell>
                <TableCell>
                  <span className={`difficulty level-${a.difficulty}`}>
                    {a.difficulty}
                  </span>
                </TableCell>
                <TableCell>{a.category}</TableCell>
                <TableCell>
                  <a href={a.source} target="_blank" rel="noopener noreferrer">
                    {a.company}
                  </a>
                  <small>{a.date}</small>
                </TableCell>
                <TableCell className="evidence-cell">{a.evidence}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!list.length && (
          <Blank
            title="没有匹配题目"
            description="调整公司关键词或难度筛选。"
          />
        )}
      </div>
      <div className="notice-box">
        原题在力扣中国打开。本网站不会自动读取力扣提交记录，也不会把打开题目当作完成。
      </div>
      <Button variant="outline" onClick={() => openArticle("algorithm-list")}>
        查看完整题单与待核验变式
      </Button>
    </>
  );
}

"use client";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
const techs = [
  {
    id: "web",
    name: "H5 / JSBridge",
    layer: "Web 页面、业务逻辑",
    render: "浏览器内核渲染，桥接调用受控平台能力",
    strength: "Web 资产复用，内容更新灵活，适合多入口投放",
    cost: "首屏加载、内核差异、复杂交互和桥接安全",
    scene: "运营活动、内容展示、表单与 Web 业务承载",
    question: "页面退出后回调由谁清理？离线资源如何降级？",
    url: "https://developer.android.com/develop/ui/views/layout/webapps/webview?hl=zh-cn",
  },
  {
    id: "flutter",
    name: "Flutter",
    layer: "Dart 业务逻辑与 UI",
    render: "框架与引擎负责主要 UI 绘制，平台能力另行集成",
    strength: "统一设计与自定义 UI，可共享较多界面和业务",
    cost: "引擎、包体和启动成本，平台视图与插件适配",
    scene: "统一品牌界面、自定义 UI、逐页接入的业务",
    question: "混合页面的布局、输入、生命周期如何协作？",
    url: "https://docs.flutter.cn/resources/architectural-overview/",
  },
  {
    id: "rn",
    name: "React Native",
    layer: "JS/TS 业务逻辑与组件描述",
    render: "原生组件与平台模块参与实现，新旧架构分开分析",
    strength: "React 团队与资产复用，可渐进接入原生 App",
    cost: "JS 计算、线程边界、原生模块兼容与升级",
    scene: "React 团队主导的业务页面与原生 App 局部模块",
    question: "新架构减少了哪些成本？还有哪些跨边界成本？",
    url: "https://reactnative.dev/architecture/landing-page",
  },
  {
    id: "kmp",
    name: "KMP + 原生 UI",
    layer: "业务规则、数据层、SDK",
    render: "共享逻辑由平台后端编译，UI 各端分别实现",
    strength: "逻辑复用与原生 UI 独立选择，适合渐进迁移",
    cost: "仍需多套 UI；Swift 互操作、构建调试和库支持",
    scene: "保留成熟原生 UI，消除规则或数据层重复",
    question: "平台依赖如何隔离？取消与错误模型如何跨语言传递？",
    url: "https://kotlinlang.org/docs/multiplatform/kmp-overview.html",
  },
  {
    id: "cmp",
    name: "KMP + CMP",
    layer: "共享业务逻辑与声明式 UI",
    render: "渲染及平台互操作按目标平台区分",
    strength: "复用 Kotlin / Compose 经验，共享可延伸到 UI",
    cost: "平台生态、文本输入、无障碍、平台视图与迁移验证",
    scene: "Kotlin 团队，希望共享 UI 且能验证多端体验",
    question: "Android 的状态和生命周期假设能否直接套用到 iOS？",
    url: "https://kotlinlang.org/multiplatform/",
  },
  {
    id: "native",
    name: "原生基线",
    layer: "协议、接口、部分底层库",
    render: "Android / iOS 平台 UI 分别实现",
    strength: "平台能力集成直接，各端体验可独立打磨",
    cost: "重复建设、多端行为一致性与协作成本",
    scene: "平台交互密集，或已有成熟原生技术资产",
    question: "不迁移框架，还有哪些办法减少重复工作？",
    url: "https://developer.android.com/develop/ui",
  },
];
const rows = [
  ["layer", "复用边界"],
  ["render", "运行与渲染"],
  ["strength", "主要优势"],
  ["cost", "成本与边界"],
  ["scene", "适用场景"],
  ["question", "继续追问"],
] as const;
export default function Comparison({
  openArticle,
}: {
  openArticle: (id: string) => void;
}) {
  const [selected, setSelected] = useState(["flutter", "rn", "kmp"]);
  const shown = techs.filter((t) => selected.includes(t.id));
  return (
    <>
      <div className="comparison-controls">
        {techs.map((t) => (
          <label
            key={t.id}
            className={selected.includes(t.id) ? "selected" : ""}
          >
            <Checkbox
              checked={selected.includes(t.id)}
              disabled={selected.length === 1 && selected.includes(t.id)}
              onCheckedChange={(v) =>
                setSelected((xs) =>
                  v ? [...xs, t.id] : xs.filter((x) => x !== t.id),
                )
              }
            />
            {t.name}
          </label>
        ))}
      </div>
      <div className="table-panel comparison-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>比较维度</TableHead>
              {shown.map((t) => (
                <TableHead key={t.id}>{t.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([key, label]) => (
              <TableRow key={key}>
                <TableCell>{label}</TableCell>
                {shown.map((t) => (
                  <TableCell key={t.id}>{t[key]}</TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell>机制依据</TableCell>
              {shown.map((t) => (
                <TableCell key={t.id}>
                  <a href={t.url} target="_blank" rel="noopener noreferrer">
                    官方文档
                  </a>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="notice-box">
        适用场景是基于机制的工程判断，不是性能排名。JSBridge 是通信机制；KMP
        的逻辑共享与 CMP 的 UI
        共享分开评估。实际表现需在相同业务、版本和设备条件下验证。
      </div>
      <div className="comparison-reading">
        <button onClick={() => openArticle("cross-chapter-5")}>
          <span className="kind">场景选型</span>
          <h2>从业务约束推出候选方案</h2>
          <p>运营活动、复杂列表、共享 SDK、既有 App 迁移。</p>
        </button>
        <button onClick={() => openArticle("cross-chapter-6")}>
          <span className="kind">App 实践</span>
          <h2>看见采用范围与时间边界</h2>
          <p>闲鱼、贝壳、美团、腾讯等公开案例与资料局限。</p>
        </button>
        <button onClick={() => openArticle("cross-chapter-7")}>
          <span className="kind">面试总结</span>
          <h2>从框架细节提升到技术决策</h2>
          <p>90 秒表达结构，逐层追问到成本、演进与证据。</p>
        </button>
      </div>
      <Button variant="outline" onClick={() => openArticle("cross-overview")}>
        阅读完整跨端专题
      </Button>
      <div className="section-title"><h2>进入机制与工程正文</h2></div>
      <div className="button-row">
        <Button variant="outline" onClick={() => openArticle("flutter-runtime")}>Flutter 三层对象与混合栈</Button>
        <Button variant="outline" onClick={() => openArticle("rn-architecture")}>RN 新架构与调用边界</Button>
        <Button variant="outline" onClick={() => openArticle("kmp-boundaries")}>KMP / CMP 共享边界</Button>
        <Button variant="outline" onClick={() => openArticle("cross-boundaries")}>JSBridge 协议与安全</Button>
      </div>
    </>
  );
}

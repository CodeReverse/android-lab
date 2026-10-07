import { z } from "zod";
const id = z.string().min(1).max(150);
export const categorySchema = z.object({
  id,
  name: z.string().min(1).max(60),
  group: z.enum(["技术知识", "资深能力"]),
  description: z.string().max(300),
  topics: z.array(z.string().max(80)).max(20),
  icon: z.string().max(60),
  order: z.number().finite(),
  parent: z.string().optional(),
  hidden: z.boolean().optional(),
});
export type Category = z.infer<typeof categorySchema>;
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  settings: z.object({
    progress: z.boolean(),
    practice: z.boolean(),
    savePractice: z.boolean(),
    dark: z.boolean(),
  }),
  bookmarks: z.array(id).max(5000),
  notes: z.record(id, z.string().max(100000)),
  progress: z.record(
    id,
    z.object({
      status: z.enum(["待学习", "学习中", "已掌握"]),
      version: z.number(),
      updated: z.string(),
    }),
  ),
  practice: z
    .array(
      z.object({
        id,
        articleId: id,
        question: z.string().max(10000),
        answer: z.string().max(100000),
        score: z.number().min(0).max(4),
        seconds: z.number().nonnegative(),
        date: z.string(),
      }),
    )
    .max(5000),
  categories: z.array(categorySchema).max(500),
  links: z.record(id, z.array(id).max(5000)),
});
export type LabState = z.infer<typeof stateSchema>;
export const initialState = (): LabState => ({
  schemaVersion: 1,
  settings: {
    progress: false,
    practice: false,
    savePractice: false,
    dark: false,
  },
  bookmarks: [],
  notes: {},
  progress: {},
  practice: [],
  categories: [],
  links: {},
});
export function validateState(value: unknown): LabState {
  const data = stateSchema.parse(value);
  const ids = new Set<string>();
  for (const c of data.categories) {
    if (ids.has(c.id)) throw Error("分类 ID 重复");
    ids.add(c.id);
  }
  const byId = new Map(data.categories.map((c) => [c.id, c]));
  for (const c of data.categories) {
    const visited = new Set([c.id]);
    let p = c.parent;
    while (p && byId.has(p)) {
      if (visited.has(p)) throw Error("分类层级存在循环");
      visited.add(p);
      p = byId.get(p)?.parent;
    }
  }
  return data;
}
export function setProgress(
  state: LabState,
  articleId: string,
  version: number,
  status: "待学习" | "学习中" | "已掌握",
): LabState {
  if (!state.settings.progress) return state;
  return {
    ...state,
    progress: {
      ...state.progress,
      [articleId]: { status, version, updated: new Date().toISOString() },
    },
  };
}
export function savePractice(
  state: LabState,
  record: LabState["practice"][number],
): LabState {
  if (!state.settings.practice || !state.settings.savePractice) return state;
  return { ...state, practice: [record, ...state.practice] };
}
export function searchArticles<
  T extends {
    title: string;
    tags: string[];
    markdown: string;
    summary: string;
  },
>(articles: T[], query: string): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return articles;
  return articles
    .map((a) => ({
      a,
      score: terms.reduce(
        (s, t) =>
          s +
          (a.title.toLocaleLowerCase().includes(t) ? 8 : 0) +
          (a.tags.join(" ").toLocaleLowerCase().includes(t) ? 4 : 0) +
          (a.markdown.toLocaleLowerCase().includes(t) ? 1 : 0),
        0,
      ),
    }))
    .filter(({ a }) =>
      terms.every((t) =>
        [a.title, ...a.tags, a.markdown]
          .join(" ")
          .toLocaleLowerCase()
          .includes(t),
      ),
    )
    .sort((a, b) => b.score - a.score)
    .map((x) => x.a);
}
export function mergedCategories(base: Category[], custom: Category[]) {
  const map = new Map(base.map((c) => [c.id, c]));
  for (const c of custom) map.set(c.id, c);
  return [...map.values()].sort((a, b) => a.order - b.order);
}

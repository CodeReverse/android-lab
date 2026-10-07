// Topic ownership is explicit. Cross-links never change an article's subject.
export function categoryContent<T extends { category: string }>(
  articles: T[],
  categories: { id: string; parent?: string }[],
  categoryId: string,
): T[] {
  const descendants = new Set([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parent && descendants.has(c.parent) && !descendants.has(c.id)) {
        descendants.add(c.id);
        changed = true;
      }
    }
  }
  return articles.filter((a) => descendants.has(a.category));
}

export function filterCatalog<T extends { type: string; topic: string; origin: string }>(
  articles: T[],
  filters: { kind: string; topic: string; origin: string },
): T[] {
  return articles.filter((a) =>
    (filters.kind === "全部内容" || a.type === filters.kind) &&
    (filters.topic === "全部专题" || a.topic === filters.topic) &&
    (filters.origin === "全部依据" || a.origin === filters.origin),
  );
}

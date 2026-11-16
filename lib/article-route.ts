/** Article identity stays independent of optional chapter navigation. */
export function parseArticleRoute(route: string): { id: string; section?: number } | null {
  const match = route.replace(/^#?\/?/, "").match(/^article\/([a-z0-9-]+)(?:\?([^#]*))?$/);
  if (!match) return null;
  const params = new URLSearchParams(match[2]);
  if ([...params.keys()].some((key) => key !== "section") || params.getAll("section").length > 1) return null;
  const value = params.get("section");
  if (value === null) return { id: match[1] };
  if (!/^[1-9]\d*$/.test(value)) return null;
  const section = Number(value);
  return Number.isSafeInteger(section) ? { id: match[1], section } : null;
}

export function articleSectionAnchor(
  toc: ReadonlyArray<{ id: string; text: string; level: number }>,
  section?: number,
): string | undefined {
  return section === undefined ? undefined : toc.find((heading) =>
    heading.level === 2 && heading.text.startsWith(`${section}. `),
  )?.id;
}

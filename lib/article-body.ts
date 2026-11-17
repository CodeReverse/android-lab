/** A source chapter may become its own page; the page header already owns its title. */
export function stripRepeatedTitle(body: string, title: string): string {
  const heading = body.match(/^\s*#{1,3} ([^\n]+)\n(?:\s*\n)*/);
  if (!heading) return body;
  const normalize = (value: string) => value.trim().replace(/^\d+\.\s*/, "").replace(/\s+/g, " ");
  return normalize(heading[1]) === normalize(title) ? body.slice(heading[0].length) : body;
}

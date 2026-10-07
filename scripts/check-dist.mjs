import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const base = process.env.PAGES_BASE_PATH || "/";
const assetLinks = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
assert.ok(assetLinks.some((url) => url.endsWith(".js")), "Built entry script exists");
assert.ok(assetLinks.some((url) => url.endsWith(".css")), "Built stylesheet exists");
for (const url of assetLinks) {
  assert.ok(url.startsWith(base), `Asset must use deployment base: ${url}`);
  assert.ok(fs.existsSync(path.join(dist, url.slice(base.length))), `Missing asset: ${url}`);
}
assert.ok(fs.existsSync(path.join(dist, ".nojekyll")));
assert.ok(!fs.existsSync(path.join(dist, "server")), "Pages output has no server runtime");
assert.ok(!fs.existsSync(path.join(dist, ".openai")), "No hosting configuration in output");
console.log(`Static deployment verified at ${base}: ${assetLinks.length} asset links`);

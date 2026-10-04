import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5201").origin;
let checks = 0;
async function get(path, status = 200) {
  const response = await fetch(new URL(path, origin), {
    redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, status, `${path}: unexpected HTTP status`);
  checks++;
  return response;
}

const homepage = await get("/");
const html = await homepage.text();
assert.match(html, /id="root"/);
assert.match(html, /<noscript>[\s\S]*href="\/help\/ko\.html"[\s\S]*<\/noscript>/);
assert.equal(await (await get("/?auth_error=google")).text(), html);
const csp = homepage.headers.get("content-security-policy") ?? "";
assert.match(csp, /script-src[^;]*https:\/\/static\.cloudflareinsights\.com(?:;|\s)/);
assert.match(csp, /connect-src[^;]*https:\/\/cloudflareinsights\.com(?:;|\s)/);
assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);

const sitemap = new JSDOM(await (await get("/sitemap.xml")).text(), { contentType: "application/xml" });
for (const loc of sitemap.window.document.querySelectorAll("loc")) {
  const canonical = new URL(loc.textContent);
  if (canonical.pathname === "/") continue;
  const page = new JSDOM(await (await get(canonical.pathname)).text());
  assert.equal(page.window.document.querySelector('link[rel="canonical"]')?.href, canonical.href);
  assert.ok(page.window.document.querySelector("h1"), `${canonical.pathname}: missing article`);
  const alias = canonical.pathname.replace(/\.html$/, "");
  for (const path of [alias, `${alias}/`]) {
    const response = await get(path, 301);
    assert.equal(new URL(response.headers.get("location"), origin).pathname, canonical.pathname);
  }
  page.window.close();
}
sitemap.window.close();
for (const path of ["/__missing__", "/help/__missing__.html", "/assets/__missing__.js"]) {
  const body = await (await get(path, 404)).text();
  assert.match(body, /Page not found/);
  assert.doesNotMatch(body, /id="root"/);
}
const api = await get("/api/__missing__", 404);
assert.match(api.headers.get("content-type"), /application\/json/);
await get("/robots.txt");
await get("/ads.txt");
await get("/help/kabamanda-team.txt");
console.log(`Public routing checks passed (${checks} HTTP responses): ${origin}`);

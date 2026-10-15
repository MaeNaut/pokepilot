import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5201").origin;
const checkCanonicalHosts = process.argv.includes("--check-canonical-hosts");
if (checkCanonicalHosts) {
  assert.equal(origin, "https://pokepilot.app", "Host checks are production-only");
}
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
if (checkCanonicalHosts) {
  // These redirects are zone settings, not Worker asset-routing rules.
  for (const host of ["http://pokepilot.app", "http://www.pokepilot.app", "https://www.pokepilot.app"]) {
    for (const path of ["/?source=seo-check", "/help/ko.html?source=seo-check&lang=ko"]) {
      let current = new URL(path, host);
      const expected = new URL(path, origin).href;
      for (let hop = 0; current.href !== expected; hop++) {
        assert.ok(hop < 3, `${host}${path}: redirect loop or excessive hops`);
        const response = await fetch(current, {
          redirect: "manual", signal: AbortSignal.timeout(15000),
        });
        checks++;
        assert.ok([301, 308].includes(response.status), `${current.href}: expected permanent HTTPS/canonical redirect, got ${response.status}`);
        assert.ok(response.headers.get("location"), `${current.href}: missing Location`);
        const next = new URL(response.headers.get("location"), current);
        assert.equal(next.protocol, "https:", `${current.href}: redirect must use HTTPS`);
        assert.ok(["pokepilot.app", "www.pokepilot.app"].includes(next.hostname), "Unexpected redirect host");
        assert.equal(next.pathname, current.pathname, "Redirect changed the path");
        assert.equal(next.search, current.search, "Redirect changed the query string");
        current = next;
      }
      await get(expected);
    }
  }
}
console.log(`Public routing checks passed (${checks} HTTP responses): ${origin}`);

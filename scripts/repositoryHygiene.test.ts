import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const privatePaths = [
  ".env", ".env.production", ".env.evaluation", ".env.shared.local",
  ".dev.vars", ".dev.vars.preview", "COMMERCIALIZATION.local.md",
  "client_secret_download.json", "service-account-production.json",
  "private.pem", "private.key", "identity.p12", "identity.pfx",
  "artifacts/metrics/report.json", "artifacts/ai-evaluation/result.json",
  ".wrangler/state/database.sqlite", ".netlify/state.json", ".vercel/project.json",
  "dist/index.html", "node_modules/example/index.js", "coverage/report.json",
  "playwright-report/index.html", "test-results/screenshot.png",
  "build.tsbuildinfo", "debug.log", ".DS_Store", "Thumbs.db",
];

function ignored(paths: string[]) {
  return execFileSync("git", ["check-ignore", "--no-index", "--stdin"], {
    input: paths.join("\n") + "\n",
    encoding: "utf8",
  }).trim().split(/\r?\n/);
}

describe("repository hygiene", () => {
  it("ignores local secrets, reports, and generated artifacts", () => {
    expect(ignored(privatePaths)).toEqual(privatePaths);
  });

  it("keeps templates and public build configuration versionable", () => {
    expect(ignored([".env.production", ".env.example", ".env.shared.example", ".env.cloudflare"])).toEqual([".env.production"]);
    const assignments = readFileSync(".env.cloudflare", "utf8")
      .split(/\r?\n/).map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    expect(assignments).toEqual(["VITE_ACCOUNT_AUTH_ENABLED=true"]);
  });

  it("has no tracked files covered by the repository ignore rules", () => {
    expect(execFileSync("git", ["ls-files", "--cached", "--ignored", "--exclude-per-directory=.gitignore"], {
      encoding: "utf8",
    }).trim()).toBe("");
  });
});

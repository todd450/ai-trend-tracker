/**
 * Run by check.sh after `next build`. Serves the built site on this machine and opens it in
 * headless Chrome, so what only a browser does (scripts running, a link's #anchor being followed)
 * is checked as a reader gets it. Set CHROME to the browser's path if it is not in a usual place.
 */
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";

const ROOT = join(import.meta.dirname, "../..");
const APP = join(ROOT, ".next/server/app");

const CHROME = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((path) => path && existsSync(path));

const freePort = () =>
  new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });

let origin = "";
let site: ReturnType<typeof spawn> | undefined;
const profile = mkdtempSync(join(tmpdir(), "chrome-"));

before(async () => {
  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  site = spawn(join(ROOT, "node_modules/.bin/next"), ["start", "-H", "127.0.0.1", "-p", String(port)], { cwd: ROOT, stdio: "ignore" });
  for (let tries = 0; tries < 100; tries++) {
    try {
      if ((await fetch(origin + "/")).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("the built site did not start");
});

after(() => {
  site?.kill();
  rmSync(profile, { recursive: true, force: true });
});

/** The page at `path` as the browser holds it once its scripts have run. */
async function rendered(path: string): Promise<string> {
  assert.ok(CHROME, "no Chrome found: set CHROME to its path");
  const { stdout } = await promisify(execFile)(
    CHROME,
    ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, "--virtual-time-budget=10000", "--dump-dom", origin + path],
    { maxBuffer: 64 * 1024 * 1024, timeout: 60_000 },
  );
  return stdout;
}

/** The opening tag of the list that holds the row with this id, and the row's place in it. */
function listOf(html: string, id: string) {
  const at = html.indexOf(`id="${id}"`);
  assert.ok(at >= 0, `#${id} is on the page`);
  const open = html.lastIndexOf('<ol class="mom__list"', at);
  const tag = html.slice(open, html.indexOf(">", open) + 1);
  const place = html.slice(open, at).split("<li").length - 1;
  return { tag, place };
}

/** Product rows the trends page keeps folded away: past the fifth in their group. */
const folded = () => {
  const html = readFileSync(join(APP, "three-months.html"), "utf8");
  return [...html.matchAll(/id="(product-[^"]+)"/g)].map((m) => m[1]).filter((id) => listOf(html, id).place > 5);
};

test("a link to a product row folded under “Show all” opens its group", async () => {
  const ids = folded();
  assert.ok(ids.length > 0, "some product rows start folded");
  const id = ids[0];
  const closed = await rendered("/three-months");
  assert.match(listOf(closed, id).tag, /data-open="false"/, "the group starts folded");
  const followed = await rendered(`/three-months#${id}`);
  assert.match(listOf(followed, id).tag, /data-open="true"/, `following /three-months#${id} opens its group`);
});

test("a malformed #fragment in a shared link leaves the trends page whole", async () => {
  const groups = (html: string) => html.split('<ol class="mom__list"').length - 1;
  const whole = groups(await rendered("/three-months"));
  assert.ok(whole > 0, "the trends page has trend groups");
  // Fragments that are not valid percent-encoding, as a mangled or hand-typed link can carry.
  for (const hash of ["%", "%E0%A4%A", "%zz", "product-%"]) {
    assert.equal(groups(await rendered(`/three-months#${hash}`)), whole, `/three-months#${hash} renders the same groups as /three-months`);
  }
});

test("an old link to a trend row on the landing page is followed on the trends page", async () => {
  // The trends were the landing page before the news was, so `/#product-…` links are still about.
  const id = folded()[0];
  const followed = await rendered(`/#${id}`);
  assert.match(listOf(followed, id).tag, /data-open="true"/, `/#${id} ends on the trends page with its group open`);
  // A fragment the news page has itself stays there.
  assert.ok((await rendered("/#today")).includes('id="today-h"'), "/#today stays on the news page");
});

test("the news page's old address sends readers to the landing page", async () => {
  const response = await fetch(origin + "/today", { redirect: "manual" });
  assert.equal(response.status, 308);
  assert.equal(new URL(response.headers.get("location")!, origin).pathname, "/");
});

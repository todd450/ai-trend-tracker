/** Run with `npm test`. Only the events on the calendar have a page; any other id is a 404 before anything renders. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import calendar from "../data/conferences.json" with { type: "json" };
import { proxy } from "../src/proxy.ts";

const visit = (path: string) => proxy(new NextRequest(new URL(path, "https://example.com")));

test("an id that is not on the calendar gets a 404", () => {
  const known = calendar.conferences[0].id;
  for (const id of [
    "nope",
    `r1-${Math.random().toString(36).slice(2)}`,
    known.toUpperCase(),
    `${known}-x`,
    `x${known}`,
    encodeURIComponent(`${known} `),
    "constructor",
    "__proto__",
    "toString",
  ]) {
    assert.equal(visit(`/conferences/${id}`)?.status, 404, id);
  }
});

test("every event on the calendar gets through to its page", () => {
  for (const { id } of calendar.conferences) {
    const res = visit(`/conferences/${id}`);
    assert.notEqual(res?.status, 404, id);
  }
});

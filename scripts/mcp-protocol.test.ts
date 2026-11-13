/** Run with `npm test`. The protocol layer of the MCP server at /mcp, with a stand-in tool. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_BODY_BYTES, PROTOCOL_VERSIONS, ToolError, answerPost, type ServerInfo, type Tool } from "../src/lib/mcp/protocol.ts";

const SERVER: ServerInfo = { name: "test", title: "Test", version: "1.0.0", websiteUrl: "https://example.com", instructions: "Read-only." };

const echo: Tool = {
  name: "echo",
  title: "Echo",
  description: "Returns its arguments.",
  input: {
    word: { type: "string", description: "A word.", enum: ["one", "two"], default: "one" },
    count: { type: "integer", description: "A count.", minimum: 1, maximum: 5, default: 3 },
    note: { type: "string", description: "Free text." },
  },
  run(args) {
    if (args.note === "bad") throw new ToolError("That note is not known.");
    if (args.note === "crash") throw new Error("boom");
    return { ...args };
  },
};
const TOOLS = [echo];

const post = (message: unknown, header: string | null = null) => answerPost(JSON.stringify(message), header, TOOLS, SERVER);
const call = (args: unknown, name = "echo") => post({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = (r: { json?: unknown }) => r.json as any;

test("initialize agrees on the client's version when it is known, and offers the newest otherwise", () => {
  const known = post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "c", version: "1" } } });
  assert.equal(known.status, 200);
  assert.equal(body(known).result.protocolVersion, "2025-06-18");
  assert.deepEqual(body(known).result.capabilities, { tools: { listChanged: false } });
  assert.equal(body(known).result.serverInfo.name, "test");
  assert.equal(body(known).result.instructions, "Read-only.");

  const unknown = post({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
  assert.equal(body(unknown).result.protocolVersion, PROTOCOL_VERSIONS[0]);
});

test("a notification or a client's response gets 202 and no body", () => {
  assert.deepEqual(post({ jsonrpc: "2.0", method: "notifications/initialized" }), { status: 202 });
  assert.deepEqual(post({ jsonrpc: "2.0", id: 3, result: {} }), { status: 202 });
});

test("ping answers with an empty result", () => {
  assert.deepEqual(body(post({ jsonrpc: "2.0", id: "p", method: "ping" })), { jsonrpc: "2.0", id: "p", result: {} });
});

test("tools/list describes each tool with its schema and marks it read-only", () => {
  const [tool] = body(post({ jsonrpc: "2.0", id: 4, method: "tools/list" })).result.tools;
  assert.equal(tool.name, "echo");
  assert.equal(tool.inputSchema.type, "object");
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.deepEqual(tool.inputSchema.properties.word.enum, ["one", "two"]);
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.destructiveHint, false);
});

test("tools/call fills defaults and returns structured content with the same JSON as text", () => {
  const { result } = body(call({ count: 2 }));
  assert.deepEqual(result.structuredContent, { word: "one", count: 2 });
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  assert.equal(result.isError, undefined);
  // No arguments at all is the same as an empty object.
  assert.deepEqual(body(call(undefined)).result.structuredContent, { word: "one", count: 3 });
});

test("wrong arguments come back as a tool error the model can read, not a protocol failure", () => {
  for (const [args, says] of [
    [{ word: "three" }, "one of: one, two"],
    [{ count: 9 }, "from 1 to 5"],
    [{ count: 2.5 }, "whole number"],
    [{ colour: "red" }, "Unknown argument colour"],
    [{ note: "" }, "1 to 100 characters"],
    [{ note: "x".repeat(101) }, "1 to 100 characters"],
    [["a"], "must be an object"],
    [{ note: "bad" }, "That note is not known."],
  ] as const) {
    const { result } = body(call(args));
    assert.equal(result.isError, true, JSON.stringify(args));
    assert.match(result.content[0].text, new RegExp(says.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("a fault in a tool is not dressed up as the caller's mistake", () => {
  assert.throws(() => call({ note: "crash" }), /boom/);
});

test("an unknown tool or method is a JSON-RPC error", () => {
  assert.equal(body(call({}, "nope")).error.code, -32602);
  assert.equal(body(post({ jsonrpc: "2.0", id: 5, method: "resources/list" })).error.code, -32601);
});

test("malformed input is refused with the right status", () => {
  const notJson = answerPost("{", null, TOOLS, SERVER);
  assert.equal(notJson.status, 400);
  assert.equal(body(notJson).error.code, -32700);

  assert.equal(body(post({ id: 6, method: "ping" })).error.code, -32600);
  assert.equal(body(post("ping")).error.code, -32600);
  assert.equal(post([]).status, 400);

  const header = post({ jsonrpc: "2.0", id: 8, method: "ping" }, "2024-01-01");
  assert.equal(header.status, 400);
  assert.match(body(header).error.message, /Unsupported MCP-Protocol-Version/);
  assert.equal(post({ jsonrpc: "2.0", id: 9, method: "ping" }, "2025-06-18").status, 200);

  const big = answerPost(JSON.stringify({ jsonrpc: "2.0", id: 10, method: "ping", params: { pad: "x".repeat(MAX_BODY_BYTES) } }), null, TOOLS, SERVER);
  assert.equal(big.status, 413);
});

test("a batch gets one answer per request, and none for its notifications", () => {
  const r = post([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "ping" },
  ]);
  assert.equal(r.status, 200);
  assert.deepEqual(body(r).map((a: { id: number }) => a.id), [1, 2]);
  assert.deepEqual(post([{ jsonrpc: "2.0", method: "notifications/initialized" }]), { status: 202 });
});

/**
 * The Model Context Protocol, the part this site needs: a read-only server that offers tools
 * over Streamable HTTP and answers each POST with plain JSON. It keeps no sessions and never
 * streams, which the protocol allows, so one stateless function answers every message.
 *
 * Written by hand rather than with the official SDK, which brings a web framework or two with
 * it. This file imports nothing, so `npm test` can run it under plain Node.
 * Spec: https://modelcontextprotocol.io/specification
 */

/** Newest first. A client asking for a version not listed here is offered the newest. */
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;

/** Free-text arguments longer than this are refused; every id the tools know is far shorter. */
const MAX_TEXT = 100;

/**
 * The parts of JSON Schema a tool's input uses: named fields that are strings (from a list when
 * `enum` is given, short free text otherwise) or whole numbers in a range.
 */
export type InputField =
  | { type: "string"; description: string; enum?: readonly string[]; default?: string }
  | { type: "integer"; description: string; minimum: number; maximum: number; default?: number };

export type Tool = {
  name: string;
  title: string;
  description: string;
  input: Record<string, InputField>;
  /** Fields that must be given. */
  required?: string[];
  /** Returns an object, sent back both as structured content and as JSON text. Throw a ToolError for a mistake the caller can fix. */
  run: (args: Record<string, string | number>) => Record<string, unknown>;
};

/** A mistake in a tool's arguments, reported to the model so it can try again, not as a protocol failure. */
export class ToolError extends Error {}

export type ServerInfo = { name: string; title: string; version: string; websiteUrl: string; instructions: string };

type Id = string | number;
type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: Id | null; result: unknown }
  | { jsonrpc: "2.0"; id: Id | null; error: { code: number; message: string } };

/** JSON-RPC's own error codes. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

const failure = (id: Id | null, code: number, message: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

/** The schema a client is shown for one tool. */
function inputSchema(tool: Tool) {
  return {
    type: "object",
    properties: tool.input,
    ...(tool.required?.length ? { required: tool.required } : {}),
    additionalProperties: false,
  };
}

/** Checks the arguments against the tool's fields and fills in defaults. Returns a message for the model when they are wrong. */
export function checkArguments(tool: Tool, given: unknown): { args: Record<string, string | number> } | { problem: string } {
  if (given !== undefined && (typeof given !== "object" || given === null || Array.isArray(given))) {
    return { problem: "Arguments must be an object." };
  }
  const raw = (given ?? {}) as Record<string, unknown>;
  const unknown = Object.keys(raw).filter((key) => !(key in tool.input));
  if (unknown.length) {
    return { problem: `Unknown argument ${unknown.join(", ")}. This tool takes: ${Object.keys(tool.input).join(", ") || "nothing"}.` };
  }
  const args: Record<string, string | number> = {};
  for (const [key, field] of Object.entries(tool.input)) {
    const value = raw[key] ?? field.default;
    if (value === undefined) {
      if (tool.required?.includes(key)) return { problem: `"${key}" is required.` };
      continue;
    }
    if (field.type === "string") {
      if (field.enum && (typeof value !== "string" || !field.enum.includes(value))) {
        return { problem: `"${key}" must be one of: ${field.enum.join(", ")}.` };
      }
      if (typeof value !== "string" || value.length === 0 || value.length > MAX_TEXT) {
        return { problem: `"${key}" must be text of 1 to ${MAX_TEXT} characters.` };
      }
    } else if (typeof value !== "number" || !Number.isInteger(value) || value < field.minimum || value > field.maximum) {
      return { problem: `"${key}" must be a whole number from ${field.minimum} to ${field.maximum}.` };
    }
    args[key] = value;
  }
  return { args };
}

function callTool(tools: Tool[], params: Record<string, unknown>): { error: string } | { result: unknown } {
  const tool = tools.find((t) => t.name === params.name);
  if (!tool) return { error: `Unknown tool: ${String(params.name)}` };
  const errorResult = (text: string) => ({ result: { content: [{ type: "text", text }], isError: true } });
  const checked = checkArguments(tool, params.arguments);
  if ("problem" in checked) return errorResult(checked.problem);
  try {
    const output = tool.run(checked.args);
    return { result: { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output } };
  } catch (e) {
    if (e instanceof ToolError) return errorResult(e.message);
    throw e;
  }
}

/** Answers one JSON-RPC message. Returns null for a notification or a response, which get no reply. */
export function answer(message: unknown, tools: Tool[], server: ServerInfo): JsonRpcResponse | null {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return failure(null, INVALID_REQUEST, "Expected a JSON-RPC message.");
  }
  const m = message as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  const hasId = typeof m.id === "string" || typeof m.id === "number";
  if (m.jsonrpc !== "2.0") return failure(hasId ? (m.id as Id) : null, INVALID_REQUEST, 'Expected "jsonrpc": "2.0".');
  // A response from the client (to a request this server never sends), or a notification such as notifications/initialized.
  if (typeof m.method !== "string") return hasId ? null : failure(null, INVALID_REQUEST, "Expected a method.");
  if (!hasId) return null;
  const id = m.id as Id;
  const params = (typeof m.params === "object" && m.params !== null ? m.params : {}) as Record<string, unknown>;

  switch (m.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const protocolVersion = PROTOCOL_VERSIONS.find((v) => v === asked) ?? PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: server.name, title: server.title, version: server.version, websiteUrl: server.websiteUrl },
          instructions: server.instructions,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: inputSchema(tool),
            annotations: { title: tool.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          })),
        },
      };
    case "tools/call": {
      const outcome = callTool(tools, params);
      return "error" in outcome ? failure(id, INVALID_PARAMS, outcome.error) : { jsonrpc: "2.0", id, result: outcome.result };
    }
    default:
      return failure(id, METHOD_NOT_FOUND, `Method not found: ${m.method}`);
  }
}

/** Larger bodies are refused: no message this server understands comes near it. */
export const MAX_BODY_BYTES = 64 * 1024;

/**
 * One HTTP POST: a single message, or (for clients on the 2025-03-26 version) a batch.
 * Only notifications and responses: 202 with no body. Otherwise 200 with the answers as JSON.
 */
export function answerPost(
  body: string,
  protocolHeader: string | null,
  tools: Tool[],
  server: ServerInfo,
): { status: number; json?: unknown } {
  if (protocolHeader && !PROTOCOL_VERSIONS.includes(protocolHeader as (typeof PROTOCOL_VERSIONS)[number])) {
    return { status: 400, json: failure(null, INVALID_REQUEST, `Unsupported MCP-Protocol-Version: ${protocolHeader}`) };
  }
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    return { status: 413, json: failure(null, INVALID_REQUEST, "Request too large.") };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { status: 400, json: failure(null, PARSE_ERROR, "Parse error: the body is not JSON.") };
  }
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { status: 400, json: failure(null, INVALID_REQUEST, "Empty batch.") };
    const answers = parsed.map((message) => answer(message, tools, server)).filter((a) => a !== null);
    return answers.length ? { status: 200, json: answers } : { status: 202 };
  }
  const reply = answer(parsed, tools, server);
  return reply ? { status: 200, json: reply } : { status: 202 };
}

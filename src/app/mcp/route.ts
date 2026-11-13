/**
 * The tracker's MCP server, at /mcp: AI assistants connect here to read the same trends the
 * site shows. It speaks MCP's Streamable HTTP transport without sessions or streaming:
 * every message is a POST answered with JSON (see src/lib/mcp/protocol.ts).
 *
 * The data is public and read-only, so any website may call it (CORS is open) and no sign-in is asked for.
 */
import { answerPost } from "@/lib/mcp/protocol";
import { SERVER, TOOLS } from "@/lib/mcp/tools";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Max-Age": "86400",
};

export async function POST(request: Request) {
  const body = await request.text();
  const { status, json } = answerPost(body, request.headers.get("mcp-protocol-version"), TOOLS, SERVER);
  return json === undefined ? new Response(null, { status, headers: CORS }) : Response.json(json, { status, headers: CORS });
}

/**
 * A client opens a GET to listen for messages the server starts on its own. This server never
 * starts one, and the protocol's answer for that is 405. A person who opens the address in a
 * browser gets the same answer, with a line saying what the address is for.
 */
export function GET() {
  return new Response(
    `This is ${SERVER.title}'s MCP server, for AI assistants. Add ${SERVER.websiteUrl}/mcp to an assistant as a remote MCP server (Streamable HTTP).\n`,
    { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS", "Content-Type": "text/plain; charset=utf-8" } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// "next/server.js" and the import attribute let `npm test` load this file in plain Node.
import { NextResponse, type NextRequest } from "next/server.js";
import calendar from "../data/conferences.json" with { type: "json" };

/**
 * Each event's page is built ahead of time. With Cache Components a route cannot refuse ids
 * it did not build, so without this any made-up /conferences/<id> would be rendered on the
 * server and kept in the cache for a year. Ids that are not on the calendar get the site's
 * 404 page instead, before anything renders.
 */
const ids = new Set(calendar.conferences.map((c) => c.id));

export function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.slice("/conferences/".length);
  if (ids.has(id)) return undefined;
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = { matcher: "/conferences/:id" };

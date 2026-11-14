import { editions } from "@/lib/editions";
import { SITE_AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * The weekly feed (Atom): one entry per edition, carrying that week's headline. It reads only the
 * stored data and uses no clock, so it is written once when the site is built, like the pages.
 * An entry's id is fixed by its week, so a feed reader shows each edition once.
 */
export function GET() {
  const list = editions();
  const host = new URL(SITE_URL).host;
  const entries = list
    .map(
      (e) => `  <entry>
    <id>tag:${host},${e.week.slice(0, 4)}:edition:${e.week}</id>
    <title>${escape(`${e.name}: ${e.headline}`)}</title>
    <link rel="alternate" type="text/html" href="${SITE_URL}/three-months"/>
    <published>${e.closed}</published>
    <updated>${e.closed}</updated>
    <summary>${escape(`${e.headline} From the three-month view: the last 4 weeks compared with the 4 before, as today's data gives it for that week.`)}</summary>
  </entry>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${SITE_URL}/</id>
  <title>${escape(SITE_NAME)}</title>
  <subtitle>${escape(SITE_DESCRIPTION)}</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE_URL}/feed.xml"/>
  <link rel="alternate" type="text/html" href="${SITE_URL}/three-months"/>
  <updated>${list[0]?.closed ?? "1970-01-01T00:00:00.000Z"}</updated>
  <author><name>${escape(SITE_AUTHOR)}</name></author>
${entries}
</feed>
`;
  return new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
}

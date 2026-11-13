import { topicsCsv } from "@/lib/datasets";

/**
 * The weekly counts behind the topics page, as one CSV file at a fixed address. It reads only the
 * data built into the deploy, so it is written once when the site is built and served as a file.
 */
export function GET() {
  return new Response(topicsCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ai-trend-tracker-topics.csv"',
    },
  });
}

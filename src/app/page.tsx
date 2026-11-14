import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Today } from "@/components/Today";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "AI Trend Tracker: today’s AI news, and what is rising in AI",
  description:
    "The past 24 hours of AI news from the labs, the analysts and Hacker News, biggest first, beside a weekly reading of which AI topics and products are rising, measured from papers, code and model releases.",
});

export default function TodayPage() {
  return <Today />;
}

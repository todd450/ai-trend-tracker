import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Today } from "@/components/Today";

export const metadata: Metadata = pageMetadata({
  path: "/today",
  title: "AI Trend Tracker: today’s AI news",
  description:
    "What the AI labs announced, what the analysts published and which AI stories Hacker News picked up in the past 24 hours, biggest first.",
});

export default function TodayPage() {
  return <Today />;
}

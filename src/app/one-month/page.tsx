import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = pageMetadata({
  path: "/one-month",
  title: "AI Trend Tracker: what is rising in AI over one month",
  description:
    "The one-month view of where attention in artificial intelligence is moving: the last 2 weeks compared with the 2 before.",
});

export default function OneMonth() {
  return <Dashboard horizon="oneMonth" />;
}

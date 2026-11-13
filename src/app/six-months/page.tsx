import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = pageMetadata({
  path: "/six-months",
  title: "AI Trend Tracker: what is rising in AI over six months",
  description:
    "The six-month view of where attention in artificial intelligence is moving: the last 13 weeks compared with the 13 before.",
});

export default function SixMonths() {
  return <Dashboard horizon="sixMonths" />;
}

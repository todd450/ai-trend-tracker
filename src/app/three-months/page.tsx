import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = pageMetadata({
  path: "/three-months",
  title: "AI Trend Tracker: what is rising in AI over three months",
  description:
    "The three-month view of where attention in artificial intelligence is moving: the last 4 weeks compared with the 4 before, across research papers, code, model releases and news.",
});

export default function ThreeMonths() {
  return <Dashboard horizon="threeMonths" />;
}

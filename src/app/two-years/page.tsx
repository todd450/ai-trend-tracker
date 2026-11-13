import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = pageMetadata({
  path: "/two-years",
  title: "AI Trend Tracker: what is rising in AI over two years",
  description:
    "The two-year view of where attention in artificial intelligence is moving: the last 52 weeks compared with the 52 before.",
});

export default function TwoYears() {
  return <Dashboard horizon="twoYears" />;
}

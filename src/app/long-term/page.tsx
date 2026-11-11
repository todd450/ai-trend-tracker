import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "AI Trend Tracker: what is rising in AI this quarter",
  description:
    "The long-term reading of where attention in artificial intelligence is moving: the last 13 weeks compared with the 13 before.",
};

export default function LongTerm() {
  return <Dashboard horizon="long" />;
}

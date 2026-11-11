import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "AI Trend Tracker: what is rising in AI over one year",
  description:
    "The one-year view of where attention in artificial intelligence is moving: the last 26 weeks compared with the 26 before.",
};

export default function OneYear() {
  return <Dashboard horizon="oneYear" />;
}

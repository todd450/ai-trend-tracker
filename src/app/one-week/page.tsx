import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "AI Trend Tracker: what is rising in AI this week",
  description:
    "The one-week view of where attention in artificial intelligence is moving: the latest week compared with the week before.",
};

export default function OneWeek() {
  return <Dashboard horizon="oneWeek" />;
}

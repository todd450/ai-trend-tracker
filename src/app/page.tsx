import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "AI Trend Tracker: what is rising in AI over three months",
};

export default function Home() {
  return <Dashboard horizon="threeMonths" />;
}

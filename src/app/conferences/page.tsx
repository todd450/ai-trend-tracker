import type { Metadata } from "next";
import { Conferences } from "@/components/Conferences";

export const metadata: Metadata = {
  title: "AI Trend Tracker: the conference calendar, read against the trends",
  description:
    "A calendar of the major AI conferences. Once each has passed, its talks are watched and set against the tracker's numbers.",
};

export default function ConferencesPage() {
  return <Conferences />;
}

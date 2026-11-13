import type { Metadata } from "next";
import { ReadingList } from "@/components/ReadingList";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/reading",
  title: "AI Trend Tracker: the reading list",
  description:
    "The week's most upvoted AI stories, papers getting attention, new writing from analysts and the labs, product launches, fast-growing repositories and trending models.",
});

export default function Reading() {
  return <ReadingList />;
}

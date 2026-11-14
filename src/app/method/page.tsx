import type { Metadata } from "next";
import { Method } from "@/components/Method";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/method",
  title: "AI Trend Tracker: how this is measured",
  description:
    "Where each figure on AI Trend Tracker comes from, whether each source is current, and the fixed rules that rank the day’s news and call a trend rising, steady or cooling.",
});

export default function MethodPage() {
  return <Method />;
}

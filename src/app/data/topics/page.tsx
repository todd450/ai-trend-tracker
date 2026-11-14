import { TopicsPage, topicsMetadata } from "@/components/TopicsPage";

/** Topic momentum at the front page's range, 3 months: the one view with no range in its address. */
export const metadata = topicsMetadata("threeMonths");

export default function Topics() {
  return <TopicsPage horizon="threeMonths" />;
}

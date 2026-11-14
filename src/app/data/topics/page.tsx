import { TopicsPage, topicsMetadata } from "@/components/TopicsPage";

/** Topic momentum at the default range, 3 months: the one view with no range in its address. */
export const metadata = topicsMetadata("threeMonths");

export default function Topics() {
  return <TopicsPage horizon="threeMonths" />;
}

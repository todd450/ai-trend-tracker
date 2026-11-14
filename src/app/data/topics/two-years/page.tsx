import { TopicsPage, topicsMetadata } from "@/components/TopicsPage";

export const metadata = topicsMetadata("twoYears");

export default function TopicsTwoYears() {
  return <TopicsPage horizon="twoYears" />;
}

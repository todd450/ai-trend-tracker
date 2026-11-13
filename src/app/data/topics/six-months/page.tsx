import { TopicsPage, topicsMetadata } from "@/components/TopicsPage";

export const metadata = topicsMetadata("sixMonths");

export default function TopicsSixMonths() {
  return <TopicsPage horizon="sixMonths" />;
}

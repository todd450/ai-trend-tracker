import { TopicsPage, topicsMetadata } from "@/components/TopicsPage";

export const metadata = topicsMetadata("oneWeek");

export default function TopicsOneWeek() {
  return <TopicsPage horizon="oneWeek" />;
}

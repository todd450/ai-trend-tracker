import { TopicsPage, topicsMetadata } from "@/components/TopicsPage";

export const metadata = topicsMetadata("oneMonth");

export default function TopicsOneMonth() {
  return <TopicsPage horizon="oneMonth" />;
}

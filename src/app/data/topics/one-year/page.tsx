import { TopicsPage, topicsMetadata } from "@/components/TopicsPage";

export const metadata = topicsMetadata("oneYear");

export default function TopicsOneYear() {
  return <TopicsPage horizon="oneYear" />;
}

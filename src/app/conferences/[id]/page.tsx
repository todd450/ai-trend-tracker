import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConferenceEvent, eventMeta } from "@/components/ConferenceEvent";
import { conferenceById, conferences } from "@/lib/conferences";
import { pageMetadata } from "@/lib/site";

/** One static page per event on the calendar, at its existing id. */
export function generateStaticParams() {
  return conferences.map((c) => ({ id: c.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = conferenceById((await params).id);
  if (!c) return {};
  return pageMetadata({ path: `/conferences/${c.id}`, ...eventMeta(c) });
}

export default async function ConferencePage({ params }: Props) {
  const c = conferenceById((await params).id);
  if (!c) notFound();
  return <ConferenceEvent c={c} />;
}

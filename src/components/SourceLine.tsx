import { fmtDay, latest } from "@/lib/trends";

/**
 * The line under a chart or list that says where its figures come from and when they were last
 * collected, so no reader has to go to the foot of the page to find out. When the latest update
 * of a source failed, the line says so and gives the day of the data being shown.
 */
export function SourceLine({ names, keys }: { names: string; keys: string[] }) {
  const status = keys.map((key) => latest.sources[key]).filter((src) => src !== undefined);
  const failed = status.some((src) => !src.ok);
  const oldest = status.map((src) => src.at).filter(Boolean).sort()[0];
  return (
    <p className="source">
      <b>{names.includes(";") ? "Sources" : "Source"}:</b> {names}.
      {oldest && (failed ? ` The latest update failed; this is the data of ${fmtDay(oldest)}.` : ` Collected ${fmtDay(oldest)}.`)}
    </p>
  );
}

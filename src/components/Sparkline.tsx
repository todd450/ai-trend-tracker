"use client";

import { useState } from "react";

type Props = {
  values: number[];
  /** One label per value, shown in the hover readout (e.g. "Week of 2 Nov"). */
  labels: string[];
  /** Formats a value for the readout, e.g. "4.2% of papers". */
  unit: "share" | "storyShare" | "stories" | "postings" | "downloadShare" | "documents" | "releases";
  tone: "rising" | "steady" | "cooling";
  /** Text alternative describing the series. */
  summary: string;
};

const W = 132;
const H = 36;
const PAD = 5;

function readout(value: number, unit: Props["unit"]) {
  switch (unit) {
    case "share":
      return `${value.toFixed(1)}% of papers`;
    case "storyShare":
      return `${value.toFixed(1)}% of AI stories`;
    case "postings":
      return `${value.toFixed(1)}% of postings`;
    case "downloadShare":
      return `${value.toFixed(1)}% of downloads`;
    case "stories":
      return `${value} ${value === 1 ? "story" : "stories"}`;
    case "documents":
      return `${value} ${value === 1 ? "document" : "documents"}`;
    case "releases":
      return `${value} ${value === 1 ? "release" : "releases"}`;
  }
}

/** A small trend line with a hover crosshair. The scale is local to each chart. */
export function Sparkline({ values, labels, unit, tone, summary }: Props) {
  const [active, setActive] = useState<number | null>(null);
  if (values.length < 2) return <span className="spark spark--empty">No history yet</span>;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = (W - PAD * 2) / (values.length - 1);
  const x = (i: number) => PAD + i * step;
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const shown = active ?? values.length - 1;

  function track(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    setActive(Math.max(0, Math.min(values.length - 1, Math.round((px - PAD) / step))));
  }

  return (
    <span className={`spark spark--${tone}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={summary}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={() => setActive(null)}
      >
        <path className="spark__area" d={area} />
        <path className="spark__line" d={line} />
        {active !== null && <line className="spark__cross" x1={x(shown)} x2={x(shown)} y1={0} y2={H} />}
        <circle className="spark__dot" cx={x(shown)} cy={y(values[shown])} r={4} />
      </svg>
      {active !== null && (
        <span className="spark__tip" role="status">
          <span className="spark__tip-label">{labels[shown]}</span>
          {readout(values[shown], unit)}
        </span>
      )}
    </span>
  );
}

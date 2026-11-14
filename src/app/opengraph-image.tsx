/** The card shown when a link to the site is shared: the mark, the name and what the site holds. */
import { ImageResponse } from "next/og";

export const alt = "AI Trend Tracker: the day’s AI news and what is rising in AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f6f2e8";
const INK = "#1d1b17";
const MUTED = "#6b665c";
const ACCENT = "#2459b8";

/** The "Rising columns" mark from Logo.tsx, drawn large: a cap over a stack of rules. */
const RULES_PER_COLUMN = [3, 6, 10];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          background: PAPER,
          color: INK,
          padding: 80,
          borderTop: `12px solid ${INK}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
          <div style={{ fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: MUTED }}>Updated daily</div>
          <div style={{ fontSize: 104, fontWeight: 700, lineHeight: 1.02, marginTop: 20 }}>AI Trend Tracker</div>
          <div style={{ fontSize: 38, lineHeight: 1.3, marginTop: 28, color: MUTED }}>
            The day’s AI news, and what is rising: measured from papers, code and model releases.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          {RULES_PER_COLUMN.map((count, column) => (
            <div key={column} style={{ display: "flex", flexDirection: "column", width: 84, marginLeft: column ? 18 : 0 }}>
              <div style={{ height: 22, marginBottom: 6, background: column === 2 ? ACCENT : INK }} />
              {Array.from({ length: count }, (_, i) => (
                <div key={i} style={{ height: 10, marginTop: 16, background: INK }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

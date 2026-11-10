/** The "Rising columns" mark: three newspaper columns of text rules whose
 * heights read as a rising bar chart. Each column is a heavy cap (the
 * headline) over a stack of hairline rules; the tallest cap takes the accent.
 * The box is cropped tight so the bottom edge sits on the text baseline. */

const COLUMN_WIDTH = 20;
const COLUMN_PITCH = 24;
const RULE_HEIGHT = 2.5;
const RULE_PITCH = 6;
const CAP_HEIGHT = 5;
const CAP_GAP = 3.5;
const RULES_PER_COLUMN = [3, 6, 10];

const HEIGHT = CAP_HEIGHT + CAP_GAP + (RULES_PER_COLUMN[2] - 1) * RULE_PITCH + RULE_HEIGHT;
const WIDTH = COLUMN_PITCH * 2 + COLUMN_WIDTH;

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
      {RULES_PER_COLUMN.map((count, column) => {
        const x = column * COLUMN_PITCH;
        const topRule = HEIGHT - RULE_HEIGHT - (count - 1) * RULE_PITCH;
        const isTallest = column === RULES_PER_COLUMN.length - 1;
        return (
          <g key={column}>
            <rect
              x={x}
              y={topRule - CAP_GAP - CAP_HEIGHT}
              width={COLUMN_WIDTH}
              height={CAP_HEIGHT}
              fill={isTallest ? "var(--color-accent)" : "currentColor"}
            />
            {Array.from({ length: count }, (_, i) => (
              <rect
                key={i}
                x={x}
                y={topRule + i * RULE_PITCH}
                width={COLUMN_WIDTH}
                height={RULE_HEIGHT}
                fill="currentColor"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

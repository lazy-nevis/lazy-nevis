import { formatDate } from "@/utils/formatters";
import type { SessionSummary } from "@/types";

interface Props {
  sessions: SessionSummary[];
  locale: string;
  title?: string;
  emptyLabel?: string;
}

export function FocusTrend({ sessions, locale, title, emptyLabel = "Not enough sessions yet" }: Props) {
  const data = sessions
    .slice()
    .reverse()
    .slice(-15); // last 15 sessions

  if (data.length < 2) {
    return (
      <div className="w-full">
        {title && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>}
        <p className="text-xs text-muted-foreground py-4 text-center">{emptyLabel}</p>
      </div>
    );
  }

  const W = 380;
  const H = 100;
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const points = data.map((s, i) => ({
    x: padL + (i / (data.length - 1)) * innerW,
    y: padT + (1 - s.focus_percent / 100) * innerH,
    label: formatDate(s.started_at, locale),
    pct: s.focus_percent,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [
    `${points[0].x},${padT + innerH}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${padT + innerH}`,
  ].join(" ");

  // Y-axis labels
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div className="w-full">
      {title && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>}
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="overflow-visible">
          {/* Y-axis grid lines + labels */}
          {yTicks.map((v) => {
            const y = padT + (1 - v / 100) * innerH;
            return (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={y} y2={y}
                  stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
                <text x={padL - 4} y={y + 3.5} textAnchor="end" fontSize={8}
                  fill="currentColor" className="fill-muted-foreground">{v}%</text>
              </g>
            );
          })}

          {/* Area fill */}
          <polygon points={area} fill="#22c55e" fillOpacity={0.12} />

          {/* Line */}
          <polyline points={polyline} fill="none" stroke="#22c55e" strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3} fill="#22c55e" />
              <title>{`${p.label}: ${Math.round(p.pct)}% focus`}</title>
              {/* Show pct on first and last */}
              {(i === 0 || i === points.length - 1) && (
                <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize={8}
                  fill="currentColor" className="fill-foreground">
                  {Math.round(p.pct)}%
                </text>
              )}
            </g>
          ))}

          {/* X-axis labels — first and last */}
          <text x={points[0].x} y={H - 4} textAnchor="middle" fontSize={8}
            fill="currentColor" className="fill-muted-foreground">
            {points[0].label}
          </text>
          <text x={points[points.length - 1].x} y={H - 4} textAnchor="middle" fontSize={8}
            fill="currentColor" className="fill-muted-foreground">
            {points[points.length - 1].label}
          </text>
        </svg>
      </div>
    </div>
  );
}

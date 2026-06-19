import { useState } from "react";
import { formatDurationHuman } from "@/utils/formatters";

interface Slice {
  label: string;
  value: number;   // milliseconds
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
  title?: string;
  emptyLabel?: string;
}

// Convert polar to Cartesian
function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, inner: number, startAngle: number, endAngle: number) {
  const outerStart = polar(cx, cy, r, startAngle);
  const outerEnd   = polar(cx, cy, r, endAngle);
  const innerStart = polar(cx, cy, inner, endAngle);
  const innerEnd   = polar(cx, cy, inner, startAngle);
  const largeArc   = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

export function DonutChart({ data, size = 180, title, emptyLabel = "No data" }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.42;
  const inner = size * 0.26;

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        {title && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>}
        <div className="flex items-center justify-center rounded-full border-4 border-muted/30" style={{ width: size, height: size }}>
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  let cumulative = 0;
  const slices = data.map((d, i) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 360;
    return { ...d, startAngle, endAngle, index: i };
  });

  const active = hovered !== null ? slices[hovered] : null;

  return (
    <div className="flex flex-col items-center gap-3">
      {title && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {slices.map((s) => {
            const span = s.endAngle - s.startAngle;
            if (span < 0.5) return null;
            const isHovered = hovered === s.index;
            const scale = isHovered ? 1.05 : 1;
            return (
              <path
                key={s.label}
                d={arcPath(cx, cy, outer * scale, inner, s.startAngle, s.endAngle)}
                fill={s.color}
                opacity={hovered !== null && !isHovered ? 0.45 : 1}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHovered(s.index)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
          {/* Center label */}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={10} fill="currentColor" className="fill-muted-foreground">
            {active ? active.label.slice(0, 10) : "Total"}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={11} fontWeight="600" fill="currentColor" className="fill-foreground">
            {active ? `${Math.round((active.value / total) * 100)}%` : formatDurationHuman(total)}
          </text>
          {active && (
            <text x={cx} y={cy + 24} textAnchor="middle" fontSize={9} fill="currentColor" className="fill-muted-foreground">
              {formatDurationHuman(active.value)}
            </text>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1 w-full max-w-[160px]">
        {slices.slice(0, 6).map((s, i) => (
          <div
            key={s.label}
            className="flex items-center gap-2 text-xs cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate text-muted-foreground flex-1">{s.label}</span>
            <span className="tabular-nums shrink-0">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
        {data.length > 6 && (
          <p className="text-xs text-muted-foreground">+{data.length - 6} more</p>
        )}
      </div>
    </div>
  );
}

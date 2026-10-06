"use client";

import { cn } from "@/lib/utils";

/**
 * Lightweight SVG charts — no external dependency.
 * Premium look via gradient fills + gridlines + axis labels.
 */

export interface BarDatum { label: string; value: number; hint?: string; }

export function BarChart({
  data,
  height = 200,
  className,
  accent = "primary",
}: {
  data: BarDatum[];
  height?: number;
  className?: string;
  accent?: "primary" | "gold" | "emerald" | "rose";
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = Math.max(280, data.length * 60);
  const barWidth = (width - 40) / data.length - 12;
  const accentColor = {
    primary: "var(--color-primary, #14532D)",
    gold: "var(--color-gold-strong, #b8860b)",
    emerald: "#10b981",
    rose: "#f43f5e",
  }[accent];

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block min-w-full"
        style={{ height: `${height}px` }}
        role="img"
        aria-label="Bar chart"
      >
        <defs>
          <linearGradient id={`bar-grad-${accent}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.85} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={r}
            x1={36}
            x2={width - 8}
            y1={height - 24 - r * (height - 48)}
            y2={height - 24 - r * (height - 48)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeDasharray="2 4"
          />
        ))}
        {data.map((d, i) => {
          const barH = (d.value / max) * (height - 48);
          const x = 40 + i * (barWidth + 12);
          const y = height - 24 - barH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barH)}
                rx={4}
                fill={`url(#bar-grad-${accent})`}
              >
                <title>{`${d.label}: ${d.value}${d.hint ? ` (${d.hint})` : ""}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={height - 8}
                fontSize={11}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.6}
              >
                {d.label}
              </text>
              <text
                x={x + barWidth / 2}
                y={y - 6}
                fontSize={11}
                fontWeight={600}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.8}
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface LineDatum { label: string; value: number; }

export function LineChart({
  data,
  height = 200,
  className,
  accent = "primary",
}: {
  data: LineDatum[];
  height?: number;
  className?: string;
  accent?: "primary" | "gold" | "emerald" | "rose";
}) {
  if (data.length === 0) return null;
  const width = Math.max(280, data.length * 40);
  const padding = { left: 36, right: 16, top: 16, bottom: 24 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(1, data.length - 1)) * (width - padding.left - padding.right);
    const y = height - padding.bottom - ((d.value - min) / range) * (height - padding.top - padding.bottom);
    return { x, y, ...d };
  });
  const accentColor = {
    primary: "var(--color-primary, #14532D)",
    gold: "var(--color-gold-strong, #b8860b)",
    emerald: "#10b981",
    rose: "#f43f5e",
  }[accent];

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(2)} ${height - padding.bottom} L ${points[0].x.toFixed(2)} ${height - padding.bottom} Z`;

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block min-w-full"
        style={{ height: `${height}px` }}
        role="img"
        aria-label="Line chart"
      >
        <defs>
          <linearGradient id={`line-grad-${accent}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={r}
            x1={padding.left}
            x2={width - padding.right}
            y1={height - padding.bottom - r * (height - padding.top - padding.bottom)}
            y2={height - padding.bottom - r * (height - padding.top - padding.bottom)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeDasharray="2 4"
          />
        ))}
        <path d={areaD} fill={`url(#line-grad-${accent})`} />
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3.5} fill={accentColor} stroke="var(--color-background, #fff)" strokeWidth={1.5} />
            <text
              x={p.x}
              y={height - 8}
              fontSize={11}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.6}
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export interface DonutSlice { label: string; value: number; color: string; }

export function DonutChart({
  data,
  size = 180,
  className,
}: {
  data: DonutSlice[];
  size?: number;
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = size / 2 - 8;
  const innerRadius = radius * 0.6;
  const cx = size / 2;
  const cy = size / 2;
  let cumulative = 0;

  const arcs = data.map((d) => {
    const startAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(startAngle) * radius;
    const y1 = cy + Math.sin(startAngle) * radius;
    const x2 = cx + Math.cos(endAngle) * radius;
    const y2 = cy + Math.sin(endAngle) * radius;
    const x3 = cx + Math.cos(endAngle) * innerRadius;
    const y3 = cy + Math.sin(endAngle) * innerRadius;
    const x4 = cx + Math.cos(startAngle) * innerRadius;
    const y4 = cy + Math.sin(startAngle) * innerRadius;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    return { path, ...d };
  });

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} role="img" aria-label="Donut chart">
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill={a.color}>
            <title>{`${a.label}: ${a.value}`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={700} fill="currentColor">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.6}>
          Total
        </text>
      </svg>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.label}</span>
            </span>
            <span className="font-semibold tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({
  data,
  height = 32,
  width = 100,
  accent = "primary",
}: {
  data: number[];
  height?: number;
  width?: number;
  accent?: "primary" | "gold" | "emerald" | "rose";
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  const accentColor = {
    primary: "var(--color-primary, #14532D)",
    gold: "var(--color-gold-strong, #b8860b)",
    emerald: "#10b981",
    rose: "#f43f5e",
  }[accent];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} aria-hidden>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={accentColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

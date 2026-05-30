import { cn } from "@/lib/utils";

interface CoverageRingChartProps {
  percent: number;
  covered: number;
  total: number;
  size?: number;
}

function ringColor(percent: number): string {
  if (percent >= 80) return "var(--strength, #22C55E)";
  if (percent >= 50) return "var(--weakness, #F97316)";
  return "var(--destructive, #EF4444)";
}

export function CoverageRingChart({
  percent,
  covered,
  total,
  size = 120,
}: CoverageRingChartProps) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-label={`SOP coverage ${clampedPercent} percent, ${covered} of ${total} steps covered`}
      role="img"
      className={cn("block")}
    >
      {/* Background circle */}
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="var(--muted, #F9FAFB)"
        strokeWidth={12}
      />
      {/* Foreground arc */}
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={ringColor(clampedPercent)}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{
          transition: "stroke-dashoffset 600ms ease-out",
        }}
      />
      {/* Center text */}
      <text
        x="60"
        y="56"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-2xl font-semibold"
        style={{ fontSize: "24px", fontWeight: 600 }}
      >
        {clampedPercent}
      </text>
      <text
        x="60"
        y="76"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground text-sm"
        style={{ fontSize: "14px" }}
      >
        %
      </text>
    </svg>
  );
}

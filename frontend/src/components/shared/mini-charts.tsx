/**
 * Decorative mini SVG charts for stat cards.
 * MiniRadarChart: 5-point radar polygon in primary color.
 * MiniTrendChart: Upward trend polyline in strength color.
 */

export function MiniRadarChart() {
  // 5-point radar polygon centered at (24, 24) with radius ~18
  const points = [
    [24, 6], // top
    [41, 17], // top-right
    [35, 38], // bottom-right
    [13, 38], // bottom-left
    [7, 17], // top-left
  ] as const;

  const polygonPoints = points.map((p) => p.join(",")).join(" ");

  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points={polygonPoints}
        fill="var(--primary)"
        fillOpacity="0.2"
        stroke="var(--primary)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function MiniTrendChart() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points="4,36 12,28 20,32 28,20 36,16 44,8"
        fill="none"
        stroke="var(--strength)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

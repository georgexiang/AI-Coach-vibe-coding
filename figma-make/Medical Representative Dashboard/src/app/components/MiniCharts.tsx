export function MiniRadarChart() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path
        d="M20 8 L28 14 L28 26 L20 32 L12 26 L12 14 Z"
        stroke="#3B82F6"
        strokeWidth="2"
        fill="rgba(59, 130, 246, 0.1)"
      />
      <path
        d="M20 12 L25 16 L25 24 L20 28 L15 24 L15 16 Z"
        fill="#3B82F6"
        opacity="0.3"
      />
    </svg>
  );
}

export function MiniTrendChart() {
  return (
    <svg width="60" height="30" viewBox="0 0 60 30" fill="none">
      <path
        d="M2 25 L15 18 L25 22 L35 12 L45 15 L58 8"
        stroke="#10B981"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 25 L15 18 L25 22 L35 12 L45 15 L58 8 L58 30 L2 30 Z"
        fill="url(#gradient)"
        opacity="0.2"
      />
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

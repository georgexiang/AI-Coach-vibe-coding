interface SpeakerLabelProps {
  speaker: string;
  colorIndex: number;
}

const SPEAKER_COLORS: string[] = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function SpeakerLabel({ speaker, colorIndex }: SpeakerLabelProps) {
  const color = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length] ?? "var(--primary)";

  return (
    <span
      className="text-sm font-medium"
      style={{ color }}
    >
      {speaker}
    </span>
  );
}

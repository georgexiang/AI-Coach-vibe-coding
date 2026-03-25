import { SpeakerLabel } from "./speaker-label";
import type { TranscriptLine } from "@/types/conference";

interface TranscriptionLineProps {
  line: TranscriptLine;
  speakerIndex: number;
}

function formatTimestamp(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function TranscriptionLine({ line, speakerIndex }: TranscriptionLineProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SpeakerLabel speaker={line.speaker} colorIndex={speakerIndex} />
      <p className="text-sm text-foreground">{line.text}</p>
      <span className="text-xs text-muted-foreground">
        {formatTimestamp(line.timestamp)}
      </span>
    </div>
  );
}

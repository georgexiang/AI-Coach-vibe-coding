import type { TranscriptLine } from "@/types/conference";

interface TranscriptionPanelProps {
  lines: TranscriptLine[];
  isCollapsed: boolean;
  onToggle: () => void;
  speakerMap: Map<string, number>;
}

// Stub: will be fully implemented in Task 2
export function TranscriptionPanel({
  lines: _l,
  isCollapsed: _c,
  onToggle: _o,
  speakerMap: _s,
}: TranscriptionPanelProps) {
  return null;
}

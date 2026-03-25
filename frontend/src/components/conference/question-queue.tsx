import type { QueuedQuestion } from "@/types/conference";

interface QuestionQueueProps {
  questions: QueuedQuestion[];
  onRespondTo: (hcpId: string) => void;
}

// Stub: will be fully implemented in Task 2
export function QuestionQueue({ questions: _q, onRespondTo: _r }: QuestionQueueProps) {
  return null;
}

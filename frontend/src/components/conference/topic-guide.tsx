interface TopicGuideProps {
  topics: Array<{ message: string; delivered: boolean }>;
  scenarioName: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

// Stub: will be fully implemented in Task 2
export function TopicGuide({
  topics: _t,
  scenarioName: _s,
  isCollapsed: _c,
  onToggle: _o,
}: TopicGuideProps) {
  return null;
}

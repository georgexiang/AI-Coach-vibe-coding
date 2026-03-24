import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface SessionTimerProps {
  startedAt: string | null;
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function SessionTimer({ startedAt }: SessionTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const start = new Date(startedAt).getTime();

    const update = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-2 text-slate-600">
      <Clock className="h-4 w-4" />
      <span className="font-mono text-sm">{formatElapsed(elapsed)}</span>
    </div>
  );
}

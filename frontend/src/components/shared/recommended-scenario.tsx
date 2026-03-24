import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface RecommendedScenarioProps {
  hcpName: string;
  difficulty: string;
  onStart?: () => void;
}

const difficultyColorMap: Record<string, string> = {
  Easy: "bg-green-100 text-green-700",
  Medium: "bg-orange-100 text-orange-700",
  Hard: "bg-red-100 text-red-700",
};

export function RecommendedScenario({
  hcpName,
  difficulty,
  onStart,
}: RecommendedScenarioProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
        <span className="text-sm font-medium text-orange-700">
          {hcpName.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{hcpName}</p>
        <p className="text-sm text-muted-foreground">
          Practice with {hcpName}
        </p>
      </div>

      <Badge
        className={cn(
          "shrink-0",
          difficultyColorMap[difficulty] ?? "bg-muted text-muted-foreground",
        )}
      >
        {difficulty}
      </Badge>

      <Button size="sm" onClick={onStart}>
        Start Training
      </Button>
    </div>
  );
}

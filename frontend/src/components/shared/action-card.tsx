import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: "blue" | "purple";
  onStart: () => void;
}

const gradientMap = {
  blue: "from-primary to-primary/80",
  purple: "from-improvement to-improvement/80",
} as const;

export function ActionCard({
  title,
  description,
  icon: Icon,
  gradient,
  onStart,
}: ActionCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl bg-gradient-to-br p-4 transition-all duration-150 hover:shadow-md",
        gradientMap[gradient],
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-white/20">
        <Icon className="size-5 text-white" />
      </div>

      <div>
        <h3 className="text-lg font-medium text-white">{title}</h3>
        <p className="mt-1 text-sm text-white/80">{description}</p>
      </div>

      <Button
        variant="secondary"
        className="w-fit bg-white text-foreground hover:bg-white/90"
        onClick={onStart}
      >
        Start
      </Button>
    </div>
  );
}

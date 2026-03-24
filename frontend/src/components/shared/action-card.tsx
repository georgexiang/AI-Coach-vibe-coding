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
  blue: "from-blue-500 to-blue-600",
  purple: "from-purple-500 to-purple-600",
} as const;

const textColorMap = {
  blue: "text-blue-600",
  purple: "text-purple-600",
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
        "flex flex-col gap-4 rounded-xl bg-gradient-to-br p-6",
        gradientMap[gradient],
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-white/20">
        <Icon className="size-6 text-white" />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-white/80">{description}</p>
      </div>

      <Button
        variant="secondary"
        className={cn("w-fit bg-white hover:bg-white/90", textColorMap[gradient])}
        onClick={onStart}
      >
        Start
      </Button>
    </div>
  );
}

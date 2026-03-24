import {
  Card,
  CardContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  Button,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface HCPProfileCardProps {
  name: string;
  nameZh?: string;
  specialty: string;
  hospital: string;
  personality: string[];
  difficulty: "Easy" | "Medium" | "Hard";
  product: string;
  avatar?: string;
  onStartTraining: () => void;
}

const difficultyColorMap: Record<string, string> = {
  Easy: "bg-green-100 text-green-700",
  Medium: "bg-orange-100 text-orange-700",
  Hard: "bg-red-100 text-red-700",
};

const personalityColorMap: Record<number, string> = {
  0: "bg-blue-100 text-blue-700",
  1: "bg-purple-100 text-purple-700",
  2: "bg-pink-100 text-pink-700",
  3: "bg-teal-100 text-teal-700",
  4: "bg-amber-100 text-amber-700",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function HCPProfileCard({
  name,
  nameZh,
  specialty,
  hospital,
  personality,
  difficulty,
  product,
  avatar,
  onStartTraining,
}: HCPProfileCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <Avatar className="size-24">
          {avatar ? (
            <AvatarImage src={avatar} alt={name} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-lg text-primary">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        <div>
          <p className="text-base font-semibold text-foreground">
            {name}
            {nameZh && (
              <span className="ml-1 text-muted-foreground">({nameZh})</span>
            )}
          </p>

          <Badge className="mt-1 bg-primary/10 text-primary">{specialty}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">{hospital}</p>

        <div className="flex flex-wrap justify-center gap-1.5">
          {personality.map((trait, i) => (
            <Badge
              key={trait}
              className={cn(
                "text-xs",
                personalityColorMap[i % Object.keys(personalityColorMap).length],
              )}
            >
              {trait}
            </Badge>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{product}</p>

        <Badge
          className={cn(
            difficultyColorMap[difficulty] ?? "bg-muted text-muted-foreground",
          )}
        >
          {difficulty}
        </Badge>

        <Button className="w-full" onClick={onStartTraining}>
          Start Training
        </Button>
      </CardContent>
    </Card>
  );
}

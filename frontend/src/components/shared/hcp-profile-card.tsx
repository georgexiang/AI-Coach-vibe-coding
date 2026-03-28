import {
  Card,
  CardContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
  Button,
} from "@/components/ui";

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
  Easy: "bg-strength/10 text-strength",
  Medium: "bg-chart-3/10 text-chart-3",
  Hard: "bg-destructive/10 text-destructive",
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
    <Card className="transition-all duration-150 hover:shadow-md">
      <CardContent className="flex flex-col items-center gap-4 p-4 text-center">
        <Avatar className="size-24">
          {avatar ? (
            <AvatarImage src={avatar} alt={name} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-lg text-primary">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        <div>
          <p className="text-sm font-medium text-foreground">
            {name}
            {nameZh && (
              <span className="ml-1 text-muted-foreground">({nameZh})</span>
            )}
          </p>

          <Badge className="mt-1 bg-primary/10 text-primary">{specialty}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">{hospital}</p>

        <div className="flex flex-wrap justify-center gap-1.5">
          {personality.map((trait) => (
            <Badge
              key={trait}
              className="bg-muted text-xs text-muted-foreground"
            >
              {trait}
            </Badge>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{product}</p>

        <Badge
          className={
            difficultyColorMap[difficulty] ?? "bg-muted text-muted-foreground"
          }
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

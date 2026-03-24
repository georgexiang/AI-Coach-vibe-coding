import React from 'react';
import { Card } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';

interface HCPProfileCardProps {
  avatar?: string;
  name: string;
  specialty: string;
  hospital: string;
  personalityTags?: string[];
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  onClick?: () => void;
  className?: string;
}

export function HCPProfileCard({
  avatar,
  name,
  specialty,
  hospital,
  personalityTags = [],
  difficulty = 'Medium',
  onClick,
  className,
}: HCPProfileCardProps) {
  const difficultyColors = {
    Easy: 'bg-strength/10 text-strength',
    Medium: 'bg-weakness/10 text-weakness',
    Hard: 'bg-destructive/10 text-destructive',
  };

  return (
    <Card
      className={`p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Avatar className="w-16 h-16">
          <AvatarImage src={avatar} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {name.charAt(0)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-foreground">{name}</h3>
            <Badge className={difficultyColors[difficulty]}>{difficulty}</Badge>
          </div>
          
          <div className="text-sm text-muted-foreground mb-1">{specialty}</div>
          <div className="text-sm text-muted-foreground mb-3">{hospital}</div>

          {/* Personality Tags */}
          {personalityTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {personalityTags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs rounded bg-accent text-accent-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

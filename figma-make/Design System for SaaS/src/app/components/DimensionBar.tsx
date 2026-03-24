import React from 'react';

interface DimensionBarProps {
  label: string;
  score: number;
  maxScore?: number;
  color?: 'strength' | 'weakness' | 'improvement' | 'primary';
  className?: string;
}

export function DimensionBar({
  label,
  score,
  maxScore = 100,
  color = 'primary',
  className,
}: DimensionBarProps) {
  const percentage = Math.min((score / maxScore) * 100, 100);

  const colorClasses = {
    strength: 'bg-strength',
    weakness: 'bg-weakness',
    improvement: 'bg-improvement',
    primary: 'bg-primary',
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">
          {score}/{maxScore}
        </span>
      </div>
      
      <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="text-xs text-muted-foreground text-right">
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}

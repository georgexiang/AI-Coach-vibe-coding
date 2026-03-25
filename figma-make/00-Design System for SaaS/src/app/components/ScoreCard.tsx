import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './ui/card';

interface ScoreCardProps {
  score: number;
  label: string;
  trend?: 'up' | 'down';
  trendValue?: number;
  sparklineData?: number[];
  className?: string;
}

export function ScoreCard({
  score,
  label,
  trend,
  trendValue,
  sparklineData = [],
  className,
}: ScoreCardProps) {
  return (
    <Card className={`p-6 rounded-lg shadow-sm ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-4xl font-semibold text-foreground mb-2">
            {score}
          </div>
          <div className="text-sm text-muted-foreground mb-2">{label}</div>
          
          {/* Trend */}
          {trend && (
            <div
              className={`flex items-center gap-1 text-sm ${
                trend === 'up' ? 'text-strength' : 'text-destructive'
              }`}
            >
              {trend === 'up' ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {trendValue && (
                <span>
                  {trend === 'up' ? '+' : '-'}
                  {trendValue}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mini Sparkline */}
        {sparklineData.length > 0 && (
          <div className="flex items-end gap-0.5 h-12">
            {sparklineData.map((value, index) => (
              <div
                key={index}
                className="w-1 bg-primary rounded-sm"
                style={{ height: `${(value / Math.max(...sparklineData)) * 100}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

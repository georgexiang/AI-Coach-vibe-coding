import React, { useState } from 'react';
import { LucideIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './ui/card';

interface ServiceConfigCardProps {
  icon: LucideIcon;
  name: string;
  status: 'active' | 'inactive' | 'error';
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function ServiceConfigCard({
  icon: Icon,
  name,
  status,
  description,
  children,
  className,
}: ServiceConfigCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    active: 'bg-strength',
    inactive: 'bg-muted-foreground',
    error: 'bg-destructive',
  };

  return (
    <Card className={`rounded-lg shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-6 flex items-center gap-4 hover:bg-accent/50 transition-colors"
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>

        {/* Info */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground">{name}</h3>
            <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          </div>
          {description && (
            <div className="text-sm text-muted-foreground">{description}</div>
          )}
        </div>

        {/* Expand Icon */}
        {children && (
          <div>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        )}
      </button>

      {/* Expandable Content */}
      {expanded && children && (
        <div className="px-6 pb-6 border-t bg-accent/20">{children}</div>
      )}
    </Card>
  );
}

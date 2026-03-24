import React from 'react';
import { cn } from './ui/utils';

interface StatusBadgeProps {
  status: 'Active' | 'Draft' | 'Error' | 'Pending';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants = {
    Active: 'bg-strength/10 text-strength border-strength/20',
    Draft: 'bg-muted text-muted-foreground border-muted-foreground/20',
    Error: 'bg-destructive/10 text-destructive border-destructive/20',
    Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
        variants[status],
        className
      )}
    >
      {status}
    </span>
  );
}

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from './ui/utils';

interface ChatBubbleProps {
  variant: 'left' | 'right';
  message: string;
  avatar?: string;
  name?: string;
  timestamp?: string;
  className?: string;
}

export function ChatBubble({
  variant,
  message,
  avatar,
  name,
  timestamp,
  className,
}: ChatBubbleProps) {
  const isLeft = variant === 'left';

  return (
    <div
      className={cn(
        'flex gap-3 max-w-[80%]',
        isLeft ? 'justify-start' : 'justify-end ml-auto',
        className
      )}
    >
      {/* Avatar (HCP - Left side only) */}
      {isLeft && (
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={avatar} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {name?.charAt(0) || 'H'}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message Content */}
      <div className={cn('flex flex-col', isLeft ? 'items-start' : 'items-end')}>
        {name && (
          <div className="text-xs text-muted-foreground mb-1">{name}</div>
        )}
        <div
          className={cn(
            'px-4 py-3 rounded-lg',
            isLeft
              ? 'bg-primary/10 text-foreground rounded-tl-none'
              : 'bg-secondary text-secondary-foreground rounded-tr-none'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message}</p>
        </div>
        {timestamp && (
          <div className="text-xs text-muted-foreground mt-1">{timestamp}</div>
        )}
      </div>
    </div>
  );
}

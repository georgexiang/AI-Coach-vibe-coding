import React, { useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from './ui/utils';

type AudioState = 'idle' | 'recording' | 'processing';

interface AudioControlsProps {
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  state?: AudioState;
  className?: string;
}

export function AudioControls({
  onStartRecording,
  onStopRecording,
  state = 'idle',
  className,
}: AudioControlsProps) {
  const [internalState, setInternalState] = useState<AudioState>(state);

  const handleToggle = () => {
    if (internalState === 'idle') {
      setInternalState('recording');
      onStartRecording?.();
    } else if (internalState === 'recording') {
      setInternalState('processing');
      onStopRecording?.();
      setTimeout(() => setInternalState('idle'), 1000);
    }
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Mic Button */}
      <button
        onClick={handleToggle}
        disabled={internalState === 'processing'}
        className={cn(
          'flex items-center justify-center w-12 h-12 rounded-full transition-all',
          internalState === 'idle' &&
            'bg-primary hover:bg-primary/90 text-primary-foreground',
          internalState === 'recording' &&
            'bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse',
          internalState === 'processing' &&
            'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {internalState === 'recording' ? (
          <Square className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {/* Waveform Bar */}
      {internalState === 'recording' && (
        <div className="flex items-center gap-1 h-8">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-primary rounded-full animate-wave"
              style={{
                height: `${Math.random() * 60 + 20}%`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      )}

      {internalState === 'processing' && (
        <span className="text-sm text-muted-foreground">Processing...</span>
      )}
    </div>
  );
}

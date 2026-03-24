import React, { useState } from 'react';
import { Mic, Send } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface ChatInputProps {
  onSend?: (message: string) => void;
  onVoiceClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ChatInput({
  onSend,
  onVoiceClick,
  placeholder = 'Type your message...',
  disabled,
  className,
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend?.(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex items-center gap-2 w-full ${className}`}>
      {/* Text Input */}
      <div className="flex-1 flex items-center gap-2 px-4 py-2 rounded-lg border bg-white">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
        />
        
        {/* Mic Button */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onVoiceClick}
          disabled={disabled}
          className="shrink-0"
        >
          <Mic className="w-4 h-4" />
        </Button>
      </div>

      {/* Send Button */}
      <Button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        size="icon"
        className="shrink-0 rounded-lg"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}

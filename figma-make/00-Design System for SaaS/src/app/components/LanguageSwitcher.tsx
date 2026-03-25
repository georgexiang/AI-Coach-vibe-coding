import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface LanguageSwitcherProps {
  currentLanguage: 'CN' | 'EN';
  onChange: (lang: 'CN' | 'EN') => void;
  className?: string;
}

export function LanguageSwitcher({
  currentLanguage,
  onChange,
  className,
}: LanguageSwitcherProps) {
  const languages = {
    CN: { flag: '🇨🇳', label: '中文' },
    EN: { flag: '🇬🇧', label: 'English' },
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-2 px-4 py-2 rounded-md border bg-white hover:bg-accent transition-colors ${className}`}
      >
        <span>{languages[currentLanguage].flag}</span>
        <span className="text-sm">{languages[currentLanguage].label}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onChange('EN')}>
          <span className="mr-2">🇬🇧</span>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange('CN')}>
          <span className="mr-2">🇨🇳</span>
          中文
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

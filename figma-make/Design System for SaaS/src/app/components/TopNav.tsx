import React from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

interface TopNavProps {
  logo?: React.ReactNode;
  navLinks?: { label: string; href: string }[];
  currentLanguage?: 'CN' | 'EN';
  onLanguageChange?: (lang: 'CN' | 'EN') => void;
  userAvatar?: string;
  userName?: string;
  onLogout?: () => void;
}

export function TopNav({
  logo,
  navLinks = [],
  currentLanguage = 'EN',
  onLanguageChange,
  userAvatar,
  userName = 'User',
  onLogout,
}: TopNavProps) {
  return (
    <nav className="w-full border-b bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <div className="text-xl font-semibold text-primary">
            {logo || 'AI Coach'}
          </div>
          
          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Right Side: Language Switcher + User */}
        <div className="flex items-center gap-4">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors">
              <Globe className="w-4 h-4" />
              <span className="text-sm">{currentLanguage}</span>
              <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onLanguageChange?.('EN')}>
                🇬🇧 English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLanguageChange?.('CN')}>
                🇨🇳 中文
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={userAvatar} />
                <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
              </Avatar>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive">
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

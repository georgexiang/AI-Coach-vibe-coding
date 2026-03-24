import React, { useState } from 'react';
import { LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './ui/utils';

interface MenuItem {
  icon: LucideIcon;
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

interface AdminSidebarProps {
  menuItems: MenuItem[];
  className?: string;
}

export function AdminSidebar({ menuItems, className }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'relative h-screen border-r bg-white transition-all duration-300',
        collapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 flex items-center justify-center w-6 h-6 bg-white border rounded-full shadow-sm hover:bg-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Menu Items */}
      <div className="pt-6 px-3">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={item.onClick}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-3 mb-1 rounded-lg transition-colors',
                item.active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent',
                collapsed && 'justify-center'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

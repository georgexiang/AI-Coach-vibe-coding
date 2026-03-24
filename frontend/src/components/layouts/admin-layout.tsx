import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  BookOpen,
  FileText,
  BarChart,
  Cloud,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  LogOut,
} from "lucide-react";
import {
  Button,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useAuthStore } from "@/stores/auth-store";
import { useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { path: "/admin/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { path: "/admin/users", labelKey: "users", icon: Users },
  { path: "/admin/hcp-profiles", labelKey: "hcpProfiles", icon: UserCircle },
  { path: "/admin/scenarios", labelKey: "scenarios", icon: BookOpen },
  { path: "/admin/materials", labelKey: "materials", icon: FileText },
  { path: "/admin/reports", labelKey: "reports", icon: BarChart },
  { path: "/admin/azure-config", labelKey: "azureServices", icon: Cloud },
  { path: "/admin/settings", labelKey: "settings", icon: Settings },
] as const;

function SidebarNavItem({
  item,
  collapsed,
  isActive,
  onClick,
}: {
  item: (typeof sidebarItems)[number];
  collapsed: boolean;
  isActive: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation("nav");
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-primary/10 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-5 shrink-0" />
      {!collapsed && <span>{t(item.labelKey)}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function AdminLayout() {
  const { t: tCommon } = useTranslation("common");
  const { user } = useAuthStore();
  const logout = useLogout();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userInitials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "A";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 md:flex",
            collapsed ? "w-16" : "w-60"
          )}
          style={{ backgroundColor: "#1E293B" }}
        >
          {/* Sidebar header */}
          <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
              AI
            </div>
            {!collapsed && (
              <span className="font-semibold text-sidebar-foreground">
                AI Coach Admin
              </span>
            )}
          </div>

          {/* Sidebar nav */}
          <nav className="flex-1 space-y-1 p-2">
            {sidebarItems.map((item) => (
              <SidebarNavItem
                key={item.path}
                item={item}
                collapsed={collapsed}
                isActive={location.pathname === item.path}
              />
            ))}
          </nav>

          {/* Collapse toggle */}
          <div className="border-t border-sidebar-border p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="w-full text-sidebar-foreground/70 hover:bg-sidebar-primary/10 hover:text-sidebar-foreground"
            >
              {collapsed ? (
                <ChevronRight className="size-5" />
              ) : (
                <ChevronLeft className="size-5" />
              )}
            </Button>
          </div>
        </aside>

        {/* Mobile sidebar sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent
            side="left"
            className="w-60 p-0"
            style={{ backgroundColor: "#1E293B", color: "white" }}
          >
            <SheetHeader className="border-b border-sidebar-border px-3 py-4">
              <SheetTitle className="text-white">AI Coach Admin</SheetTitle>
            </SheetHeader>
            <nav className="space-y-1 p-2">
              {sidebarItems.map((item) => (
                <SidebarNavItem
                  key={item.path}
                  item={item}
                  collapsed={false}
                  isActive={location.pathname === item.path}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Main content area */}
        <div className="flex flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-white px-4">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="size-5" />
            </Button>

            {/* Breadcrumb area */}
            <div className="text-sm text-muted-foreground">
              {/* Breadcrumb placeholder for future implementation */}
            </div>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 px-2"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm md:inline">
                      {user?.full_name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>{tCommon("profile")}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="size-4" />
                    {tCommon("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 bg-muted p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

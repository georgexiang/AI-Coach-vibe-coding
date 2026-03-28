import { Outlet } from "react-router-dom";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/3 p-4">
      <Outlet />
      <div className="fixed right-6 top-6">
        <LanguageSwitcher />
      </div>
      <p className="fixed bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        {"\u00A9"} 2026 AI Coach Platform
      </p>
    </div>
  );
}

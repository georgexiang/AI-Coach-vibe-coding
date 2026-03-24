import { Outlet } from "react-router-dom";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <Outlet />
      <div className="fixed top-6 right-6">
        <LanguageSwitcher />
      </div>
      <p className="fixed bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        {"\u00A9"} 2026 AI Coach Platform
      </p>
    </div>
  );
}

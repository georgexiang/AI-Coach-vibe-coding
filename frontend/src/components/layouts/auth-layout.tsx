import { Outlet } from "react-router-dom";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <Outlet />
      <div className="fixed bottom-4 right-4">
        <LanguageSwitcher />
      </div>
    </div>
  );
}

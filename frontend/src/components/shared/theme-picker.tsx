import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
} from "@/components/ui";
import { Palette, Sun, Moon, Check } from "lucide-react";
import { useThemeStore, ACCENT_COLORS } from "@/stores/theme-store";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const { t } = useTranslation("common");
  const { mode, accent, setThemeMode, setAccentColor } = useThemeStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("theme")}
          className="transition-colors duration-150"
        >
          <Palette className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {t("theme")}
          </div>
          <div className="flex items-center gap-2">
            {ACCENT_COLORS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setAccentColor(item.name)}
                aria-label={item.label}
                className={cn(
                  "size-6 rounded-full transition-all duration-150",
                  accent === item.name &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                style={{ backgroundColor: item.color }}
              />
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setThemeMode("light")}
          className="gap-2"
        >
          <Sun className="size-4" />
          <span className={cn(mode === "light" && "font-medium")}>
            {t("lightMode")}
          </span>
          {mode === "light" && (
            <Check className="ml-auto size-4 text-primary" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setThemeMode("dark")}
          className="gap-2"
        >
          <Moon className="size-4" />
          <span className={cn(mode === "dark" && "font-medium")}>
            {t("darkMode")}
          </span>
          {mode === "dark" && (
            <Check className="ml-auto size-4 text-primary" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

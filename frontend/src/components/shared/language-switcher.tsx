import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { Button } from "@/components/ui";

const languages = [
  { code: "zh-CN", labelKey: "lang.zhCN" },
  { code: "en-US", labelKey: "lang.enUS" },
] as const;

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Switch language">
          <Globe className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={
              i18n.language === lang.code ? "font-medium text-primary" : ""
            }
          >
            {t(lang.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";

export default function NotFound() {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-lg text-muted-foreground">{t("error.title")}</p>
      <Button asChild>
        <Link to="/">
          {t("loading").replace("...", "")}
        </Link>
      </Button>
    </div>
  );
}

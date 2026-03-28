import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Lightbulb className="mb-4 size-8 text-primary" />
      <p className="text-8xl font-bold text-primary/20">404</p>
      <h1 className="mt-4 text-xl font-medium text-foreground">
        {t("error.notFound", "Page not found")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("error.notFoundBody", "The page you are looking for does not exist or has been moved.")}
      </p>
      <Button asChild className="mt-6">
        <Link to="/user/dashboard">
          {t("error.returnDashboard", "Return to Dashboard")}
        </Link>
      </Button>
    </div>
  );
}

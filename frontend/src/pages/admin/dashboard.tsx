import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { EmptyState } from "@/components/shared/empty-state";

export default function AdminDashboard() {
  const { t } = useTranslation("nav");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("dashboard")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard")}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    </div>
  );
}

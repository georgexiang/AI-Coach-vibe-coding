import { useTranslation } from "react-i18next";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { useExportAdminReport, useExportSessionsExcel } from "@/hooks/use-analytics";

export default function AdminReportsPage() {
  const { t } = useTranslation("analytics");
  const exportSessions = useExportSessionsExcel();
  const exportAdmin = useExportAdminReport();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("adminReports")}</h1>
        <p className="mt-1 text-muted-foreground">{t("adminReportsDesc")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="size-8 text-green-600" />
              <div>
                <CardTitle className="text-base">{t("sessionReport")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("sessionReportDesc")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => exportSessions.mutate()}
              disabled={exportSessions.isPending}
              className="w-full"
            >
              {exportSessions.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              {exportSessions.isPending ? t("exportingExcel") : t("exportExcel")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="size-8 text-blue-600" />
              <div>
                <CardTitle className="text-base">{t("adminFullReport")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("adminFullReportDesc")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => exportAdmin.mutate()}
              disabled={exportAdmin.isPending}
              className="w-full"
            >
              {exportAdmin.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              {exportAdmin.isPending ? t("exportingExcel") : t("exportExcel")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

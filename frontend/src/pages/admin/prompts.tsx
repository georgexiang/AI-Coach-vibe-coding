import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { usePrompts } from "@/hooks/use-prompts";
import type { PromptSummary } from "@/types/prompt";

function formatDate(value: string | null, never: string): string {
  if (!value) return never;
  return new Date(value).toLocaleString();
}

export default function PromptsPage() {
  const { t } = useTranslation("prompts");
  const navigate = useNavigate();
  const { data } = usePrompts();

  const prompts = useMemo<PromptSummary[]>(() => data ?? [], [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">{t("list.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("list.description")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm" data-testid="prompts-table">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t("list.columnKey")}</th>
                <th className="px-4 py-3 font-medium">{t("list.columnName")}</th>
                <th className="px-4 py-3 font-medium">{t("list.columnCategory")}</th>
                <th className="px-4 py-3 font-medium">{t("list.columnActiveVersion")}</th>
                <th className="px-4 py-3 font-medium">{t("list.columnLastOptimized")}</th>
              </tr>
            </thead>
            <tbody>
              {prompts.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                    {t("list.empty")}
                  </td>
                </tr>
              ) : (
                prompts.map((prompt) => (
                  <tr
                    key={prompt.key}
                    data-testid={`prompt-row-${prompt.key}`}
                    className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                    onClick={() => navigate(`/admin/prompts/${prompt.key}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{prompt.key}</span>
                      {prompt.is_system && (
                        <Badge variant="secondary" className="ml-2">
                          {t("list.system")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">{prompt.name}</td>
                    <td className="px-4 py-3">{prompt.category}</td>
                    <td className="px-4 py-3">
                      {prompt.active_version_no != null ? `v${prompt.active_version_no}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(prompt.last_optimized_at, t("list.never"))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

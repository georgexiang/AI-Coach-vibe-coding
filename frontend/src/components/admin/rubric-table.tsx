import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Rubric } from "@/types/rubric";

interface RubricTableProps {
  rubrics: Rubric[];
  onEdit: (rubric: Rubric) => void;
  onDelete: (id: string) => void;
}

export function RubricTable({ rubrics, onEdit, onDelete }: RubricTableProps) {
  const { t } = useTranslation("admin");

  if (rubrics.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
        <h3 className="text-lg font-medium text-foreground">
          {t("rubrics.emptyTitle")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("rubrics.emptyBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              {t("rubrics.name")}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              {t("rubrics.scenarioType")}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              {t("rubrics.dimensions")}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
              {t("rubrics.isDefault")}
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
              {t("rubrics.actions", { defaultValue: "Actions" })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rubrics.map((rubric) => (
            <tr
              key={rubric.id}
              className="border-b last:border-b-0 transition-colors duration-150 hover:bg-muted/50"
            >
              <td className="px-4 py-3 font-medium text-foreground">{rubric.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {rubric.scenario_type
                  ? t(`rubrics.${rubric.scenario_type}`)
                  : "-"}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline">{rubric.dimensions.length}</Badge>
              </td>
              <td className="px-4 py-3">
                {rubric.is_default && (
                  <Badge className="bg-strength/10 text-strength border-strength/20">
                    {t("rubrics.default", { defaultValue: "Default" })}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 transition-colors duration-150"
                    onClick={() => onEdit(rubric)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive transition-colors duration-150"
                    onClick={() => onDelete(rubric.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

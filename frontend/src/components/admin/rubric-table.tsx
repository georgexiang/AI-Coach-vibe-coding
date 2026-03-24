import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
      <div className="rounded-md border px-4 py-12 text-center">
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
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50/50">
            <th className="px-4 py-3 text-left font-medium">
              {t("rubrics.name")}
            </th>
            <th className="px-4 py-3 text-left font-medium">
              {t("rubrics.scenarioType")}
            </th>
            <th className="px-4 py-3 text-left font-medium">
              {t("rubrics.dimensions")}
            </th>
            <th className="px-4 py-3 text-left font-medium">
              {t("rubrics.isDefault")}
            </th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rubrics.map((rubric) => (
            <tr
              key={rubric.id}
              className="border-b transition-colors hover:bg-slate-50/50"
            >
              <td className="px-4 py-3 font-medium">{rubric.name}</td>
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
                  <Badge
                    className={cn(
                      "bg-green-100 text-green-700",
                    )}
                  >
                    Default
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onEdit(rubric)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
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

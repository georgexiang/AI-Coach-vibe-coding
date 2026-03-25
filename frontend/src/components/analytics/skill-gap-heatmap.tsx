import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SkillGapCell } from "@/types/analytics";

interface SkillGapHeatmapProps {
  data: SkillGapCell[];
}

export function getHeatColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 70) return "bg-yellow-100 text-yellow-800";
  if (score >= 60) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export function SkillGapHeatmap({ data }: SkillGapHeatmapProps) {
  const { t } = useTranslation("analytics");

  const { bus, dimensions, matrix } = useMemo(() => {
    const busSet = new Set<string>();
    const dimsSet = new Set<string>();
    const lookup = new Map<string, number>();

    for (const cell of data) {
      busSet.add(cell.business_unit);
      dimsSet.add(cell.dimension);
      lookup.set(`${cell.business_unit}__${cell.dimension}`, cell.avg_score);
    }

    return {
      bus: Array.from(busSet),
      dimensions: Array.from(dimsSet),
      matrix: lookup,
    };
  }, [data]);

  if (bus.length === 0 || dimensions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noData")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              {t("buName")}
            </th>
            {dimensions.map((dim) => (
              <th key={dim} className="px-3 py-2 text-center font-medium text-muted-foreground">
                {t(`dimension_${dim}`, { defaultValue: dim })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bus.map((bu) => (
            <tr key={bu} className="border-t">
              <td className="px-3 py-2 font-medium">{bu || t("noData")}</td>
              {dimensions.map((dim) => {
                const score = matrix.get(`${bu}__${dim}`);
                return (
                  <td key={dim} className="px-2 py-2 text-center">
                    {score != null ? (
                      <span
                        className={cn(
                          "inline-block rounded-md px-2 py-1 text-xs font-semibold",
                          getHeatColor(score),
                        )}
                      >
                        {score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

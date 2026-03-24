import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Scenario } from "@/types/scenario";

interface ScenarioTableProps {
  scenarios: Scenario[];
  onEdit: (scenario: Scenario) => void;
  onDelete: (id: string) => void;
  onClone: (id: string) => void;
  onStatusChange?: (id: string, status: Scenario["status"]) => void;
}

type SortKey = "name" | "product" | "difficulty";
type SortDirection = "asc" | "desc";

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-blue-100 text-blue-700",
  medium: "bg-orange-100 text-orange-700",
  hard: "bg-red-100 text-red-700",
};

export function ScenarioTable({
  scenarios,
  onEdit,
  onDelete,
  onClone,
}: ScenarioTableProps) {
  const { t } = useTranslation("admin");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...scenarios];
    arr.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      const cmp = String(valA).localeCompare(String(valB));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [scenarios, sortKey, sortDir]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50/50">
              <th className="px-4 py-3 text-left font-medium">
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => toggleSort("name")}
                >
                  Name
                  <ArrowUpDown className="size-3.5" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => toggleSort("product")}
                >
                  Product
                  <ArrowUpDown className="size-3.5" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">HCP</th>
              <th className="px-4 py-3 text-left font-medium">Mode</th>
              <th className="px-4 py-3 text-left font-medium">
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => toggleSort("difficulty")}
                >
                  Difficulty
                  <ArrowUpDown className="size-3.5" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {t("scenarios.emptyTitle")}
                </td>
              </tr>
            ) : (
              paged.map((scenario) => (
                <tr
                  key={scenario.id}
                  className="border-b hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{scenario.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {scenario.product}
                  </td>
                  <td className="px-4 py-3">
                    {scenario.hcp_profile ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage
                            src={scenario.hcp_profile.avatar_url}
                            alt={scenario.hcp_profile.name}
                          />
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                            {getInitials(scenario.hcp_profile.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{scenario.hcp_profile.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="uppercase text-xs">
                      {scenario.mode}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        DIFFICULTY_STYLES[scenario.difficulty],
                      )}
                    >
                      {scenario.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={scenario.status === "active" ? "default" : "secondary"}
                    >
                      {scenario.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(scenario)}>
                          <Edit className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onClone(scenario.id)}>
                          <Copy className="size-4" />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(scenario.id)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

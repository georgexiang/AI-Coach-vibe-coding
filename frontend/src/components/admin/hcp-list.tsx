import { useTranslation } from "react-i18next";
import { Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import type { HcpProfile } from "@/types/hcp";

interface HcpListProps {
  profiles: HcpProfile[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function HcpList({
  profiles,
  selectedId,
  onSelect,
  onCreateNew,
  searchQuery,
  onSearchChange,
}: HcpListProps) {
  const { t } = useTranslation("admin");

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="w-[300px] border-r border-slate-200 flex flex-col h-full">
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("hcp.searchPlaceholder")}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {profiles.length === 0 ? (
          <EmptyState
            title={t("hcp.emptyTitle")}
            body={t("hcp.emptyBody")}
          />
        ) : (
          <div className="space-y-0.5 px-2">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => onSelect(profile.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-slate-100",
                  selectedId === profile.id &&
                    "bg-blue-50 border-l-2 border-blue-600",
                )}
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={profile.avatar_url} alt={profile.name} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile.specialty}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-slate-200">
        <Button
          variant="outline"
          className="w-full"
          onClick={onCreateNew}
        >
          <Plus className="size-4" />
          {t("hcp.createButton")}
        </Button>
      </div>
    </div>
  );
}

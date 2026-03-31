import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { HcpTable } from "@/components/admin/hcp-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useHcpProfiles,
  useDeleteHcpProfile,
  useRetrySyncHcpProfile,
  useBatchSyncAgents,
} from "@/hooks/use-hcp-profiles";

export default function HcpProfilesPage() {
  const { t } = useTranslation(["admin", "common"]);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: profilesData, isLoading } = useHcpProfiles();
  const deleteMutation = useDeleteHcpProfile();
  const retrySyncMutation = useRetrySyncHcpProfile();
  const batchSyncMutation = useBatchSyncAgents();

  const profiles = useMemo(
    () => profilesData?.items ?? [],
    [profilesData],
  );

  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.specialty.toLowerCase().includes(q),
    );
  }, [profiles, searchQuery]);

  // Count profiles needing sync
  const unsyncedCount = useMemo(
    () =>
      profiles.filter(
        (p) =>
          !p.agent_id ||
          p.agent_sync_status === "failed" ||
          p.agent_sync_status === "none",
      ).length,
    [profiles],
  );

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => {
        toast.success(t("common:delete"));
        setDeleteId(null);
      },
      onError: () => {
        toast.error(t("admin:errors.hcpSaveFailed"));
      },
    });
  };

  const handleRetrySync = (id: string) => {
    retrySyncMutation.mutate(id, {
      onSuccess: () => toast.success(t("admin:hcp.syncSuccess")),
      onError: (err) =>
        toast.error(
          t("admin:hcp.syncFailed", { error: (err as Error).message }),
        ),
    });
  };

  const handleBatchSync = () => {
    batchSyncMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(
            `Synced: ${result.synced}, Failed: ${result.failed}, Total: ${result.total}`,
          );
        }
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="relative w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("admin:hcp.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {unsyncedCount > 0 && (
            <Button
              variant="outline"
              onClick={handleBatchSync}
              disabled={batchSyncMutation.isPending}
            >
              <RefreshCw
                className={`mr-2 size-4 ${batchSyncMutation.isPending ? "animate-spin" : ""}`}
              />
              Sync All ({unsyncedCount})
            </Button>
          )}
          <Button onClick={() => navigate("/admin/hcp-profiles/new")}>
            <Plus className="mr-2 size-4" />
            {t("admin:hcp.createButton")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <HcpTable
        profiles={filteredProfiles}
        isLoading={isLoading}
        onEdit={(profile) => navigate(`/admin/hcp-profiles/${profile.id}`)}
        onDelete={(id) => setDeleteId(id)}
        onRetrySync={handleRetrySync}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common:delete")}</DialogTitle>
            <DialogDescription>
              {t("admin:hcp.deleteConfirmWithAgent")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              {t("common:delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

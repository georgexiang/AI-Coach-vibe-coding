import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  RefreshCw,
  Settings2,
  CheckCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  Button,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui";
import { EmptyState } from "@/components/shared/empty-state";
import { VoiceLiveInstanceCard } from "@/components/admin/voice-live-chain-card";
import { AssignHcpDialog } from "@/components/admin/assign-hcp-dialog";
import type { AssignedHcp } from "@/components/admin/voice-live-chain-card";
import {
  useVoiceLiveInstances,
  useDeleteVoiceLiveInstance,
  useUnassignVoiceLiveInstance,
} from "@/hooks/use-voice-live-instances";
import { useHcpProfiles } from "@/hooks/use-hcp-profiles";
import type { LucideIcon } from "lucide-react";
import type { VoiceLiveInstance } from "@/types/voice-live";

interface StatCardProps {
  value: number;
  label: string;
  icon: LucideIcon;
}

function StatCard({ value, label, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-2xl font-bold"
              aria-label={`${value} ${label}`}
            >
              {value}
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function VoiceLiveManagementPage() {
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useVoiceLiveInstances();
  const deleteMutation = useDeleteVoiceLiveInstance();
  const unassignMutation = useUnassignVoiceLiveInstance();
  const { data: hcpData } = useHcpProfiles();

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<VoiceLiveInstance | null>(
    null,
  );

  // Assign dialog state
  const [assignTarget, setAssignTarget] = useState<VoiceLiveInstance | null>(
    null,
  );

  const items = data?.items ?? [];
  const hcpProfiles = hcpData?.items ?? [];

  // Build a map: instanceId → list of assigned HCP {id, name}
  const assignedHcpsMap = useMemo(() => {
    const map = new Map<string, AssignedHcp[]>();
    for (const p of hcpProfiles) {
      if (p.voice_live_instance_id) {
        const list = map.get(p.voice_live_instance_id) ?? [];
        list.push({ id: p.id, name: p.name });
        map.set(p.voice_live_instance_id, list);
      }
    }
    return map;
  }, [hcpProfiles]);

  const handleUnassign = (hcpProfileId: string) => {
    unassignMutation.mutate(hcpProfileId, {
      onSuccess: () => {
        toast.success(t("voiceLive.removeInstanceSuccess"));
      },
      onError: () => {
        toast.error(t("voiceLive.assignError"));
      },
    });
  };

  const stats = useMemo(() => {
    const totalInstances = items.length;
    const enabled = items.filter((i) => i.enabled).length;
    const assignedHcps = items.reduce((sum, i) => sum + i.hcp_count, 0);
    return { totalInstances, enabled, assignedHcps };
  }, [items]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(t("voiceLive.instanceDeleted"));
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error(
          t("voiceLive.deleteConflict", { count: deleteTarget.hcp_count }),
        );
      },
    });
  };

  const openAssign = (instance: VoiceLiveInstance) => {
    setAssignTarget(instance);
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("voiceLive.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("voiceLive.pageDescription")}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/admin/voice-live/new")}>
          <Plus className="mr-2 size-4" />
          {t("voiceLive.createInstance")}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          value={stats.totalInstances}
          label={t("voiceLive.statTotalInstances")}
          icon={Settings2}
        />
        <StatCard
          value={stats.enabled}
          label={t("voiceLive.statEnabled")}
          icon={CheckCircle}
        />
        <StatCard
          value={stats.assignedHcps}
          label={t("voiceLive.statAssignedHcps")}
          icon={Users}
        />
      </div>

      {/* Instance cards grid */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t("voiceLive.loadError")}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 size-4" />
            {t("voiceLive.retrySync")}
          </Button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          title={t("voiceLive.emptyTitle")}
          body={t("voiceLive.emptyBody")}
        />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((instance) => (
            <VoiceLiveInstanceCard
              key={instance.id}
              instance={instance}
              assignedHcps={assignedHcpsMap.get(instance.id) ?? []}
              onEdit={(inst) => navigate(`/admin/voice-live/${inst.id}/edit`)}
              onDelete={setDeleteTarget}
              onAssign={openAssign}
              onUnassign={handleUnassign}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("voiceLive.deleteInstance")}</DialogTitle>
            <DialogDescription>
              {deleteTarget &&
                t("voiceLive.deleteConfirm", {
                  name: deleteTarget.name,
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              {t("voiceLive.vlDialogCancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {t("voiceLive.deleteInstance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to HCP Dialog */}
      {assignTarget && (
        <AssignHcpDialog
          open={!!assignTarget}
          onOpenChange={(open) => {
            if (!open) setAssignTarget(null);
          }}
          instanceId={assignTarget.id}
          instanceName={assignTarget.name}
        />
      )}
    </div>
  );
}

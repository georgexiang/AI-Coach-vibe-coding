import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from "@/components/ui";
import { EmptyState } from "@/components/shared/empty-state";
import { VoiceLiveInstanceCard } from "@/components/admin/voice-live-chain-card";
import { VlInstanceDialog } from "@/components/admin/vl-instance-dialog";
import {
  useVoiceLiveInstances,
  useDeleteVoiceLiveInstance,
  useAssignVoiceLiveInstance,
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
  const { data, isLoading, isError, refetch } = useVoiceLiveInstances();
  const deleteMutation = useDeleteVoiceLiveInstance();
  const assignMutation = useAssignVoiceLiveInstance();
  const { data: hcpData } = useHcpProfiles();

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] =
    useState<VoiceLiveInstance | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<VoiceLiveInstance | null>(
    null,
  );

  // Assign dialog state
  const [assignTarget, setAssignTarget] = useState<VoiceLiveInstance | null>(
    null,
  );
  const [selectedHcpId, setSelectedHcpId] = useState<string>("");

  const items = data?.items ?? [];
  const hcpProfiles = hcpData?.items ?? [];

  const stats = useMemo(() => {
    const totalInstances = items.length;
    const enabled = items.filter((i) => i.enabled).length;
    const assignedHcps = items.reduce((sum, i) => sum + i.hcp_count, 0);
    return { totalInstances, enabled, assignedHcps };
  }, [items]);

  const openCreate = () => {
    setEditingInstance(null);
    setDialogOpen(true);
  };

  const openEdit = (instance: VoiceLiveInstance) => {
    setEditingInstance(instance);
    setDialogOpen(true);
  };

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
    setSelectedHcpId("");
  };

  const handleAssign = () => {
    if (!assignTarget || !selectedHcpId) return;
    assignMutation.mutate(
      { instanceId: assignTarget.id, hcpProfileId: selectedHcpId },
      {
        onSuccess: () => {
          toast.success(t("voiceLive.assignSuccess"));
          setAssignTarget(null);
          setSelectedHcpId("");
        },
        onError: () => {
          toast.error(t("voiceLive.assignError"));
        },
      },
    );
  };

  // Filter HCP profiles: exclude those already assigned to this instance
  const availableHcps = useMemo(() => {
    if (!assignTarget) return [];
    return hcpProfiles.filter(
      (p) =>
        !p.voice_live_instance_id ||
        p.voice_live_instance_id !== assignTarget.id,
    );
  }, [hcpProfiles, assignTarget]);

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
        <Button size="sm" onClick={openCreate}>
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
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onAssign={openAssign}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog — uses rich VlInstanceDialog */}
      <VlInstanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        instance={editingInstance}
      />

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
      <Dialog
        open={!!assignTarget}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTarget(null);
            setSelectedHcpId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("voiceLive.assignDialogTitle")}</DialogTitle>
            <DialogDescription>
              {assignTarget &&
                t("voiceLive.assignDialogDescription", {
                  name: assignTarget.name,
                })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>{t("voiceLive.assignDialogSelect")}</Label>
            {availableHcps.length > 0 ? (
              <Select
                value={selectedHcpId}
                onValueChange={setSelectedHcpId}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue
                    placeholder={t("voiceLive.assignToHcpPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableHcps.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {p.specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("voiceLive.assignDialogEmpty")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignTarget(null);
                setSelectedHcpId("");
              }}
            >
              {t("voiceLive.vlDialogCancel")}
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedHcpId || assignMutation.isPending}
            >
              {t("voiceLive.assignToHcp")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

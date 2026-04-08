import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignVoiceLiveInstance } from "@/hooks/use-voice-live-instances";
import { useHcpProfiles } from "@/hooks/use-hcp-profiles";

interface AssignHcpDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onOpenChange: (open: boolean) => void;
  /** The VL instance ID to assign. */
  instanceId: string;
  /** Display name of the VL instance (shown in description). */
  instanceName: string;
}

/**
 * Shared dialog for assigning a Voice Live instance to an HCP profile.
 *
 * Used by both VoiceLiveManagementPage and VlInstanceEditorPage.
 * Fetches HCP profiles internally and filters out those already assigned
 * to the given instance.
 */
export function AssignHcpDialog({
  open,
  onOpenChange,
  instanceId,
  instanceName,
}: AssignHcpDialogProps) {
  const { t } = useTranslation("admin");
  const [selectedHcpId, setSelectedHcpId] = useState("");
  const assignMutation = useAssignVoiceLiveInstance();
  const { data: hcpData } = useHcpProfiles();
  const hcpProfiles = hcpData?.items ?? [];

  // Filter HCPs: exclude those already assigned to this instance
  const availableHcps = useMemo(
    () =>
      hcpProfiles.filter(
        (p) => !p.voice_live_instance_id || p.voice_live_instance_id !== instanceId,
      ),
    [hcpProfiles, instanceId],
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setSelectedHcpId("");
  }, [onOpenChange]);

  const handleAssign = useCallback(() => {
    if (!instanceId || !selectedHcpId) return;
    assignMutation.mutate(
      { instanceId, hcpProfileId: selectedHcpId },
      {
        onSuccess: () => {
          toast.success(t("voiceLive.assignSuccess"));
          handleClose();
        },
        onError: () => {
          toast.error(t("voiceLive.assignError"));
        },
      },
    );
  }, [instanceId, selectedHcpId, assignMutation, t, handleClose]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("voiceLive.assignDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("voiceLive.assignDialogDescription", {
              name: instanceName || "this instance",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label>{t("voiceLive.assignDialogSelect")}</Label>
          {availableHcps.length > 0 ? (
            <Select value={selectedHcpId} onValueChange={setSelectedHcpId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue
                  placeholder={t("voiceLive.assignToHcpPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {availableHcps.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.specialty}
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
          <Button variant="outline" onClick={handleClose}>
            {t("voiceLive.vlDialogCancel")}
          </Button>
          <Button
            disabled={!selectedHcpId || assignMutation.isPending}
            onClick={handleAssign}
          >
            {assignMutation.isPending
              ? t("voiceLive.vlDialogSaving")
              : t("voiceLive.assignToHcp")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

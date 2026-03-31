import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { HcpTable } from "@/components/admin/hcp-table";
import { HcpEditor } from "@/components/admin/hcp-editor";
import { TestChatDialog } from "@/components/admin/test-chat-dialog";
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
  useCreateHcpProfile,
  useUpdateHcpProfile,
  useDeleteHcpProfile,
  useRetrySyncHcpProfile,
} from "@/hooks/use-hcp-profiles";
import type { HcpProfile, HcpProfileCreate, HcpProfileUpdate } from "@/types/hcp";

export default function HcpProfilesPage() {
  const { t } = useTranslation(["admin", "common"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProfile, setEditingProfile] = useState<HcpProfile | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testChatOpen, setTestChatOpen] = useState(false);
  const [testChatProfile, setTestChatProfile] = useState<HcpProfile | null>(
    null,
  );

  const { data: profilesData, isLoading } = useHcpProfiles();
  const createMutation = useCreateHcpProfile();
  const updateMutation = useUpdateHcpProfile();
  const deleteMutation = useDeleteHcpProfile();
  const retrySyncMutation = useRetrySyncHcpProfile();

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

  const handleDialogClose = () => {
    setEditingProfile(null);
    setIsCreatingNew(false);
  };

  const handleSave = (data: HcpProfileCreate | HcpProfileUpdate) => {
    if (isCreatingNew) {
      createMutation.mutate(data as HcpProfileCreate, {
        onSuccess: () => {
          toast.success(t("admin:hcp.save"));
          handleDialogClose();
        },
        onError: () => {
          toast.error(t("admin:errors.hcpSaveFailed"));
        },
      });
    } else if (editingProfile) {
      updateMutation.mutate(
        { id: editingProfile.id, data: data as HcpProfileUpdate },
        {
          onSuccess: () => {
            toast.success(t("admin:hcp.save"));
            handleDialogClose();
          },
          onError: () => {
            toast.error(t("admin:errors.hcpSaveFailed"));
          },
        },
      );
    }
  };

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

  const handleTestChat = () => {
    const profile = editingProfile;
    if (profile) {
      setTestChatProfile(profile);
      setTestChatOpen(true);
    }
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
        <Button onClick={() => setIsCreatingNew(true)}>
          <Plus className="mr-2 size-4" />
          {t("admin:hcp.createButton")}
        </Button>
      </div>

      {/* Table */}
      <HcpTable
        profiles={filteredProfiles}
        isLoading={isLoading}
        onEdit={(profile) => setEditingProfile(profile)}
        onDelete={(id) => setDeleteId(id)}
        onRetrySync={handleRetrySync}
      />

      {/* Edit/Create Dialog */}
      <Dialog
        open={!!editingProfile || isCreatingNew}
        onOpenChange={(open) => {
          if (!open) handleDialogClose();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreatingNew
                ? t("admin:hcp.createButton")
                : t("admin:hcp.save")}
            </DialogTitle>
          </DialogHeader>
          <HcpEditor
            profile={editingProfile}
            onSave={handleSave}
            onTestChat={handleTestChat}
            onDiscard={handleDialogClose}
            isNew={isCreatingNew}
          />
        </DialogContent>
      </Dialog>

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

      {/* Test Chat Dialog */}
      {testChatProfile && (
        <TestChatDialog
          profileId={testChatProfile.id}
          profileName={testChatProfile.name}
          personalityType={testChatProfile.personality_type}
          open={testChatOpen}
          onOpenChange={setTestChatOpen}
        />
      )}
    </div>
  );
}

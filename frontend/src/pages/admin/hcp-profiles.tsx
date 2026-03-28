import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HcpList } from "@/components/admin/hcp-list";
import { HcpEditor } from "@/components/admin/hcp-editor";
import { TestChatDialog } from "@/components/admin/test-chat-dialog";
import {
  useHcpProfiles,
  useHcpProfile,
  useCreateHcpProfile,
  useUpdateHcpProfile,
} from "@/hooks/use-hcp-profiles";
import type { HcpProfileCreate, HcpProfileUpdate } from "@/types/hcp";

export default function HcpProfilesPage() {
  const { t } = useTranslation("admin");
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [testChatOpen, setTestChatOpen] = useState(false);

  const { data: profilesData } = useHcpProfiles({ search: searchQuery });
  const { data: selectedProfile } = useHcpProfile(
    isCreatingNew ? undefined : selectedProfileId,
  );
  const createMutation = useCreateHcpProfile();
  const updateMutation = useUpdateHcpProfile();

  const profiles = useMemo(
    () => profilesData?.items ?? [],
    [profilesData],
  );

  const handleSelect = (id: string) => {
    setIsCreatingNew(false);
    setSelectedProfileId(id);
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedProfileId(undefined);
  };

  const handleSave = (data: HcpProfileCreate | HcpProfileUpdate) => {
    if (isCreatingNew) {
      createMutation.mutate(data as HcpProfileCreate, {
        onSuccess: () => {
          toast.success(t("hcp.save"));
          setIsCreatingNew(false);
        },
        onError: () => {
          toast.error(t("errors.hcpSaveFailed"));
        },
      });
    } else if (selectedProfileId) {
      updateMutation.mutate(
        { id: selectedProfileId, data: data as HcpProfileUpdate },
        {
          onSuccess: () => {
            toast.success(t("hcp.save"));
          },
          onError: () => {
            toast.error(t("errors.hcpSaveFailed"));
          },
        },
      );
    }
  };

  const handleDiscard = () => {
    if (isCreatingNew) {
      setIsCreatingNew(false);
    }
  };

  const handleTestChat = () => {
    setTestChatOpen(true);
  };

  const currentProfile = isCreatingNew ? null : (selectedProfile ?? null);

  return (
    <div className="flex h-full gap-6">
      <HcpList
        profiles={profiles}
        selectedId={selectedProfileId}
        onSelect={handleSelect}
        onCreateNew={handleCreateNew}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      {(selectedProfileId || isCreatingNew) ? (
        <HcpEditor
          profile={currentProfile ?? null}
          onSave={handleSave}
          onTestChat={handleTestChat}
          onDiscard={handleDiscard}
          isNew={isCreatingNew}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border bg-card text-muted-foreground">
          <p className="text-sm">{t("hcp.emptyBody")}</p>
        </div>
      )}

      {(selectedProfile ?? isCreatingNew) && (
        <TestChatDialog
          profileId={selectedProfileId ?? "new"}
          profileName={currentProfile?.name ?? "New HCP"}
          personalityType={currentProfile?.personality_type}
          open={testChatOpen}
          onOpenChange={setTestChatOpen}
        />
      )}
    </div>
  );
}

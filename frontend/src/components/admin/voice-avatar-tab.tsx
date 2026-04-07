import type { UseFormReturn } from "react-hook-form";
import { AgentConfigLeftPanel } from "@/components/admin/agent-config-left-panel";
import { PlaygroundPreviewPanel } from "@/components/admin/playground-preview-panel";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";
import type { HcpProfile } from "@/types/hcp";

interface VoiceAvatarTabProps {
  form: UseFormReturn<HcpFormValues>;
  profile?: HcpProfile;
  isNew: boolean;
}

export function VoiceAvatarTab({ form, profile, isNew }: VoiceAvatarTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel: Agent Configuration */}
      <div className="space-y-4">
        <AgentConfigLeftPanel form={form} profile={profile} isNew={isNew} />
      </div>
      {/* Right Panel: Playground Preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <PlaygroundPreviewPanel
          hcpProfileId={profile?.id}
          vlInstanceId={form.watch("voice_live_instance_id") ?? undefined}
          systemPrompt={form.watch("agent_instructions_override") ?? ""}
          avatarCharacter={form.watch("avatar_character")}
          avatarStyle={form.watch("avatar_style")}
          avatarEnabled={!!form.watch("avatar_character")}
          disabled={isNew}
        />
      </div>
    </div>
  );
}

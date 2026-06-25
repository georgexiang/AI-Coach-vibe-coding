import { Plus, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HcpProfile } from "@/types/hcp";
import type { AudienceHcpCreate } from "@/types/conference";

export const MIN_AUDIENCE = 2;
export const MAX_AUDIENCE = 5;

export interface ConferenceAudienceConfigLabels {
  title: string;
  description: string;
  selectHcp: string;
  role: string;
  roleAudience: string;
  roleModerator: string;
  addHcp: string;
  removeHcp: string;
  countHint: string;
  minHint: string;
  duplicateHint: string;
}

interface ConferenceAudienceConfigProps {
  value: AudienceHcpCreate[];
  onChange: (next: AudienceHcpCreate[]) => void;
  profiles: HcpProfile[];
  labels: ConferenceAudienceConfigLabels;
}

const ROLES = ["audience", "moderator"] as const;

export function ConferenceAudienceConfig({
  value,
  onChange,
  profiles,
  labels,
}: ConferenceAudienceConfigProps) {
  const canAdd = value.length < MAX_AUDIENCE;

  const hcpIds = value.map((a) => a.hcpProfileId);
  const hasDuplicate =
    hcpIds.filter(Boolean).length !==
    new Set(hcpIds.filter(Boolean)).size;
  const belowMin = value.length < MIN_AUDIENCE;

  const handleAdd = () => {
    if (!canAdd) return;
    onChange([
      ...value,
      { hcpProfileId: "", roleInConference: "audience", sortOrder: value.length },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(
      value
        .filter((_, i) => i !== index)
        .map((a, i) => ({ ...a, sortOrder: i })),
    );
  };

  const handleChange = (index: number, patch: Partial<AudienceHcpCreate>) => {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  return (
    <div className="grid gap-3" data-testid="conference-audience-config">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <Label className="font-semibold">{labels.title}</Label>
      </div>
      <p className="text-sm text-muted-foreground">{labels.description}</p>

      <div className="space-y-2">
        {value.map((member, index) => (
          <div key={index} className="flex items-center gap-2">
            <Select
              value={member.hcpProfileId}
              onValueChange={(v) => handleChange(index, { hcpProfileId: v })}
            >
              <SelectTrigger className="flex-1" aria-label={labels.selectHcp}>
                <SelectValue placeholder={labels.selectHcp} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={member.roleInConference ?? "audience"}
              onValueChange={(v) =>
                handleChange(index, { roleInConference: v })
              }
            >
              <SelectTrigger className="w-36" aria-label={labels.role}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "moderator"
                      ? labels.roleModerator
                      : labels.roleAudience}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              aria-label={labels.removeHcp}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={!canAdd}
        className="w-fit"
      >
        <Plus className="size-4" />
        {labels.addHcp}
      </Button>

      <p className="text-xs text-muted-foreground">
        {labels.countHint
          .replace("{{count}}", String(value.length))
          .replace("{{min}}", String(MIN_AUDIENCE))
          .replace("{{max}}", String(MAX_AUDIENCE))}
      </p>
      {belowMin && (
        <p className="text-xs text-destructive" role="alert">
          {labels.minHint.replace("{{min}}", String(MIN_AUDIENCE))}
        </p>
      )}
      {hasDuplicate && (
        <p className="text-xs text-destructive" role="alert">
          {labels.duplicateHint}
        </p>
      )}
    </div>
  );
}

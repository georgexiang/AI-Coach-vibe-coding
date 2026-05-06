import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, X, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui";
import { ObjectionList } from "./objection-list";
import { useHcpProfiles } from "@/hooks/use-hcp-profiles";
import { usePublishedSkills } from "@/hooks/use-skills";
import { useRubrics } from "@/hooks/use-rubrics";
import type { Scenario, ScenarioCreate } from "@/types/scenario";
import type { HcpProfile } from "@/types/hcp";
import type { Rubric } from "@/types/rubric";

/** Predefined tag categories with values. Will migrate to system_enums API in future. */
const PREDEFINED_TAGS: Record<string, string[]> = {
  product: ["Tislelizumab", "Zanubrutinib", "Pamiparib", "Lifirafenib", "Ociperlimab"],
  therapeutic_area: ["Oncology", "Hematology", "Immunology", "Solid Tumors"],
};

const scenarioSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  tags: z.array(z.string()),
  hcp_profile_id: z.string().min(1, "HCP profile is required"),
  mode: z.enum(["f2f", "conference"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  key_messages: z.array(z.string()),
  skill_id: z.string().min(1, "Skill is required"),
  rubric_id: z.string().min(1, "Scoring rubric is required"),
  pass_threshold: z.number().min(0).max(100),
});

type ScenarioFormValues = z.infer<typeof scenarioSchema>;

interface ScenarioEditorProps {
  scenario: Scenario | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ScenarioCreate) => void;
  isNew: boolean;
}

export function ScenarioEditor({
  scenario,
  open,
  onOpenChange,
  onSave,
  isNew,
}: ScenarioEditorProps) {
  const { t } = useTranslation("admin");
  const { data: profilesData } = useHcpProfiles();
  const { data: publishedSkillsData } = usePublishedSkills();
  const { data: rubricsData } = useRubrics();
  const navigate = useNavigate();
  const rubrics: Rubric[] = useMemo(() => rubricsData ?? [], [rubricsData]);
  const profiles: HcpProfile[] = useMemo(
    () => profilesData?.items ?? [],
    [profilesData],
  );
  const publishedSkills = useMemo(
    () => publishedSkillsData?.items ?? [],
    [publishedSkillsData],
  );

  const [customTagInput, setCustomTagInput] = useState("");

  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      name: "",
      description: "",
      tags: [],
      hcp_profile_id: "",
      mode: "f2f",
      difficulty: "medium",
      key_messages: [],
      skill_id: "",
      rubric_id: "",
      pass_threshold: 70,
    },
  });

  const selectedRubric = rubrics.find((r) => r.id === form.watch("rubric_id"));
  const currentTags = form.watch("tags");

  useEffect(() => {
    if (scenario && !isNew) {
      form.reset({
        name: scenario.name,
        description: scenario.description ?? "",
        tags: scenario.tags ?? [],
        hcp_profile_id: scenario.hcp_profile_id,
        mode: scenario.mode,
        difficulty: scenario.difficulty,
        key_messages: scenario.key_messages,
        skill_id: scenario.skill_id,
        rubric_id: scenario.rubric_id,
        pass_threshold: scenario.pass_threshold,
      });
    } else if (isNew) {
      form.reset({
        name: "",
        description: "",
        tags: [],
        hcp_profile_id: "",
        mode: "f2f",
        difficulty: "medium",
        key_messages: [],
        skill_id: "",
        rubric_id: "",
        pass_threshold: 70,
      });
    }
  }, [scenario, isNew, form]);

  const handleSubmit = (values: ScenarioFormValues) => {
    onSave({
      ...values,
      key_messages: values.key_messages.filter(Boolean),
    });
  };

  const addTag = (tag: string) => {
    if (tag && !currentTags.includes(tag)) {
      form.setValue("tags", [...currentTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    form.setValue("tags", currentTags.filter((t) => t !== tag));
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed) {
      const tagValue = trimmed.includes(":") ? trimmed : `custom:${trimmed}`;
      addTag(tagValue);
      setCustomTagInput("");
    }
  };

  const selectedProfile = profiles.find(
    (p) => p.id === form.watch("hcp_profile_id"),
  );

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? t("scenarios.createButton") : `Edit: ${scenario?.name ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {t("scenarios.editorDescription", { defaultValue: "Configure scenario details and scoring rubric" })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("scenarios.fieldName", { defaultValue: "Name *" })}</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>{t("scenarios.fieldHcp", { defaultValue: "Assigned HCP *" })}</Label>
              <Controller
                control={form.control}
                name="hcp_profile_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("scenarios.selectHcp", { defaultValue: "Select HCP" })}>
                        {selectedProfile && (
                          <div className="flex items-center gap-2">
                            <Avatar className="size-5">
                              <AvatarImage src={selectedProfile.avatar_url} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-[10px]">
                                {getInitials(selectedProfile.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{selectedProfile.name}</span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-5">
                              <AvatarImage src={p.avatar_url} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-[10px]">
                                {getInitials(p.name)}
                              </AvatarFallback>
                            </Avatar>
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("scenarios.fieldDescription", { defaultValue: "Description" })}</Label>
            <Textarea rows={2} {...form.register("description")} />
          </div>

          {/* Tags Section */}
          <div className="grid gap-2">
            <Label>{t("scenarios.tags", { defaultValue: "Tags" })}</Label>

            {/* Current tags display */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 border rounded-md bg-muted/30">
              {currentTags.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("scenarios.noTags", { defaultValue: "No tags" })}
                </span>
              )}
              {currentTags.map((tag) => {
                const value = tag.includes(":") ? tag.split(":").slice(1).join(":") : tag;
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs gap-1 pr-1"
                  >
                    {value}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>

            {/* Predefined tag categories */}
            {Object.entries(PREDEFINED_TAGS).map(([category, values]) => (
              <div key={category} className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground capitalize min-w-[80px]">
                  {category.replace("_", " ")}:
                </span>
                {values.map((value) => {
                  const fullTag = `${category}:${value}`;
                  const isSelected = currentTags.includes(fullTag);
                  return (
                    <button
                      key={fullTag}
                      type="button"
                      onClick={() => isSelected ? removeTag(fullTag) : addTag(fullTag)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Custom tag input */}
            <div className="flex items-center gap-2">
              <Input
                placeholder={t("scenarios.customTag", { defaultValue: "Custom tag" })}
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                className="flex-1 h-8 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomTag}
                className="h-8"
              >
                <Plus className="size-3.5" />
                {t("scenarios.addTag", { defaultValue: "Add" })}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("scenarios.fieldMode", { defaultValue: "Mode" })}</Label>
              <div className="flex items-center gap-4">
                {(["f2f", "conference"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={m}
                      checked={form.watch("mode") === m}
                      onChange={() => form.setValue("mode", m)}
                      className="accent-primary"
                    />
                    <span className="text-sm uppercase">{m}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("scenarios.fieldDifficulty", { defaultValue: "Difficulty" })}</Label>
              <div className="flex items-center gap-4">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={d}
                      checked={form.watch("difficulty") === d}
                      onChange={() => form.setValue("difficulty", d)}
                      className="accent-primary"
                    />
                    <span className="text-sm capitalize">{d}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("scenarios.skillRequired", { defaultValue: "Skill *" })}</Label>
            <Controller
              control={form.control}
              name="skill_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("scenarios.selectSkill", { defaultValue: "Select a published skill" })} />
                  </SelectTrigger>
                  <SelectContent>
                    {publishedSkills.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            v{s.current_version}
                          </span>
                          {s.quality_score != null && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Q:{s.quality_score}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.skill_id && (
              <p className="text-destructive text-sm">
                {form.formState.errors.skill_id.message}
              </p>
            )}
            {publishedSkills.length === 0 && (
              <p className="text-sm text-destructive">
                {t("scenarios.noPublishedSkillsWarning", { defaultValue: "No published skills available. Create and publish a skill first." })}
              </p>
            )}
            {scenario?.skill_id && scenario.skill_id === form.watch("skill_id") && (
              <SkillStatusBadge skillId={scenario.skill_id} />
            )}
          </div>

          <ObjectionList
            items={form.watch("key_messages")}
            onChange={(items) => form.setValue("key_messages", items)}
            label={t("scenarios.keyMessages")}
            addLabel={t("scenarios.addKeyMessage")}
          />

          {/* Scoring Rubric Selector */}
          <div className="grid gap-2">
            <Label>{t("scenarios.scoringRubric")} *</Label>
            <Controller
              control={form.control}
              name="rubric_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("scenarios.selectRubric")} />
                  </SelectTrigger>
                  <SelectContent>
                    {rubrics
                      .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} {r.is_default ? t("scenarios.rubricDefault") : ""}
                          ({t("scenarios.dimensionCount", { count: r.dimensions.length })})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.rubric_id && (
              <p className="text-destructive text-sm">
                {t("scenarios.rubricRequired")}
              </p>
            )}
          </div>

          {/* Rubric Dimension Preview */}
          {selectedRubric ? (
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-2">
                {selectedRubric.dimensions.map((dim) => (
                  <div key={dim.name} className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{dim.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">{dim.weight}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full mt-1">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${dim.weight}%` }}
                        />
                      </div>
                      {dim.criteria.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {dim.criteria.join("; ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("scenarios.dimensionPreviewEmpty")}
            </p>
          )}

          {/* Manage Rubrics link */}
          <button
            type="button"
            className="text-sm text-primary hover:underline cursor-pointer"
            onClick={() => navigate("/admin/scoring-rubrics")}
          >
            {t("scenarios.manageRubrics")}
          </button>

          <div className="grid gap-2">
            <Label>{t("scenarios.passThreshold")}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              {...form.register("pass_threshold", { valueAsNumber: true })}
              className="w-32"
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant="default">
              {t("scenarios.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Inline badge that warns when skill is archived (D-23). */
function SkillStatusBadge({ skillId }: { skillId: string }) {
  const { data: skillsData } = usePublishedSkills();
  const allSkills = skillsData?.items ?? [];
  // If the skill is no longer in published list, it may be archived
  const skill = allSkills.find((s) => s.id === skillId);
  if (skill) {
    return null; // Published — no warning needed
  }
  return (
    <div className="flex items-center gap-1 text-xs text-warning">
      <AlertTriangle className="size-3" />
      <span>{useTranslation("admin").t("scenarios.skillArchived", { defaultValue: "This skill is archived" })}</span>
    </div>
  );
}

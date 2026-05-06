import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, AlertTriangle, X, Plus, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ObjectionList } from "@/components/admin/objection-list";
import {
  useScenario,
  useCreateScenario,
  useUpdateScenario,
} from "@/hooks/use-scenarios";
import { useHcpProfiles } from "@/hooks/use-hcp-profiles";
import { usePublishedSkills } from "@/hooks/use-skills";
import { useRubrics } from "@/hooks/use-rubrics";
import type { ScenarioCreate, ScenarioUpdate } from "@/types/scenario";
import type { HcpProfile } from "@/types/hcp";
import type { Rubric } from "@/types/rubric";

/** Predefined tag categories with values. Will migrate to system_enums API in future. */
const PREDEFINED_TAGS: Record<string, string[]> = {
  product: ["Tislelizumab", "Zanubrutinib", "Pamiparib", "Lifirafenib", "Ociperlimab"],
  therapeutic_area: ["Oncology", "Hematology", "Immunology", "Solid Tumors"],
};

const scenarioSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  tags: z.array(z.string()),
  mode: z.enum(["f2f", "conference"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  hcp_profile_id: z.string().min(1, "HCP profile is required"),
  skill_id: z.string().min(1, "Skill is required"),
  key_messages: z.array(z.string()),
  rubric_id: z.string().min(1, "Scoring rubric is required"),
  pass_threshold: z.number().min(0).max(100),
});

type ScenarioFormValues = z.infer<typeof scenarioSchema>;

const VALID_TABS = new Set(["basic", "linked", "scoring"]);

export default function ScenarioEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(["admin", "common"]);
  const isNew = !id;

  const { data: scenario, isLoading: scenarioLoading } = useScenario(id);
  const createMutation = useCreateScenario();
  const updateMutation = useUpdateScenario();

  const { data: profilesData } = useHcpProfiles();
  const { data: publishedSkillsData } = usePublishedSkills();
  const { data: rubricsData } = useRubrics();

  const profiles: HcpProfile[] = useMemo(
    () => profilesData?.items ?? [],
    [profilesData],
  );
  const publishedSkills = useMemo(
    () => publishedSkillsData?.items ?? [],
    [publishedSkillsData],
  );
  const rubrics: Rubric[] = useMemo(() => rubricsData ?? [], [rubricsData]);

  const [activeTab, setActiveTab] = useState("basic");
  const handleTabChange = (value: string) => {
    setActiveTab(VALID_TABS.has(value) ? value : "basic");
  };

  const [customTagInput, setCustomTagInput] = useState("");

  const isArchived = scenario?.status === "archived";

  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioSchema) as Resolver<ScenarioFormValues>,
    defaultValues: {
      name: "",
      description: "",
      tags: [],
      mode: "f2f",
      difficulty: "medium",
      hcp_profile_id: "",
      skill_id: "",
      key_messages: [],
      rubric_id: "",
      pass_threshold: 70,
    },
  });

  useEffect(() => {
    if (scenario) {
      form.reset({
        name: scenario.name,
        description: scenario.description ?? "",
        tags: scenario.tags ?? [],
        mode: scenario.mode,
        difficulty: scenario.difficulty,
        hcp_profile_id: scenario.hcp_profile_id,
        skill_id: scenario.skill_id,
        key_messages: scenario.key_messages,
        rubric_id: scenario.rubric_id,
        pass_threshold: scenario.pass_threshold,
      });
    }
  }, [scenario, form]);

  const handleSubmit = (values: ScenarioFormValues) => {
    const data: ScenarioCreate = {
      ...values,
      key_messages: values.key_messages.filter(Boolean),
    };

    if (isNew) {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success(t("admin:scenarios.save"));
          navigate("/admin/scenarios");
        },
        onError: () => toast.error(t("admin:errors.scenarioSaveFailed", { defaultValue: "Failed to save scenario" })),
      });
    } else if (id) {
      const updateData: ScenarioUpdate = {
        ...values,
        key_messages: values.key_messages.filter(Boolean),
      };
      updateMutation.mutate(
        { id, data: updateData },
        {
          onSuccess: () => {
            toast.success(t("admin:scenarios.save"));
            navigate("/admin/scenarios");
          },
          onError: () => toast.error(t("admin:errors.scenarioSaveFailed", { defaultValue: "Failed to save scenario" })),
        },
      );
    }
  };

  const currentTags = form.watch("tags");

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

  const selectedRubric = rubrics.find((r) => r.id === form.watch("rubric_id"));

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

  if (!isNew && scenarioLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/scenarios")}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-medium">
              {isNew
                ? t("admin:scenarios.createButton")
                : t("admin:scenarios.editTitle", { name: scenario?.name ?? "", defaultValue: `Edit: ${scenario?.name ?? ""}` })}
            </h1>
          </div>
        </div>
        <Button
          onClick={form.handleSubmit(handleSubmit)}
          disabled={isArchived || createMutation.isPending || updateMutation.isPending}
        >
          <Save className="size-4 mr-2" />
          {createMutation.isPending || updateMutation.isPending
            ? t("common:saving", { defaultValue: "Saving..." })
            : t("admin:scenarios.save")}
        </Button>
      </div>

      {/* Archived banner */}
      {isArchived && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted border border-border">
          <Info className="size-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            {t("admin:scenarios.archivedBanner", { defaultValue: "This scenario is archived and read-only. Clone to create an editable copy." })}
          </p>
        </div>
      )}

      {/* Form wraps entire Tabs so state persists across tab switches */}
      <Form {...form}>
        <fieldset disabled={isArchived}>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full bg-muted/60 border">
              <TabsTrigger
                value="basic"
                className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {t("admin:scenarios.tabBasic", { defaultValue: "Basic Info" })}
              </TabsTrigger>
              <TabsTrigger
                value="linked"
                className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {t("admin:scenarios.tabLinked", { defaultValue: "Linked Config" })}
              </TabsTrigger>
              <TabsTrigger
                value="scoring"
                className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {t("admin:scenarios.tabScoring", { defaultValue: "Scoring Rules" })}
              </TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("admin:scenarios.tabBasic", { defaultValue: "Basic Info" })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("admin:scenarios.fieldName", { defaultValue: "Name *" })}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("admin:scenarios.fieldDescription", { defaultValue: "Description" })}</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>{t("admin:scenarios.fieldMode", { defaultValue: "Mode" })}</Label>
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
                      <Label>{t("admin:scenarios.fieldDifficulty", { defaultValue: "Difficulty" })}</Label>
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

                  {/* Tags Section */}
                  <div className="grid gap-2">
                    <Label>{t("admin:scenarios.tags", { defaultValue: "Tags" })}</Label>

                    {/* Current tags display */}
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 border rounded-md bg-muted/30">
                      {currentTags.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          {t("admin:scenarios.noTags", { defaultValue: "No tags" })}
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
                        placeholder={t("admin:scenarios.customTag", { defaultValue: "Custom tag" })}
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
                        {t("admin:scenarios.addTag", { defaultValue: "Add" })}
                      </Button>
                    </div>
                  </div>

                  {/* Key Messages */}
                  <ObjectionList
                    items={form.watch("key_messages")}
                    onChange={(items) => form.setValue("key_messages", items)}
                    label={t("admin:scenarios.keyMessages")}
                    addLabel={t("admin:scenarios.addKeyMessage")}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Linked Config Tab */}
            <TabsContent value="linked" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("admin:scenarios.tabLinked", { defaultValue: "Linked Config" })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* HCP Profile Selector */}
                  <div className="grid gap-2">
                    <Label>{t("admin:scenarios.fieldHcp", { defaultValue: "HCP Profile *" })}</Label>
                    <Controller
                      control={form.control}
                      name="hcp_profile_id"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("admin:scenarios.selectHcp", { defaultValue: "Select HCP" })}>
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
                    {form.formState.errors.hcp_profile_id && (
                      <p className="text-destructive text-sm">
                        {t("admin:scenarios.hcpRequired", { defaultValue: "HCP profile is required" })}
                      </p>
                    )}
                  </div>

                  {/* Skill Selector */}
                  <div className="grid gap-2">
                    <Label>{t("admin:scenarios.skillLabel", { defaultValue: "Skill *" })}</Label>
                    <Controller
                      control={form.control}
                      name="skill_id"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("admin:scenarios.selectSkill", { defaultValue: "Select a published skill" })} />
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
                        {t("admin:scenarios.noPublishedSkillsWarning", { defaultValue: "No published skills available. Create and publish a skill first." })}
                      </p>
                    )}
                    {scenario?.skill_id && scenario.skill_id === form.watch("skill_id") && (
                      <SkillStatusBadge skillId={scenario.skill_id} />
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scoring Rules Tab */}
            <TabsContent value="scoring" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("admin:scenarios.tabScoring", { defaultValue: "Scoring Rules" })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Rubric Selector */}
                  <div className="grid gap-2">
                    <Label>{t("admin:scenarios.scoringRubric")} *</Label>
                    <Controller
                      control={form.control}
                      name="rubric_id"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("admin:scenarios.selectRubric")} />
                          </SelectTrigger>
                          <SelectContent>
                            {rubrics
                              .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
                              .map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name} {r.is_default ? t("admin:scenarios.rubricDefault") : ""}
                                  ({t("admin:scenarios.dimensionCount", { count: r.dimensions.length })})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {form.formState.errors.rubric_id && (
                      <p className="text-destructive text-sm">
                        {t("admin:scenarios.rubricRequired")}
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
                      {t("admin:scenarios.dimensionPreviewEmpty")}
                    </p>
                  )}

                  {/* Manage Rubrics link */}
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline cursor-pointer"
                    onClick={() => navigate("/admin/scoring-rubrics")}
                  >
                    {t("admin:scenarios.manageRubrics")}
                  </button>

                  {/* Pass Threshold */}
                  <div className="grid gap-2">
                    <Label>{t("admin:scenarios.passThreshold")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...form.register("pass_threshold", { valueAsNumber: true })}
                      className="w-32"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </fieldset>
      </Form>
    </div>
  );
}

/** Inline badge that warns when skill is archived. */
function SkillStatusBadge({ skillId }: { skillId: string }) {
  const { t } = useTranslation("admin");
  const { data: skillsData } = usePublishedSkills();
  const allSkills = skillsData?.items ?? [];
  const skill = allSkills.find((s) => s.id === skillId);
  if (skill) {
    return null;
  }
  return (
    <div className="flex items-center gap-1 text-xs text-warning">
      <AlertTriangle className="size-3" />
      <span>{t("scenarios.skillArchived", { defaultValue: "This skill is archived" })}</span>
    </div>
  );
}

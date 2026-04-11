import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle } from "lucide-react";
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
import { ScoringWeights } from "./scoring-weights";
import { ObjectionList } from "./objection-list";
import { useHcpProfiles } from "@/hooks/use-hcp-profiles";
import { usePublishedSkills } from "@/hooks/use-skills";
import type { Scenario, ScenarioCreate } from "@/types/scenario";
import type { HcpProfile } from "@/types/hcp";

const PRODUCTS = [
  "Tislelizumab",
  "Zanubrutinib",
  "Pamiparib",
  "Lifirafenib",
  "Ociperlimab",
];

const THERAPEUTIC_AREAS = [
  "Oncology",
  "Hematology",
  "Immunology",
  "Solid Tumors",
];

const NO_SKILL = "__none__";

const scenarioSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  product: z.string().min(1, "Product is required"),
  therapeutic_area: z.string().optional(),
  hcp_profile_id: z.string().min(1, "HCP profile is required"),
  mode: z.enum(["f2f", "conference"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  key_messages: z.array(z.string()),
  skill_id: z.string().nullable().optional(),
  weight_key_message: z.number().min(0).max(100),
  weight_objection_handling: z.number().min(0).max(100),
  weight_communication: z.number().min(0).max(100),
  weight_product_knowledge: z.number().min(0).max(100),
  weight_scientific_info: z.number().min(0).max(100),
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
  const profiles: HcpProfile[] = useMemo(
    () => profilesData?.items ?? [],
    [profilesData],
  );
  const publishedSkills = useMemo(
    () => publishedSkillsData?.items ?? [],
    [publishedSkillsData],
  );

  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      name: "",
      description: "",
      product: "",
      therapeutic_area: "",
      hcp_profile_id: "",
      mode: "f2f",
      difficulty: "medium",
      key_messages: [],
      skill_id: null,
      weight_key_message: 30,
      weight_objection_handling: 25,
      weight_communication: 20,
      weight_product_knowledge: 15,
      weight_scientific_info: 10,
      pass_threshold: 70,
    },
  });

  useEffect(() => {
    if (scenario && !isNew) {
      form.reset({
        name: scenario.name,
        description: scenario.description ?? "",
        product: scenario.product,
        therapeutic_area: scenario.therapeutic_area ?? "",
        hcp_profile_id: scenario.hcp_profile_id,
        mode: scenario.mode,
        difficulty: scenario.difficulty,
        key_messages: scenario.key_messages,
        skill_id: scenario.skill_id ?? null,
        weight_key_message: scenario.weight_key_message,
        weight_objection_handling: scenario.weight_objection_handling,
        weight_communication: scenario.weight_communication,
        weight_product_knowledge: scenario.weight_product_knowledge,
        weight_scientific_info: scenario.weight_scientific_info,
        pass_threshold: scenario.pass_threshold,
      });
    } else if (isNew) {
      form.reset({
        name: "",
        description: "",
        product: "",
        therapeutic_area: "",
        hcp_profile_id: "",
        mode: "f2f",
        difficulty: "medium",
        key_messages: [],
        skill_id: null,
        weight_key_message: 30,
        weight_objection_handling: 25,
        weight_communication: 20,
        weight_product_knowledge: 15,
        weight_scientific_info: 10,
        pass_threshold: 70,
      });
    }
  }, [scenario, isNew, form]);

  const handleSubmit = (values: ScenarioFormValues) => {
    onSave({
      ...values,
      key_messages: values.key_messages.filter(Boolean),
      skill_id: values.skill_id || null,
    });
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
            Configure scenario details and scoring weights
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Product *</Label>
              <Controller
                control={form.control}
                name="product"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea rows={2} {...form.register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Therapeutic Area</Label>
              <Controller
                control={form.control}
                name="therapeutic_area"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {THERAPEUTIC_AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label>Assigned HCP *</Label>
              <Controller
                control={form.control}
                name="hcp_profile_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select HCP">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Mode</Label>
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
              <Label>Difficulty</Label>
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
            <Label>Skill</Label>
            <Controller
              control={form.control}
              name="skill_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_SKILL}
                  onValueChange={(v) => field.onChange(v === NO_SKILL ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SKILL}>
                      <span className="text-muted-foreground">No skill</span>
                    </SelectItem>
                    {publishedSkills.length === 0 && (
                      <SelectItem value="__placeholder__" disabled>
                        <span className="text-muted-foreground text-sm">No published skills available</span>
                      </SelectItem>
                    )}
                    {publishedSkills.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span>{s.name}</span>
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

          <ScoringWeights
            weights={{
              key_message: form.watch("weight_key_message"),
              objection_handling: form.watch("weight_objection_handling"),
              communication: form.watch("weight_communication"),
              product_knowledge: form.watch("weight_product_knowledge"),
              scientific_info: form.watch("weight_scientific_info"),
            }}
            onChange={(w) => {
              form.setValue("weight_key_message", w.key_message);
              form.setValue("weight_objection_handling", w.objection_handling);
              form.setValue("weight_communication", w.communication);
              form.setValue("weight_product_knowledge", w.product_knowledge);
              form.setValue("weight_scientific_info", w.scientific_info);
            }}
          />

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
      <span>This skill is archived</span>
    </div>
  );
}

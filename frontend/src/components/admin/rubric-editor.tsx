import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Rubric, RubricCreate } from "@/types/rubric";

const dimensionSchema = z.object({
  name: z.string().min(1, "Dimension name is required"),
  weight: z.number().min(0).max(100),
  criteria: z.string(),
  max_score: z.number().min(1),
});

const rubricSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  scenario_type: z.string().optional(),
  is_default: z.boolean().optional(),
  dimensions: z.array(dimensionSchema).min(1, "At least one dimension required"),
});

type RubricFormValues = z.infer<typeof rubricSchema>;

interface RubricEditorProps {
  rubric: Rubric | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: RubricCreate) => void;
  isNew: boolean;
}

export function RubricEditor({
  rubric,
  open,
  onOpenChange,
  onSave,
  isNew,
}: RubricEditorProps) {
  const { t } = useTranslation("admin");

  const form = useForm<RubricFormValues>({
    resolver: zodResolver(rubricSchema),
    defaultValues: {
      name: "",
      description: "",
      scenario_type: "f2f",
      is_default: false,
      dimensions: [
        { name: "", weight: 100, criteria: "", max_score: 100 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "dimensions",
  });

  const watchedDimensions = form.watch("dimensions");
  const weightSum = watchedDimensions.reduce(
    (sum, d) => sum + (d.weight || 0),
    0,
  );
  const isWeightValid = weightSum === 100;

  useEffect(() => {
    if (rubric && !isNew) {
      form.reset({
        name: rubric.name,
        description: rubric.description ?? "",
        scenario_type: rubric.scenario_type ?? "f2f",
        is_default: rubric.is_default,
        dimensions: rubric.dimensions.map((d) => ({
          name: d.name,
          weight: d.weight,
          criteria: d.criteria.join(", "),
          max_score: d.max_score,
        })),
      });
    } else if (isNew) {
      form.reset({
        name: "",
        description: "",
        scenario_type: "f2f",
        is_default: false,
        dimensions: [
          { name: "", weight: 100, criteria: "", max_score: 100 },
        ],
      });
    }
  }, [rubric, isNew, form]);

  const handleSubmit = (values: RubricFormValues) => {
    const payload: RubricCreate = {
      name: values.name,
      description: values.description,
      scenario_type: values.scenario_type,
      is_default: values.is_default,
      dimensions: values.dimensions.map((d) => ({
        name: d.name,
        weight: d.weight,
        criteria: d.criteria
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        max_score: d.max_score,
      })),
    };
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? t("rubrics.createButton")
              : `Edit: ${rubric?.name ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            Configure rubric name, type, and dimension weights
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          {/* Name */}
          <div className="grid gap-2">
            <Label>{t("rubrics.name")} *</Label>
            <Input {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label>{t("rubrics.description")}</Label>
            <Textarea rows={2} {...form.register("description")} />
          </div>

          {/* Scenario Type + Default */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("rubrics.scenarioType")}</Label>
              <Controller
                control={form.control}
                name="scenario_type"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "f2f"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="f2f">
                        {t("rubrics.f2f")}
                      </SelectItem>
                      <SelectItem value="conference">
                        {t("rubrics.conference")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("rubrics.isDefault")}</Label>
              <Controller
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("rubrics.dimensions")}</Label>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    isWeightValid ? "text-green-600" : "text-red-600",
                  )}
                >
                  {t("rubrics.weightSum")}: {weightSum}/100
                </span>
              </div>
            </div>

            {!isWeightValid && (
              <p className="text-sm text-destructive">
                {t("rubrics.weightSumError")}
              </p>
            )}

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-md border p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {t("rubrics.dimensionName")} {index + 1}
                  </span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">
                      {t("rubrics.dimensionName")}
                    </Label>
                    <Input
                      {...form.register(`dimensions.${index}.name`)}
                      placeholder="e.g. Key Message Delivery"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">
                      {t("rubrics.weight")} ({watchedDimensions[index]?.weight ?? 0}%)
                    </Label>
                    <Controller
                      control={form.control}
                      name={`dimensions.${index}.weight`}
                      render={({ field: sliderField }) => (
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[sliderField.value]}
                          onValueChange={(vals) => {
                            const val = vals[0];
                            if (val !== undefined) {
                              sliderField.onChange(val);
                            }
                          }}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs">{t("rubrics.criteria")}</Label>
                  <Input
                    {...form.register(`dimensions.${index}.criteria`)}
                    placeholder="criterion 1, criterion 2, ..."
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ name: "", weight: 0, criteria: "", max_score: 100 })
              }
            >
              <Plus className="mr-1 size-4" />
              {t("rubrics.addDimension")}
            </Button>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!isWeightValid}>
              {t("rubrics.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

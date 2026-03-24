import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, MessageSquare, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Label } from "@/components/ui/label";
import { PersonalitySliders } from "./personality-sliders";
import { ObjectionList } from "./objection-list";
import type { HcpProfile, HcpProfileCreate, HcpProfileUpdate } from "@/types/hcp";

const SPECIALTIES = [
  "Oncology",
  "Hematology",
  "Immunology",
  "Neurology",
  "Cardiology",
  "Endocrinology",
  "Dermatology",
  "Gastroenterology",
  "General Practice",
];

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

const hcpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  specialty: z.string().min(1, "Specialty is required"),
  hospital: z.string().optional(),
  title: z.string().optional(),
  personality_type: z.enum(["friendly", "skeptical", "busy", "analytical", "cautious"]),
  emotional_state: z.number().min(0).max(100),
  communication_style: z.number().min(0).max(100),
  expertise_areas: z.array(z.string()),
  prescribing_habits: z.string().optional(),
  concerns: z.string().optional(),
  objections: z.array(z.string()),
  probe_topics: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

type HcpFormValues = z.infer<typeof hcpSchema>;

interface HcpEditorProps {
  profile: HcpProfile | null;
  onSave: (data: HcpProfileCreate | HcpProfileUpdate) => void;
  onTestChat: () => void;
  onDiscard: () => void;
  isNew: boolean;
}

export function HcpEditor({
  profile,
  onSave,
  onTestChat,
  onDiscard,
  isNew,
}: HcpEditorProps) {
  const { t } = useTranslation("admin");

  const form = useForm<HcpFormValues>({
    resolver: zodResolver(hcpSchema),
    defaultValues: {
      name: "",
      specialty: "",
      hospital: "",
      title: "",
      personality_type: "friendly",
      emotional_state: 30,
      communication_style: 50,
      expertise_areas: [],
      prescribing_habits: "",
      concerns: "",
      objections: [],
      probe_topics: [],
      difficulty: "medium",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        specialty: profile.specialty,
        hospital: profile.hospital ?? "",
        title: profile.title ?? "",
        personality_type: profile.personality_type,
        emotional_state: profile.emotional_state,
        communication_style: profile.communication_style,
        expertise_areas: profile.expertise_areas,
        prescribing_habits: profile.prescribing_habits ?? "",
        concerns: profile.concerns ?? "",
        objections: profile.objections,
        probe_topics: profile.probe_topics,
        difficulty: profile.difficulty,
      });
    } else if (isNew) {
      form.reset({
        name: "",
        specialty: "",
        hospital: "",
        title: "",
        personality_type: "friendly",
        emotional_state: 30,
        communication_style: 50,
        expertise_areas: [],
        prescribing_habits: "",
        concerns: "",
        objections: [],
        probe_topics: [],
        difficulty: "medium",
      });
    }
  }, [profile, isNew, form]);

  const handleSubmit = (values: HcpFormValues) => {
    const data = {
      ...values,
      expertise_areas: values.expertise_areas.filter(Boolean),
      objections: values.objections.filter(Boolean),
      probe_topics: values.probe_topics.filter(Boolean),
    };
    onSave(data);
  };

  const watchName = form.watch("name");
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-0">
          {/* Portrait */}
          <div className="flex justify-center mb-6">
            <Avatar className="size-[120px]">
              <AvatarFallback className="bg-blue-600 text-white text-3xl font-semibold">
                {getInitials(watchName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Identity Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {t("hcp.identity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specialty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialty *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select specialty" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SPECIALTIES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hospital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hospital</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Personality Card - uses the standalone component */}
          <PersonalitySliders
            personalityType={form.watch("personality_type")}
            emotionalState={form.watch("emotional_state")}
            communicationStyle={form.watch("communication_style")}
            onPersonalityTypeChange={(v) =>
              form.setValue("personality_type", v as HcpFormValues["personality_type"])
            }
            onEmotionalStateChange={(v) => form.setValue("emotional_state", v)}
            onCommunicationStyleChange={(v) => form.setValue("communication_style", v)}
          />

          {/* Knowledge Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {t("hcp.knowledge")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>{t("hcp.expertiseAreas")}</Label>
                <Input
                  value={form.watch("expertise_areas").join(", ")}
                  onChange={(e) =>
                    form.setValue(
                      "expertise_areas",
                      e.target.value.split(",").map((s) => s.trim()),
                    )
                  }
                  placeholder="e.g., Breast Cancer, Lung Cancer, Immunotherapy"
                />
              </div>
              <FormField
                control={form.control}
                name="prescribing_habits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("hcp.prescribingHabits")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="concerns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("hcp.concerns")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Interaction Rules Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {t("hcp.interactionRules")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ObjectionList
                items={form.watch("objections")}
                onChange={(items) => form.setValue("objections", items)}
                label={t("hcp.objections")}
                addLabel={t("hcp.addObjection")}
              />
              <ObjectionList
                items={form.watch("probe_topics")}
                onChange={(items) => form.setValue("probe_topics", items)}
                label={t("hcp.probeTopics")}
                addLabel={t("hcp.addTopic")}
              />
              <div className="grid gap-2">
                <Label>Difficulty</Label>
                <div className="flex items-center gap-4">
                  {DIFFICULTIES.map((d) => (
                    <label key={d} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="difficulty"
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
            </CardContent>
          </Card>

          {/* Bottom Actions */}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="default">
              <Save className="size-4" />
              {t("hcp.save")}
            </Button>
            <Button type="button" variant="outline" onClick={onTestChat}>
              <MessageSquare className="size-4" />
              {t("hcp.testChat")}
            </Button>
            <Button type="button" variant="ghost" onClick={onDiscard}>
              <Undo2 className="size-4" />
              {t("hcp.discardChanges")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

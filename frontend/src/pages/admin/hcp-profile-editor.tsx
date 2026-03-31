import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PersonalitySliders } from "@/components/admin/personality-sliders";
import { ObjectionList } from "@/components/admin/objection-list";
import { TestChatDialog } from "@/components/admin/test-chat-dialog";
import {
  useHcpProfile,
  useCreateHcpProfile,
  useUpdateHcpProfile,
  useRetrySyncHcpProfile,
} from "@/hooks/use-hcp-profiles";
import { getAgentPortalUrl } from "@/api/hcp-profiles";
import type { HcpProfileCreate, HcpProfileUpdate } from "@/types/hcp";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  personality_type: z.enum([
    "friendly",
    "skeptical",
    "busy",
    "analytical",
    "cautious",
  ]),
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

const AGENT_STATUS_CONFIG = {
  synced: {
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    label: "Agent Synced",
  },
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    label: "Sync Pending",
  },
  failed: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    label: "Sync Failed",
  },
  none: {
    icon: AlertTriangle,
    color: "text-muted-foreground",
    bg: "bg-muted/50 border-muted",
    label: "No Agent",
  },
} as const;

export default function HcpProfileEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(["admin", "common"]);
  const isNew = !id;

  const { data: profile, isLoading: profileLoading } = useHcpProfile(id);
  const createMutation = useCreateHcpProfile();
  const updateMutation = useUpdateHcpProfile();
  const retrySyncMutation = useRetrySyncHcpProfile();

  const [testChatOpen, setTestChatOpen] = useState(false);

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
    }
  }, [profile, form]);

  const handleSubmit = (values: HcpFormValues) => {
    const data = {
      ...values,
      expertise_areas: values.expertise_areas.filter(Boolean),
      objections: values.objections.filter(Boolean),
      probe_topics: values.probe_topics.filter(Boolean),
    };

    if (isNew) {
      createMutation.mutate(data as HcpProfileCreate, {
        onSuccess: () => {
          toast.success(t("admin:hcp.save"));
          navigate("/admin/hcp-profiles");
        },
        onError: () => toast.error(t("admin:errors.hcpSaveFailed")),
      });
    } else if (id) {
      updateMutation.mutate(
        { id, data: data as HcpProfileUpdate },
        {
          onSuccess: () => {
            toast.success(t("admin:hcp.save"));
            navigate("/admin/hcp-profiles");
          },
          onError: () => toast.error(t("admin:errors.hcpSaveFailed")),
        },
      );
    }
  };

  const handleRetrySync = () => {
    if (!id) return;
    retrySyncMutation.mutate(id, {
      onSuccess: () => toast.success(t("admin:hcp.syncSuccess")),
      onError: (err) =>
        toast.error(
          t("admin:hcp.syncFailed", { error: (err as Error).message }),
        ),
    });
  };

  const watchName = form.watch("name");
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  if (!isNew && profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const agentStatus = profile?.agent_sync_status ?? "none";
  const statusConfig = AGENT_STATUS_CONFIG[agentStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/hcp-profiles")}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isNew
              ? t("admin:hcp.createButton")
              : `${t("admin:hcp.save")} - ${profile?.name ?? ""}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && profile && (
            <Button
              variant="outline"
              onClick={() => setTestChatOpen(true)}
            >
              <MessageSquare className="size-4 mr-2" />
              {t("admin:hcp.testChat")}
            </Button>
          )}
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="size-4 mr-2" />
            {createMutation.isPending || updateMutation.isPending
              ? t("common:saving")
              : t("admin:hcp.save")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Main form (2 cols) */}
        <div className="col-span-2 space-y-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {/* Identity Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("admin:hcp.identity")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-6">
                    <Avatar className="size-20 shrink-0">
                      <AvatarFallback className="bg-blue-600 text-white text-2xl font-semibold">
                        {getInitials(watchName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid grid-cols-2 gap-4 flex-1">
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
                  </div>
                </CardContent>
              </Card>

              {/* Personality Card */}
              <PersonalitySliders
                personalityType={form.watch("personality_type")}
                emotionalState={form.watch("emotional_state")}
                communicationStyle={form.watch("communication_style")}
                onPersonalityTypeChange={(v) =>
                  form.setValue(
                    "personality_type",
                    v as HcpFormValues["personality_type"],
                  )
                }
                onEmotionalStateChange={(v) =>
                  form.setValue("emotional_state", v)
                }
                onCommunicationStyleChange={(v) =>
                  form.setValue("communication_style", v)
                }
              />

              {/* Knowledge Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("admin:hcp.knowledge")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>{t("admin:hcp.expertiseAreas")}</Label>
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
                        <FormLabel>
                          {t("admin:hcp.prescribingHabits")}
                        </FormLabel>
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
                        <FormLabel>{t("admin:hcp.concerns")}</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Interaction Rules Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("admin:hcp.interactionRules")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ObjectionList
                    items={form.watch("objections")}
                    onChange={(items) => form.setValue("objections", items)}
                    label={t("admin:hcp.objections")}
                    addLabel={t("admin:hcp.addObjection")}
                  />
                  <ObjectionList
                    items={form.watch("probe_topics")}
                    onChange={(items) => form.setValue("probe_topics", items)}
                    label={t("admin:hcp.probeTopics")}
                    addLabel={t("admin:hcp.addTopic")}
                  />
                  <div className="grid gap-2">
                    <Label>Difficulty</Label>
                    <div className="flex items-center gap-4">
                      {DIFFICULTIES.map((d) => (
                        <label
                          key={d}
                          className="flex items-center gap-2 cursor-pointer"
                        >
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
            </form>
          </Form>
        </div>

        {/* Right sidebar: Agent info (1 col) */}
        <div className="space-y-6">
          {/* Agent Status Card */}
          <Card className={cn("border", statusConfig.bg)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bot className="size-5" />
                AI Foundry Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("size-5", statusConfig.color)} />
                <span className={cn("text-sm font-medium", statusConfig.color)}>
                  {statusConfig.label}
                </span>
              </div>

              {/* Agent ID */}
              {profile?.agent_id && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Agent ID
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm font-mono bg-background/80 rounded px-2 py-1 truncate border">
                        {profile.agent_id}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>{profile.agent_id}</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Error message */}
              {agentStatus === "failed" && profile?.agent_sync_error && (
                <div className="space-y-1">
                  <Label className="text-xs text-red-600">Error</Label>
                  <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 border border-red-200 max-h-24 overflow-y-auto">
                    {profile.agent_sync_error}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                {(agentStatus === "failed" || agentStatus === "none") && !isNew && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetrySync}
                    disabled={retrySyncMutation.isPending}
                    className="w-full"
                  >
                    <RefreshCw
                      className={cn(
                        "size-4 mr-2",
                        retrySyncMutation.isPending && "animate-spin",
                      )}
                    />
                    {retrySyncMutation.isPending
                      ? "Syncing..."
                      : t("admin:hcp.retrySync")}
                  </Button>
                )}
                {profile?.agent_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={async () => {
                      try {
                        const result = await getAgentPortalUrl(profile.id);
                        window.open(result.url, "_blank", "noopener,noreferrer");
                      } catch {
                        window.open("https://ai.azure.com", "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    <ExternalLink className="size-3.5 mr-1.5" />
                    View in Azure Portal
                  </Button>
                )}
              </div>

              {/* Info for new profiles */}
              {isNew && (
                <p className="text-xs text-muted-foreground">
                  An AI Foundry Agent will be automatically created when you save
                  this profile. The agent will use the profile data as its
                  instructions.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timestamps */}
          {!isNew && profile && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Created
                  </Label>
                  <p className="text-sm">
                    {new Date(profile.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Last Updated
                  </Label>
                  <p className="text-sm">
                    {new Date(profile.updated_at).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Test Chat Dialog */}
      {!isNew && profile && (
        <TestChatDialog
          profileId={profile.id}
          profileName={profile.name}
          personalityType={profile.personality_type}
          agentId={profile.agent_id}
          agentVersion={profile.agent_version}
          open={testChatOpen}
          onOpenChange={setTestChatOpen}
        />
      )}
    </div>
  );
}

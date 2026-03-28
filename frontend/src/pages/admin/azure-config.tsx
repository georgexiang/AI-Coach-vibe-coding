import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  Mic,
  Volume2,
  User,
  FileSearch,
  Loader2,
  Phone,
  Server,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Check,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useServiceConfigs,
  useUpdateServiceConfig,
  useTestServiceConnection,
  useAIFoundryConfig,
  useUpdateAIFoundry,
} from "@/hooks/use-azure-config";
import { useRegionCapabilities } from "@/hooks/use-region-capabilities";
import type { RegionStatus } from "@/types/azure-config";

interface AzureServiceDef {
  key: string;
  backendKey: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  modelPlaceholder: string;
}

const AZURE_SERVICES: AzureServiceDef[] = [
  {
    key: "openai",
    backendKey: "azure_openai",
    name: "Azure OpenAI",
    description: "GPT-4o for AI coaching conversations and scoring",
    icon: <Brain className="size-5 text-primary" />,
    modelPlaceholder: "gpt-4o",
  },
  {
    key: "speechStt",
    backendKey: "azure_speech_stt",
    name: "Azure Speech (STT)",
    description: "Speech-to-text for voice input recognition",
    icon: <Mic className="size-5 text-primary" />,
    modelPlaceholder: "",
  },
  {
    key: "speechTts",
    backendKey: "azure_speech_tts",
    name: "Azure Speech (TTS)",
    description: "Text-to-speech for HCP voice responses",
    icon: <Volume2 className="size-5 text-primary" />,
    modelPlaceholder: "",
  },
  {
    key: "avatar",
    backendKey: "azure_avatar",
    name: "Azure AI Avatar",
    description: "Digital human avatar for HCP visualization",
    icon: <User className="size-5 text-primary" />,
    modelPlaceholder: "Lisa-casual-sitting",
  },
  {
    key: "contentUnderstanding",
    backendKey: "azure_content",
    name: "Azure Content Understanding",
    description: "Multimodal evaluation for training materials",
    icon: <FileSearch className="size-5 text-primary" />,
    modelPlaceholder: "",
  },
  {
    key: "realtime",
    backendKey: "azure_openai_realtime",
    name: "Azure OpenAI Realtime",
    description: "Real-time audio streaming for voice conversations",
    icon: <Mic className="size-5 text-primary" />,
    modelPlaceholder: "gpt-4o-realtime-preview",
  },
  {
    key: "voiceLive",
    backendKey: "azure_voice_live",
    name: "Azure Voice Live API",
    description: "Real-time voice coaching with GPT-4o Realtime",
    icon: <Phone className="size-5 text-primary" />,
    modelPlaceholder: "gpt-4o-realtime-preview",
  },
];

export default function AzureConfigPage() {
  const { t } = useTranslation("admin");
  const { data: savedConfigs, isLoading: configsLoading } = useServiceConfigs();
  const { data: aiFoundryData, isLoading: foundryLoading } = useAIFoundryConfig();
  const updateServiceMutation = useUpdateServiceConfig();
  const testMutation = useTestServiceConnection();
  const updateFoundryMutation = useUpdateAIFoundry();

  // AI Foundry form state
  const [aiFoundryEndpoint, setAiFoundryEndpoint] = useState("");
  const [aiFoundryRegion, setAiFoundryRegion] = useState("");
  const [aiFoundryApiKey, setAiFoundryApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // Initialize AI Foundry form from loaded data
  useEffect(() => {
    if (aiFoundryData) {
      setAiFoundryEndpoint(aiFoundryData.endpoint || "");
      setAiFoundryRegion(aiFoundryData.region || "");
    }
  }, [aiFoundryData]);

  // Per-service expanded state
  const [expandedService, setExpandedService] = useState<string | null>(null);

  // Test all state
  const [testingAll, setTestingAll] = useState(false);

  // Region capabilities
  const regionForCaps = aiFoundryRegion || savedConfigs?.find((c) => c.region)?.region;
  const { data: regionCaps, isError: regionCapsError } = useRegionCapabilities(regionForCaps);

  const getRegionStatus = (backendKey: string): RegionStatus | undefined => {
    if (!regionForCaps) return undefined;
    if (regionCapsError) return "unknown";
    if (!regionCaps) return undefined;
    const svc = regionCaps.services[backendKey];
    if (!svc) return "unknown";
    return svc.available ? "available" : "unavailable";
  };

  const getSavedConfig = (backendKey: string) => {
    return savedConfigs?.find((c) => c.service_name === backendKey);
  };

  const handleSaveFoundry = () => {
    updateFoundryMutation.mutate(
      {
        endpoint: aiFoundryEndpoint,
        region: aiFoundryRegion,
        api_key: aiFoundryApiKey,
      },
      {
        onSuccess: () => {
          toast.success(t("azureConfig.saved", { defaultValue: "AI Foundry configuration saved" }));
          setAiFoundryApiKey("");
        },
        onError: () => toast.error(t("azureConfig.saveFailed", { defaultValue: "Failed to save configuration" })),
      },
    );
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      const configuredServices = savedConfigs?.filter((c) => c.is_active && c.endpoint) ?? [];
      for (const svc of configuredServices) {
        try {
          const result = await testMutation.mutateAsync(svc.service_name);
          if (result.success) {
            toast.success(`${svc.display_name}: ${result.message}`);
          } else {
            toast.error(`${svc.display_name}: ${result.message}`);
          }
        } catch {
          toast.error(`${svc.display_name}: Connection failed`);
        }
      }
    } finally {
      setTestingAll(false);
    }
  };

  const handleToggleService = (backendKey: string, enabled: boolean) => {
    const existing = getSavedConfig(backendKey);
    updateServiceMutation.mutate({
      serviceName: backendKey,
      config: {
        endpoint: existing?.endpoint ?? "",
        api_key: "",
        model_or_deployment: existing?.model_or_deployment ?? "",
        region: existing?.region ?? "",
      },
    });
    // Optimistic: the mutation invalidation will refresh the query
    // For the toggle specifically, we just need the save to go through
    void enabled; // eslint: used for intent
  };

  const handleSaveServiceModel = (backendKey: string, modelValue: string) => {
    const existing = getSavedConfig(backendKey);
    updateServiceMutation.mutate(
      {
        serviceName: backendKey,
        config: {
          endpoint: existing?.endpoint ?? "",
          api_key: "",
          model_or_deployment: modelValue,
          region: existing?.region ?? "",
        },
      },
      {
        onSuccess: () => toast.success(t("azureConfig.saved", { defaultValue: "Configuration saved" })),
        onError: () => toast.error(t("azureConfig.saveFailed", { defaultValue: "Failed to save configuration" })),
      },
    );
  };

  const handleTestService = async (backendKey: string) => {
    try {
      const result = await testMutation.mutateAsync(backendKey);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error(t("azureConfig.connectionFailed"));
    }
  };

  if (configsLoading || foundryLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t("azureConfig.title")}</h1>
        <Button variant="outline" onClick={handleTestAll} disabled={testingAll}>
          {testingAll && <Loader2 className="size-4 animate-spin" />}
          {t("azureConfig.testAll", { defaultValue: "Test All Services" })}
        </Button>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Section 1: AI Foundry Master Config Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Server className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("azureConfig.aiFoundry.title")}</CardTitle>
                <CardDescription>{t("azureConfig.aiFoundry.description")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("azureConfig.aiFoundry.endpoint")}</Label>
                <Input
                  value={aiFoundryEndpoint}
                  onChange={(e) => setAiFoundryEndpoint(e.target.value)}
                  placeholder={t("azureConfig.aiFoundry.endpointPlaceholder")}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t("azureConfig.aiFoundry.region")}</Label>
                <Input
                  value={aiFoundryRegion}
                  onChange={(e) => setAiFoundryRegion(e.target.value)}
                  placeholder={t("azureConfig.aiFoundry.regionPlaceholder")}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("azureConfig.aiFoundry.apiKey")}</Label>
              <div className="relative max-w-md">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={aiFoundryApiKey}
                  onChange={(e) => setAiFoundryApiKey(e.target.value)}
                  placeholder={t("azureConfig.aiFoundry.apiKeyPlaceholder")}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey((v) => !v)}
                  tabIndex={-1}
                >
                  {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {aiFoundryData?.masked_key && (
                <p className="text-xs text-muted-foreground">
                  Current: {aiFoundryData.masked_key}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("azureConfig.aiFoundry.apiKeyHint")}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSaveFoundry}
                disabled={updateFoundryMutation.isPending}
              >
                {updateFoundryMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t("azureConfig.saveConfig")}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestAll}
                disabled={testingAll}
              >
                {testingAll && <Loader2 className="size-4 animate-spin" />}
                {t("azureConfig.testAll", { defaultValue: "Test All Services" })}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Per-Service Toggle List */}
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t("azureConfig.services.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("azureConfig.services.description")}</p>
          </div>

          <div className="space-y-2">
            {AZURE_SERVICES.map((svc) => {
              const saved = getSavedConfig(svc.backendKey);
              const isActive = saved?.is_active ?? false;
              const isExpanded = expandedService === svc.key;
              const regionStatus = getRegionStatus(svc.backendKey);

              return (
                <Card key={svc.key} className="overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-3 text-left"
                      onClick={() => setExpandedService(isExpanded ? null : svc.key)}
                    >
                      <div className="flex size-9 items-center justify-center rounded-md bg-primary/10">
                        {svc.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{svc.name}</span>
                          {regionStatus && (
                            <RegionBadge status={regionStatus} region={regionForCaps ?? ""} t={t} />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{svc.description}</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    <div className="ml-3 shrink-0">
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) => handleToggleService(svc.backendKey, checked)}
                        aria-label={`Enable ${svc.name}`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <ServiceExpandedContent
                      svc={svc}
                      saved={saved}
                      onSaveModel={handleSaveServiceModel}
                      onTest={handleTestService}
                      testMutation={testMutation}
                      t={t}
                    />
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Region availability badge. */
function RegionBadge({
  status,
  region,
  t,
}: {
  status: RegionStatus;
  region: string;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  if (status === "available") {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1 rounded-sm border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700"
      >
        <Check className="size-2.5" aria-hidden="true" />
        {t("azureConfig.regionAvailable", { region })}
      </span>
    );
  }
  if (status === "unavailable") {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1 rounded-sm border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700"
      >
        <X className="size-2.5" aria-hidden="true" />
        {t("azureConfig.regionUnavailable", { region })}
      </span>
    );
  }
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1 rounded-sm border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
    >
      <Info className="size-2.5" aria-hidden="true" />
      {t("azureConfig.regionUnknown")}
    </span>
  );
}

/** Expanded row content for a per-service toggle. */
function ServiceExpandedContent({
  svc,
  saved,
  onSaveModel,
  onTest,
  testMutation,
  t,
}: {
  svc: AzureServiceDef;
  saved: { model_or_deployment?: string } | undefined;
  onSaveModel: (backendKey: string, modelValue: string) => void;
  onTest: (backendKey: string) => Promise<void>;
  testMutation: { isPending: boolean };
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const [modelValue, setModelValue] = useState(saved?.model_or_deployment ?? "");

  return (
    <div className="border-t px-4 py-3 space-y-3 bg-muted/30">
      {svc.modelPlaceholder && (
        <div className="grid gap-2 max-w-sm">
          <Label className="text-xs">{t("azureConfig.model")}</Label>
          <Input
            value={modelValue}
            onChange={(e) => setModelValue(e.target.value)}
            placeholder={svc.modelPlaceholder}
            className="h-8 text-sm"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={() => onSaveModel(svc.backendKey, modelValue)}
        >
          {t("azureConfig.saveConfig")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onTest(svc.backendKey)}
          disabled={testMutation.isPending}
        >
          {testMutation.isPending && <Loader2 className="size-3 animate-spin" />}
          {t("azureConfig.testConnection")}
        </Button>
      </div>
    </div>
  );
}

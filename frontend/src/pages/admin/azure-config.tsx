import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  Database,
  Mic,
  Volume2,
  User,
  FileSearch,
  Loader2,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ServiceConfigCard } from "@/components/admin/service-config-card";
import {
  useServiceConfigs,
  useUpdateServiceConfig,
  useTestServiceConnection,
} from "@/hooks/use-azure-config";
import type { ServiceConfigUpdate } from "@/types/azure-config";

interface AzureServiceDef {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const SERVICE_KEY_MAP: Record<string, string> = {
  openai: "azure_openai",
  speechStt: "azure_speech_stt",
  speechTts: "azure_speech_tts",
  avatar: "azure_avatar",
  contentUnderstanding: "azure_content",
  realtime: "azure_openai_realtime",
  voiceLive: "azure_voice_live",
  database: "azure_database",
};

const AZURE_SERVICES: AzureServiceDef[] = [
  {
    key: "openai",
    name: "Azure OpenAI",
    description: "GPT-4o for AI coaching conversations and scoring",
    icon: <Brain className="size-6 text-primary" />,
  },
  {
    key: "speechStt",
    name: "Azure Speech (STT)",
    description: "Speech-to-text for voice input recognition",
    icon: <Mic className="size-6 text-primary" />,
  },
  {
    key: "speechTts",
    name: "Azure Speech (TTS)",
    description: "Text-to-speech for HCP voice responses",
    icon: <Volume2 className="size-6 text-primary" />,
  },
  {
    key: "avatar",
    name: "Azure AI Avatar",
    description: "Digital human avatar for HCP visualization",
    icon: <User className="size-6 text-primary" />,
  },
  {
    key: "contentUnderstanding",
    name: "Azure Content Understanding",
    description: "Multimodal evaluation for training materials",
    icon: <FileSearch className="size-6 text-primary" />,
  },
  {
    key: "realtime",
    name: "Azure OpenAI Realtime",
    description: "Real-time audio streaming for voice conversations",
    icon: <Mic className="size-6 text-primary" />,
  },
  {
    key: "voiceLive",
    name: "Azure Voice Live API",
    description: "Real-time voice coaching with GPT-4o Realtime",
    icon: <Phone className="size-6 text-primary" />,
  },
  {
    key: "database",
    name: "Azure Database for PostgreSQL",
    description: "Managed PostgreSQL database for production data",
    icon: <Database className="size-6 text-primary" />,
  },
];

export default function AzureConfigPage() {
  const { t } = useTranslation("admin");
  const { data: savedConfigs, isLoading } = useServiceConfigs();
  const updateMutation = useUpdateServiceConfig();
  const testMutation = useTestServiceConnection();

  const getSavedConfig = (frontendKey: string) => {
    const backendKey = SERVICE_KEY_MAP[frontendKey];
    return savedConfigs?.find((c) => c.service_name === backendKey);
  };

  const handleSave = (serviceName: string, config: ServiceConfigUpdate) => {
    updateMutation.mutate(
      { serviceName, config },
      {
        onSuccess: () => toast.success(t("azureConfig.saved", { defaultValue: "Configuration saved" })),
        onError: () => toast.error(t("azureConfig.saveFailed", { defaultValue: "Failed to save configuration" })),
      },
    );
  };

  const handleTestConnection = async (serviceName: string) => {
    return testMutation.mutateAsync(serviceName);
  };

  const [testingAll, setTestingAll] = useState(false);

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      const configuredServices = savedConfigs?.filter((c) => c.endpoint) ?? [];
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

  if (isLoading) {
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
          {t("azureConfig.testAll", { defaultValue: "Test All Connections" })}
        </Button>
      </div>
      <div className="space-y-4 max-w-4xl">
        {AZURE_SERVICES.map((svc) => (
          <div key={svc.key}>
            <ServiceConfigCard
              service={{
                key: SERVICE_KEY_MAP[svc.key] ?? svc.key,
                name: svc.name,
                description: svc.description,
                icon: svc.icon,
              }}
              savedConfig={getSavedConfig(svc.key)}
              onSave={handleSave}
              onTestConnection={handleTestConnection}
            />
            {svc.key === "voiceLive" && (() => {
              const savedConfig = getSavedConfig("voiceLive");
              const region = savedConfig?.region ?? "";
              const isUnsupported = region !== "" && region !== "eastus2" && region !== "swedencentral";
              return isUnsupported ? (
                <div className="mt-2 rounded-md bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
                  {t("voiceLive.regionWarning")}
                </div>
              ) : null;
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

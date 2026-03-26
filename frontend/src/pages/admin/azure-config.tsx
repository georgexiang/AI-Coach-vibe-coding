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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceConfigCard } from "@/components/admin/service-config-card";

interface AzureService {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  defaultConfig: {
    endpoint: string;
    apiKey: string;
    model: string;
    region: string;
  };
}

const AZURE_SERVICES: AzureService[] = [
  {
    key: "openai",
    name: "Azure OpenAI",
    description: "GPT-4o for AI coaching conversations and scoring",
    icon: <Brain className="size-6 text-primary" />,
    defaultConfig: { endpoint: "", apiKey: "", model: "gpt-4o", region: "eastus" },
  },
  {
    key: "speechStt",
    name: "Azure Speech (STT)",
    description: "Speech-to-text for voice input recognition",
    icon: <Mic className="size-6 text-primary" />,
    defaultConfig: { endpoint: "", apiKey: "", model: "", region: "eastus" },
  },
  {
    key: "speechTts",
    name: "Azure Speech (TTS)",
    description: "Text-to-speech for HCP voice responses",
    icon: <Volume2 className="size-6 text-primary" />,
    defaultConfig: { endpoint: "", apiKey: "", model: "", region: "eastus" },
  },
  {
    key: "avatar",
    name: "Azure AI Avatar",
    description: "Digital human avatar for HCP visualization",
    icon: <User className="size-6 text-primary" />,
    defaultConfig: { endpoint: "", apiKey: "", model: "", region: "eastus" },
  },
  {
    key: "contentUnderstanding",
    name: "Azure Content Understanding",
    description: "Multimodal evaluation for training materials",
    icon: <FileSearch className="size-6 text-primary" />,
    defaultConfig: { endpoint: "", apiKey: "", model: "", region: "eastus" },
  },
  {
    key: "realtime",
    name: "Azure OpenAI Realtime",
    description: "Real-time audio streaming for voice conversations",
    icon: <Mic className="size-6 text-primary" />,
    defaultConfig: { endpoint: "", apiKey: "", model: "", region: "eastus" },
  },
  {
    key: "database",
    name: "Azure Database for PostgreSQL",
    description: "Managed PostgreSQL database for production data",
    icon: <Database className="size-6 text-primary" />,
    defaultConfig: { endpoint: "", apiKey: "", model: "", region: "eastus" },
  },
];

export default function AzureConfigPage() {
  const { t } = useTranslation("admin");

  const [configs, setConfigs] = useState<Record<string, { endpoint: string; apiKey: string; model: string; region: string }>>(
    () => {
      const initial: Record<string, { endpoint: string; apiKey: string; model: string; region: string }> = {};
      for (const svc of AZURE_SERVICES) {
        initial[svc.key] = { ...svc.defaultConfig };
      }
      return initial;
    },
  );

  const handleSave = (key: string, config: { endpoint: string; apiKey: string; model: string; region: string }) => {
    setConfigs((prev) => ({ ...prev, [key]: config }));
  };

  const handleTestConnection = async (): Promise<boolean> => {
    // MVP stub: simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return Math.random() > 0.3; // 70% success for demo
  };

  const [testingAll, setTestingAll] = useState(false);

  const handleTestAll = async () => {
    setTestingAll(true);
    await handleTestConnection();
    setTestingAll(false);
  };

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
          <ServiceConfigCard
            key={svc.key}
            service={{
              name: svc.name,
              description: svc.description,
              icon: svc.icon,
              status: "inactive",
            }}
            config={configs[svc.key] ?? svc.defaultConfig}
            onSave={(config) => handleSave(svc.key, config)}
            onTestConnection={handleTestConnection}
          />
        ))}
      </div>
    </div>
  );
}

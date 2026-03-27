import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Info, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  ServiceConfigResponse,
  ServiceConfigUpdate,
  ConnectionTestResult,
  RegionStatus,
} from "@/types/azure-config";
import { parseVoiceLiveMode, encodeVoiceLiveMode } from "@/types/azure-config";

type ServiceStatus = "inactive" | "active" | "error" | "testing" | "unavailable";

interface ServiceInfo {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface ServiceConfigCardProps {
  service: ServiceInfo;
  savedConfig?: ServiceConfigResponse;
  onSave: (serviceName: string, config: ServiceConfigUpdate) => void;
  onTestConnection: (serviceName: string) => Promise<ConnectionTestResult>;
  regionStatus?: RegionStatus;
}

const STATUS_DOT: Record<ServiceStatus, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-400",
  error: "bg-red-500",
  testing: "bg-yellow-500 animate-pulse",
  unavailable: "bg-purple-600",
};

const STATUS_LABEL: Record<ServiceStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  error: "Error",
  testing: "Testing...",
  unavailable: "Unavailable",
};

export function ServiceConfigCard({
  service,
  savedConfig,
  onSave,
  onTestConnection,
  regionStatus,
}: ServiceConfigCardProps) {
  const { t } = useTranslation("admin");
  const [expanded, setExpanded] = useState(false);
  const [localConfig, setLocalConfig] = useState({
    endpoint: savedConfig?.endpoint ?? "",
    apiKey: "",
    model: savedConfig?.model_or_deployment ?? "",
    region: savedConfig?.region ?? "",
  });
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<ServiceStatus>(
    savedConfig?.is_active ? "active" : "inactive",
  );
  const [showApiKey, setShowApiKey] = useState(false);

  // Voice Live mode state
  const parsedVoiceLive = parseVoiceLiveMode(savedConfig?.model_or_deployment ?? "");
  const [voiceLiveMode, setVoiceLiveMode] = useState<"model" | "agent">(parsedVoiceLive.mode);
  const [agentId, setAgentId] = useState(
    parsedVoiceLive.mode === "agent" ? parsedVoiceLive.agent_id : "",
  );
  const [projectName, setProjectName] = useState(
    parsedVoiceLive.mode === "agent" ? parsedVoiceLive.project_name : "",
  );

  const handleTest = async () => {
    setTesting(true);
    setStatus("testing");
    try {
      const result = await onTestConnection(service.key);
      if (result.success) {
        setStatus("active");
        toast.success(result.message);
      } else {
        setStatus("error");
        toast.error(result.message);
      }
    } catch {
      setStatus("error");
      toast.error(t("azureConfig.connectionFailed"));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    let modelValue = localConfig.model;
    if (service.key === "azure_voice_live") {
      if (voiceLiveMode === "agent") {
        if (!agentId.trim() || !projectName.trim()) {
          toast.error(t("voiceLive.agentIdRequired"));
          return;
        }
        modelValue = encodeVoiceLiveMode({
          mode: "agent",
          agent_id: agentId.trim(),
          project_name: projectName.trim(),
        });
      } else {
        modelValue = encodeVoiceLiveMode({
          mode: "model",
          model: localConfig.model,
        });
      }
    }
    onSave(service.key, {
      endpoint: localConfig.endpoint,
      api_key: localConfig.apiKey,
      model_or_deployment: modelValue,
      region: localConfig.region,
    });
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
            {service.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">{service.name}</h3>
              <span
                className={cn("size-2 rounded-full shrink-0", STATUS_DOT[status])}
              />
              <span className="sr-only">{STATUS_LABEL[status]}</span>
            </div>
            <p className="text-sm text-muted-foreground">{service.description}</p>
            {regionStatus && savedConfig?.region && (
              <div className="mt-1">
                {regionStatus === "available" && (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1 rounded-sm border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                  >
                    <Check className="size-3" aria-hidden="true" />
                    {t("azureConfig.regionAvailable", { region: savedConfig.region })}
                  </span>
                )}
                {regionStatus === "unavailable" && (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1 rounded-sm border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700"
                  >
                    <X className="size-3" aria-hidden="true" />
                    {t("azureConfig.regionUnavailable", { region: savedConfig.region })}
                  </span>
                )}
                {regionStatus === "unknown" && (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1 rounded-sm border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600"
                  >
                    <Info className="size-3" aria-hidden="true" />
                    {t("azureConfig.regionUnknown")}
                  </span>
                )}
              </div>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="size-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {service.key === "azure_voice_live" && (
            <div className="mb-4 rounded-lg border p-4">
              <div
                role="radiogroup"
                aria-label={t("voiceLive.modeLabel")}
              >
                <p className="mb-3 text-sm font-medium">{t("voiceLive.modeLabel")}</p>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name={`voiceLiveMode-${service.key}`}
                      checked={voiceLiveMode === "model"}
                      onChange={() => setVoiceLiveMode("model")}
                      className="mt-1"
                      aria-describedby="model-mode-desc"
                    />
                    <div>
                      <p className="text-sm font-medium">{t("voiceLive.modelMode")}</p>
                      <p id="model-mode-desc" className="text-xs text-muted-foreground">{t("voiceLive.modelModeDesc")}</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="radio"
                      name={`voiceLiveMode-${service.key}`}
                      checked={voiceLiveMode === "agent"}
                      onChange={() => setVoiceLiveMode("agent")}
                      className="mt-1"
                      aria-describedby="agent-mode-desc"
                    />
                    <div>
                      <p className="text-sm font-medium">{t("voiceLive.agentMode")}</p>
                      <p id="agent-mode-desc" className="text-xs text-muted-foreground">{t("voiceLive.agentModeDesc")}</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("azureConfig.endpoint")}</Label>
              <Input
                value={localConfig.endpoint}
                onChange={(e) =>
                  setLocalConfig((c) => ({ ...c, endpoint: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("azureConfig.apiKey")}</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={localConfig.apiKey}
                  onChange={(e) =>
                    setLocalConfig((c) => ({ ...c, apiKey: e.target.value }))
                  }
                  placeholder="Enter API key"
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
              {savedConfig?.masked_key && (
                <p className="text-xs text-muted-foreground">
                  Current key: {savedConfig.masked_key}
                </p>
              )}
            </div>
            {!(service.key === "azure_voice_live" && voiceLiveMode === "agent") && (
              <div className="grid gap-2">
                <Label>{t("azureConfig.model")}</Label>
                <Input
                  value={localConfig.model}
                  onChange={(e) =>
                    setLocalConfig((c) => ({ ...c, model: e.target.value }))
                  }
                  placeholder="gpt-4o"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>{t("azureConfig.region")}</Label>
              <Input
                value={localConfig.region}
                onChange={(e) =>
                  setLocalConfig((c) => ({ ...c, region: e.target.value }))
                }
                placeholder="eastus"
              />
            </div>
          </div>

          {service.key === "azure_voice_live" && voiceLiveMode === "agent" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("voiceLive.agentId")}</Label>
                <Input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder={t("voiceLive.agentIdPlaceholder")}
                  required
                />
                {voiceLiveMode === "agent" && !agentId.trim() && (
                  <p className="text-xs text-destructive">{t("voiceLive.agentIdRequired")}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>{t("voiceLive.projectName")}</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder={t("voiceLive.projectPlaceholder")}
                  required
                />
                {voiceLiveMode === "agent" && !projectName.trim() && (
                  <p className="text-xs text-destructive">{t("voiceLive.projectNameRequired")}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button variant="default" onClick={handleSave}>
              {t("azureConfig.saveConfig")}
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing && <Loader2 className="size-4 animate-spin" />}
              {t("azureConfig.testConnection")}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

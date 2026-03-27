import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from "lucide-react";
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
} from "@/types/azure-config";

type ServiceStatus = "inactive" | "active" | "error" | "testing";

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
}

const STATUS_DOT: Record<ServiceStatus, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-400",
  error: "bg-red-500",
  testing: "bg-yellow-500 animate-pulse",
};

export function ServiceConfigCard({
  service,
  savedConfig,
  onSave,
  onTestConnection,
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
    onSave(service.key, {
      endpoint: localConfig.endpoint,
      api_key: localConfig.apiKey,
      model_or_deployment: localConfig.model,
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
            </div>
            <p className="text-sm text-muted-foreground">{service.description}</p>
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

          <div className="flex items-center gap-3">
            <Button variant="default" onClick={handleSave}>
              Save
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

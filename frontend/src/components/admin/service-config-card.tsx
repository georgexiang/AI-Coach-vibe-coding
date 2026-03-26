import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ServiceStatus = "inactive" | "active" | "error" | "testing";

interface ServiceInfo {
  name: string;
  description: string;
  icon: React.ReactNode;
  status: ServiceStatus;
}

interface ServiceConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  region: string;
}

interface ServiceConfigCardProps {
  service: ServiceInfo;
  config: ServiceConfig;
  onSave: (config: ServiceConfig) => void;
  onTestConnection: () => Promise<boolean>;
}

const STATUS_DOT: Record<ServiceStatus, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-400",
  error: "bg-red-500",
  testing: "bg-yellow-500 animate-pulse",
};

export function ServiceConfigCard({
  service,
  config,
  onSave,
  onTestConnection,
}: ServiceConfigCardProps) {
  const { t } = useTranslation("admin");
  const [expanded, setExpanded] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<ServiceStatus>(service.status);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setStatus("testing");
    try {
      const success = await onTestConnection();
      if (success) {
        setStatus("active");
        toast.success(t("azureConfig.connectionSuccess"));
      } else {
        setStatus("error");
        toast.error(t("azureConfig.connectionFailed"));
      }
    } catch {
      setStatus("error");
      toast.error(t("azureConfig.connectionFailed"));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave(localConfig);
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

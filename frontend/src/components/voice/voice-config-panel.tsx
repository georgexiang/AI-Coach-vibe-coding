import { useTranslation } from "react-i18next";
import { Globe, Volume2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import {
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Label,
  Separator,
  Badge,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { VoiceConfigSettings } from "@/types/voice-live";

/** Supported language options for speech input. */
const LANGUAGE_OPTIONS = [
  "auto",
  "zh-CN",
  "en-US",
  "en-GB",
  "ja-JP",
  "ko-KR",
  "de-DE",
  "fr-FR",
  "es-ES",
  "it-IT",
  "pt-BR",
] as const;

interface VoiceConfigPanelProps {
  config: VoiceConfigSettings;
  onConfigChange: (config: VoiceConfigSettings) => void;
  voiceName: string;
  avatarEnabled: boolean;
  className?: string;
}

/**
 * Voice configuration panel for runtime voice settings.
 * Mirrors AI Foundry's right-side Configuration panel layout:
 * - Speech input: language selector + auto-detect toggle
 * - Speech output: voice name display (read-only, from HCP profile)
 * - Interim response toggle
 * - Proactive engagement toggle
 * - Avatar status indicator
 */
export function VoiceConfigPanel({
  config,
  onConfigChange,
  voiceName,
  avatarEnabled,
  className,
}: VoiceConfigPanelProps) {
  const { t } = useTranslation("voice");
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const handleLanguageChange = (value: string) => {
    onConfigChange({
      ...config,
      language: value,
      autoDetect: value === "auto",
    });
  };

  const handleAutoDetectChange = (checked: boolean) => {
    onConfigChange({
      ...config,
      autoDetect: checked,
      language: checked ? "auto" : config.language === "auto" ? "zh-CN" : config.language,
    });
  };

  const handleInterimResponseChange = (checked: boolean) => {
    onConfigChange({ ...config, interimResponse: checked });
  };

  const handleProactiveEngagementChange = (checked: boolean) => {
    onConfigChange({ ...config, proactiveEngagement: checked });
  };

  return (
    <ScrollArea className={cn("h-full", className)} data-testid="voice-config-panel">
      <div className="flex flex-col gap-0 p-4">
        {/* Speech Input Section */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("config.speechInput")}
            </h3>
          </div>

          {/* Language selector */}
          <div className="mb-3">
            <Label htmlFor="voice-language" className="mb-1.5 block text-xs text-muted-foreground">
              {t("config.language")}
            </Label>
            <Select
              value={config.language}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger id="voice-language" className="w-full" data-testid="language-select">
                <SelectValue placeholder={t("config.selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {t(`config.languages.${lang}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-detect toggle */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <Label
                htmlFor="auto-detect"
                className="text-sm text-foreground"
              >
                {t("config.autoDetect")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("config.autoDetectDesc")}
              </p>
            </div>
            <Switch
              id="auto-detect"
              checked={config.autoDetect}
              onCheckedChange={handleAutoDetectChange}
              data-testid="auto-detect-switch"
            />
          </div>

          {/* Advanced settings (expandable) */}
          <button
            type="button"
            className="mb-1 flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setInputExpanded((prev) => !prev)}
            data-testid="input-advanced-toggle"
          >
            {inputExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            <span>Advanced settings</span>
          </button>
          {inputExpanded && (
            <div className="mb-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground" data-testid="input-advanced-content">
              Speech recognition settings are managed by the server.
            </div>
          )}
        </section>

        <Separator className="my-4" />

        {/* Speech Output Section */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("config.speechOutput")}
            </h3>
          </div>

          {/* Voice name (read-only) */}
          <div className="mb-3">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              {t("config.voice")}
            </Label>
            <div
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              data-testid="voice-name-display"
            >
              <Volume2 className="h-4 w-4 text-primary" />
              <span className="flex-1 text-sm text-foreground">
                {voiceName || "Default"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("config.voiceReadOnly")}
            </p>
          </div>

          {/* Advanced settings (expandable) */}
          <button
            type="button"
            className="mb-1 flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOutputExpanded((prev) => !prev)}
            data-testid="output-advanced-toggle"
          >
            {outputExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            <span>Advanced settings</span>
          </button>
          {outputExpanded && (
            <div className="mb-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground" data-testid="output-advanced-content">
              Voice synthesis settings are managed by the server.
            </div>
          )}
        </section>

        <Separator className="my-4" />

        {/* Interim Response Toggle */}
        <section className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="interim-response"
                className="text-sm text-foreground"
              >
                {t("config.interimResponse")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("config.interimResponseDesc")}
              </p>
            </div>
            <Switch
              id="interim-response"
              checked={config.interimResponse}
              onCheckedChange={handleInterimResponseChange}
              data-testid="interim-response-switch"
            />
          </div>
        </section>

        {/* Proactive Engagement Toggle */}
        <section className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <Label
                htmlFor="proactive-engagement"
                className="text-sm text-foreground"
              >
                {t("config.proactiveEngagement")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("config.proactiveEngagementDesc")}
              </p>
            </div>
            <Switch
              id="proactive-engagement"
              checked={config.proactiveEngagement}
              onCheckedChange={handleProactiveEngagementChange}
              data-testid="proactive-engagement-switch"
            />
          </div>
        </section>

        <Separator className="my-4" />

        {/* Avatar Status */}
        <section>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">
                {t("config.avatarStatus")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("config.avatarDesc")}
              </p>
            </div>
            <Badge
              variant={avatarEnabled ? "default" : "secondary"}
              data-testid="avatar-status-badge"
            >
              {avatarEnabled
                ? t("config.avatarEnabled")
                : t("config.avatarDisabled")}
            </Badge>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

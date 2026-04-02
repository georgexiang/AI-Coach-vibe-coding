import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";

const AVATAR_VIDEO_CHARACTERS = [
  { character: "harry", styles: ["business", "casual", "youthful"] },
  { character: "jeff", styles: ["business", "formal"] },
  {
    character: "lisa",
    styles: [
      "casual-sitting",
      "graceful-sitting",
      "graceful-standing",
      "technical-sitting",
      "technical-standing",
    ],
  },
  { character: "lori", styles: ["casual", "graceful", "formal"] },
  { character: "max", styles: ["business", "casual", "formal"] },
  { character: "meg", styles: ["formal", "casual", "business"] },
] as const;

const VOICE_NAME_OPTIONS = [
  { value: "en-US-AvaNeural", label: "Ava (EN-US)" },
  { value: "en-US-Ava:DragonHDLatestNeural", label: "Ava HD (EN-US)" },
  { value: "en-US-AndrewNeural", label: "Andrew (EN-US)" },
  { value: "en-US-JennyNeural", label: "Jenny (EN-US)" },
  {
    value: "zh-CN-XiaoxiaoMultilingualNeural",
    label: "Xiaoxiao Multilingual (ZH-CN)",
  },
  { value: "zh-CN-XiaoxiaoNeural", label: "Xiaoxiao (ZH-CN)" },
  { value: "zh-CN-YunxiNeural", label: "Yunxi (ZH-CN)" },
  { value: "zh-CN-YunjianNeural", label: "Yunjian (ZH-CN)" },
] as const;

const TURN_DETECTION_TYPES = [
  { value: "server_vad", label: "Server VAD" },
  { value: "semantic_vad", label: "Semantic VAD (gpt-realtime only)" },
  {
    value: "azure_semantic_vad",
    label: "Azure Semantic VAD (all models)",
  },
  {
    value: "azure_semantic_vad_multilingual",
    label: "Azure Semantic VAD Multilingual",
  },
] as const;

const RECOGNITION_LANGUAGES = [
  { value: "auto", labelKey: "autoDetect" as const },
  { value: "zh-CN", label: "Chinese (zh-CN)" },
  { value: "en-US", label: "English (en-US)" },
  { value: "ja-JP", label: "Japanese (ja-JP)" },
  { value: "ko-KR", label: "Korean (ko-KR)" },
] as const;

interface VoiceAvatarTabProps {
  form: UseFormReturn<HcpFormValues>;
}

export function VoiceAvatarTab({ form }: VoiceAvatarTabProps) {
  const { t } = useTranslation(["admin", "common"]);

  const watchVoiceCustom = form.watch("voice_custom");
  const watchAvatarCustomized = form.watch("avatar_customized");
  const watchCharacter = form.watch("avatar_character");
  const watchTemperature = form.watch("voice_temperature");

  // Dynamically filter styles based on selected character
  const availableStyles = useMemo(() => {
    const found = AVATAR_VIDEO_CHARACTERS.find(
      (c) => c.character === watchCharacter,
    );
    return found ? [...found.styles] : [];
  }, [watchCharacter]);

  return (
    <div className="space-y-6">
      {/* Voice Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {t("admin:hcp.voiceSettings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Custom voice toggle */}
          <div className="flex items-center justify-between">
            <Label>{t("admin:hcp.customVoice")}</Label>
            <FormField
              control={form.control}
              name="voice_custom"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Voice name */}
          {watchVoiceCustom ? (
            <FormField
              control={form.control}
              name="voice_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin:hcp.voiceName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., en-US-Ava:DragonHDLatestNeural"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="voice_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin:hcp.voiceName")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VOICE_NAME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* Avatar Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {t("admin:hcp.avatarSettings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Custom avatar toggle */}
          <div className="flex items-center justify-between">
            <Label>{t("admin:hcp.customAvatar")}</Label>
            <FormField
              control={form.control}
              name="avatar_customized"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {watchAvatarCustomized ? (
            <FormField
              control={form.control}
              name="avatar_character"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin:hcp.avatarCharacter")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., custom-character-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="avatar_character"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin:hcp.avatarCharacter")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        // Auto-set style to first available for new character
                        const charDef = AVATAR_VIDEO_CHARACTERS.find(
                          (c) => c.character === val,
                        );
                        if (charDef && charDef.styles.length > 0) {
                          form.setValue(
                            "avatar_style",
                            charDef.styles[0] as string,
                          );
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AVATAR_VIDEO_CHARACTERS.map((c) => (
                          <SelectItem key={c.character} value={c.character}>
                            {c.character.charAt(0).toUpperCase() +
                              c.character.slice(1)}
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
                name="avatar_style"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin:hcp.avatarStyle")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableStyles.map((s) => (
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Parameters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {t("admin:hcp.conversationParams")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Temperature slider */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("admin:hcp.temperature")}</Label>
              <span className="text-sm text-muted-foreground">
                {watchTemperature.toFixed(1)}
              </span>
            </div>
            <FormField
              control={form.control}
              name="voice_temperature"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={(v: number[]) =>
                        field.onChange(v[0] ?? 0.9)
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Turn detection */}
          <FormField
            control={form.control}
            name="turn_detection_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin:hcp.turnDetection")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TURN_DETECTION_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* Noise suppression */}
          <div className="flex items-center justify-between">
            <Label>{t("admin:hcp.noiseSuppression")}</Label>
            <FormField
              control={form.control}
              name="noise_suppression"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Echo cancellation */}
          <div className="flex items-center justify-between">
            <Label>{t("admin:hcp.echoCancellation")}</Label>
            <FormField
              control={form.control}
              name="echo_cancellation"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* EOU detection */}
          <div className="flex items-center justify-between">
            <Label>{t("admin:hcp.eouDetection")}</Label>
            <FormField
              control={form.control}
              name="eou_detection"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Recognition language */}
          <FormField
            control={form.control}
            name="recognition_language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin:hcp.recognitionLanguage")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RECOGNITION_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {"labelKey" in lang
                          ? t(`admin:hcp.${lang.labelKey}`)
                          : lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

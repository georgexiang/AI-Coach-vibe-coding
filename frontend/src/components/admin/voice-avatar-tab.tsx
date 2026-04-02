import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Mic, MicOff, Send, Phone, PhoneOff, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { useVoiceToken } from "@/hooks/use-voice-token";
import { useVoiceLive } from "@/hooks/use-voice-live";
import { useAvatarStream } from "@/hooks/use-avatar-stream";
import { useAudioHandler } from "@/hooks/use-audio-handler";
import { resolveMode } from "@/lib/voice-utils";
import { cn } from "@/lib/utils";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";
import type { HcpProfile } from "@/types/hcp";
import type { TranscriptSegment } from "@/types/voice-live";

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

function buildPreviewInstructions(values: HcpFormValues): string {
  const name = values.name || "[Name]";
  const specialty = values.specialty || "[Specialty]";
  const personalityType = values.personality_type || "friendly";
  const hospital = values.hospital || "";
  const title = values.title || "";
  const concerns = values.concerns || "";
  const prescribingHabits = values.prescribing_habits || "";
  const objections = values.objections || [];
  const expertiseAreas = values.expertise_areas || [];
  const difficulty = values.difficulty || "medium";

  const lines: string[] = [];
  lines.push(
    `You are ${name}, a ${specialty} specialist${hospital ? ` at ${hospital}` : ""}.`,
  );
  if (title) lines.push(`Your title is ${title}.`);
  lines.push("");
  lines.push(`Personality type: ${personalityType}`);
  lines.push(`Difficulty level: ${difficulty}`);
  if (expertiseAreas.length > 0) {
    lines.push(
      `Expertise areas: ${expertiseAreas.filter(Boolean).join(", ")}`,
    );
  }
  if (prescribingHabits) {
    lines.push(`Prescribing habits: ${prescribingHabits}`);
  }
  if (concerns) {
    lines.push(`Key concerns: ${concerns}`);
  }
  if (objections.filter(Boolean).length > 0) {
    lines.push(
      `Common objections: ${objections.filter(Boolean).join("; ")}`,
    );
  }

  return lines.join("\n");
}

interface VoiceAvatarTabProps {
  form: UseFormReturn<HcpFormValues>;
  profile?: HcpProfile;
  isNew: boolean;
}

export function VoiceAvatarTab({ form, profile, isNew }: VoiceAvatarTabProps) {
  const { t } = useTranslation(["admin", "common"]);

  const watchVoiceCustom = form.watch("voice_custom");
  const watchAvatarCustomized = form.watch("avatar_customized");
  const watchCharacter = form.watch("avatar_character");
  const watchTemperature = form.watch("voice_temperature");

  const availableStyles = useMemo(() => {
    const found = AVATAR_VIDEO_CHARACTERS.find(
      (c) => c.character === watchCharacter,
    );
    return found ? [...found.styles] : [];
  }, [watchCharacter]);

  // Agent instructions preview
  const formValues = form.watch();
  const previewInstructions = useMemo(
    () => buildPreviewInstructions(formValues),
    [formValues],
  );

  // --- Live avatar test state ---
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [textInput, setTextInput] = useState("");
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const tokenMutation = useVoiceToken();
  const audioHandler = useAudioHandler();
  const avatarStream = useAvatarStream(videoContainerRef);

  const handleTranscript = useCallback((segment: TranscriptSegment) => {
    setTranscripts((prev) => {
      const existing = prev.findIndex((s) => s.id === segment.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = segment;
        return updated;
      }
      return [...prev, segment];
    });
  }, []);

  const voiceLive = useVoiceLive({
    language: "zh-CN",
    systemPrompt: "",
    onTranscript: handleTranscript,
    onConnectionStateChange: (state) => {
      if (state === "error") {
        toast.error(t("admin:hcp.voiceTestError", "Connection error"));
        setIsConnected(false);
        setIsConnecting(false);
      }
    },
    onError: (error) => {
      console.error("[VoiceAvatarTab] error:", error);
    },
  });

  const handleConnect = useCallback(async () => {
    if (!profile?.id) return;
    setIsConnecting(true);
    setTranscripts([]);
    try {
      const tokenData = await tokenMutation.mutateAsync(profile.id);
      const mode = resolveMode(tokenData);
      await audioHandler.initialize();
      const session = await voiceLive.connect(tokenData);

      if (mode.startsWith("digital_human") && tokenData.avatar_enabled) {
        try {
          const iceServers = session?.avatar?.ice_servers ?? [];
          await avatarStream.connect(iceServers, voiceLive.clientRef.current);
        } catch {
          toast.warning(t("admin:hcp.avatarFallback", "Avatar unavailable, voice-only mode"));
        }
      }

      audioHandler.startRecording((audioData: Float32Array) => {
        const client = voiceLive.clientRef.current as {
          sendAudio?: (data: Float32Array) => void;
        } | null;
        client?.sendAudio?.(audioData);
      });

      setIsConnected(true);
    } catch (err) {
      toast.error(
        t("admin:hcp.voiceTestError", "Failed to connect: ") +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsConnecting(false);
    }
  }, [profile?.id, tokenMutation, audioHandler, voiceLive, avatarStream, t]);

  const handleDisconnect = useCallback(async () => {
    audioHandler.stopRecording();
    avatarStream.disconnect();
    await voiceLive.disconnect();
    audioHandler.cleanup();
    setIsConnected(false);
  }, [audioHandler, avatarStream, voiceLive]);

  const handleSendText = useCallback(() => {
    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput("");
    setTranscripts((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        isFinal: true,
        timestamp: Date.now(),
      },
    ]);
    void voiceLive.sendTextMessage(text);
  }, [textInput, voiceLive]);

  return (
    <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Left: Settings (scrollable) */}
      <div className="w-80 flex-shrink-0 overflow-y-auto space-y-4 pr-2">
        {/* Voice Settings Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {t("admin:hcp.voiceSettings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("admin:hcp.customVoice")}</Label>
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
            {watchVoiceCustom ? (
              <FormField
                control={form.control}
                name="voice_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      {t("admin:hcp.voiceName")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., en-US-Ava:DragonHDLatestNeural"
                        className="h-8 text-xs"
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
                    <FormLabel className="text-xs">
                      {t("admin:hcp.voiceName")}
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-8 text-xs">
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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {t("admin:hcp.avatarSettings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("admin:hcp.customAvatar")}</Label>
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
                    <FormLabel className="text-xs">
                      {t("admin:hcp.avatarCharacter")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., custom-character-name"
                        className="h-8 text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="avatar_character"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        {t("admin:hcp.avatarCharacter")}
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(val) => {
                          field.onChange(val);
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
                          <SelectTrigger className="h-8 text-xs">
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
                      <FormLabel className="text-xs">
                        {t("admin:hcp.avatarStyle")}
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-8 text-xs">
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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {t("admin:hcp.conversationParams")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("admin:hcp.temperature")}</Label>
                <span className="text-xs text-muted-foreground">
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
            <FormField
              control={form.control}
              name="turn_detection_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {t("admin:hcp.turnDetection")}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs">
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                {t("admin:hcp.noiseSuppression")}
              </Label>
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                {t("admin:hcp.echoCancellation")}
              </Label>
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
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                {t("admin:hcp.eouDetection")}
              </Label>
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
            <FormField
              control={form.control}
              name="recognition_language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {t("admin:hcp.recognitionLanguage")}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs">
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

        {/* Agent Instructions Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {t("admin:hcp.autoInstructions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={4}
              value={previewInstructions}
              disabled
              className="bg-muted/50 text-xs font-mono"
            />
            <FormField
              control={form.control}
              name="agent_instructions_override"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {t("admin:hcp.overrideInstructions")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      {...field}
                      placeholder={t("admin:hcp.overridePlaceholder")}
                      className="text-xs"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right: Avatar + Conversation Test */}
      <div className="flex-1 flex flex-col min-w-0 border rounded-lg overflow-hidden">
        {/* Avatar area */}
        <div className="flex-1 relative bg-muted/30 overflow-hidden">
          {isConnected && avatarStream.isConnected ? (
            <div
              ref={videoContainerRef}
              className="w-full h-full"
            />
          ) : isConnected ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="size-12 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("admin:hcp.voiceOnlyMode", "Voice-only mode")}
              </p>
              {audioHandler.isRecording && (
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-primary rounded-full animate-pulse"
                      style={{
                        height: `${12 + Math.random() * 20}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <div
                ref={videoContainerRef}
                className="hidden"
              />
              <div className="size-24 rounded-full bg-muted flex items-center justify-center">
                <User className="size-12 text-muted-foreground" />
              </div>
              <p className="text-base font-medium capitalize">
                {watchCharacter}
              </p>
              <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                {form.watch("avatar_style")}
              </span>
              {isNew ? (
                <p className="text-xs text-muted-foreground text-center px-8">
                  {t(
                    "admin:hcp.saveFirstForVoice",
                    "Save profile first to enable voice test",
                  )}
                </p>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting || !profile?.id}
                  size="sm"
                >
                  <Phone className="size-4 mr-2" />
                  {isConnecting
                    ? t("common:connecting", "Connecting...")
                    : t("admin:hcp.connectAvatar", "Connect")}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Transcript area */}
        {isConnected && (
          <div className="h-40 overflow-y-auto border-t bg-background p-3 space-y-2">
            {transcripts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t(
                  "admin:hcp.startSpeaking",
                  "Start speaking or type a message...",
                )}
              </p>
            )}
            {transcripts.map((seg) => (
              <div
                key={seg.id}
                className={cn(
                  "text-sm px-3 py-1.5 rounded-lg max-w-[80%]",
                  seg.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted",
                )}
              >
                {seg.content}
              </div>
            ))}
          </div>
        )}

        {/* Controls bar */}
        <div className="flex items-center gap-2 p-2 border-t bg-background">
          {isConnected ? (
            <>
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
                placeholder={t("admin:hcp.typeMessage", "Type a message...")}
                className="h-8 text-sm flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={handleSendText}
              >
                <Send className="size-4" />
              </Button>
              <Button
                size="icon"
                variant={voiceLive.isMuted ? "destructive" : "ghost"}
                className="size-8"
                onClick={voiceLive.toggleMute}
              >
                {voiceLive.isMuted ? (
                  <MicOff className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDisconnect}
              >
                <PhoneOff className="size-4 mr-1" />
                {t("admin:hcp.disconnectAvatar", "Disconnect")}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground px-2">
              {isNew
                ? t(
                    "admin:hcp.saveFirstForVoice",
                    "Save profile first to enable voice test",
                  )
                : t(
                    "admin:hcp.connectToTest",
                    "Click Connect to test voice conversation",
                  )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

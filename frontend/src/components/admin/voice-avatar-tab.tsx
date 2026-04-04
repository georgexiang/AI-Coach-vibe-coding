import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Mic, MicOff, Send, Phone, PhoneOff, User, Check, MoreHorizontal } from "lucide-react";
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
import { VoiceLiveModelSelect } from "@/components/admin/voice-live-model-select";
import { useVoiceLive } from "@/hooks/use-voice-live";
import { useAvatarStream } from "@/hooks/use-avatar-stream";
import { useAudioHandler } from "@/hooks/use-audio-handler";
import { cn } from "@/lib/utils";
import {
  AVATAR_CHARACTERS,
  AVATAR_CHARACTER_MAP,
  getAvatarInitials,
} from "@/data/avatar-characters";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";
import type { HcpProfile } from "@/types/hcp";
import type { TranscriptSegment } from "@/types/voice-live";

/** Set of character IDs whose thumbnail failed to load — triggers initials fallback. */
const failedThumbnails = new Set<string>();

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

/** Resolve gradient classes for a character (from metadata or a default). */
function getCharacterGradient(characterId: string): string {
  return AVATAR_CHARACTER_MAP.get(characterId)?.gradientClasses ?? "from-gray-500 to-gray-700";
}

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
    const found = AVATAR_CHARACTER_MAP.get(watchCharacter);
    return found ? [...found.styles] : [];
  }, [watchCharacter]);

  /** Track which thumbnails failed to load so we show initials fallback. */
  const [, setThumbnailRerender] = useState(0);
  const handleThumbnailError = useCallback(
    (characterId: string) => {
      if (!failedThumbnails.has(characterId)) {
        failedThumbnails.add(characterId);
        setThumbnailRerender((n) => n + 1);
      }
    },
    [],
  );

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
  const videoRef = useRef<HTMLVideoElement>(null);

  const audioHandler = useAudioHandler();
  const avatarStream = useAvatarStream(videoRef);

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
      } else if (state === "disconnected") {
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
      await audioHandler.initialize();

      // Wire up avatar SDP callback before connecting
      voiceLive.avatarSdpCallbackRef.current = (serverSdp: string) => {
        void avatarStream.handleServerSdp(serverSdp);
      };

      // Connect via backend WebSocket proxy
      const result = await voiceLive.connect(profile.id);

      // Connect avatar if enabled
      if (result.avatarEnabled) {
        try {
          await avatarStream.connect(
            result.iceServers,
            async (clientSdp: string) => {
              voiceLive.send({
                type: "session.avatar.connect",
                client_sdp: clientSdp,
              });
            },
          );
        } catch {
          toast.warning(t("admin:hcp.avatarFallback", "Avatar unavailable, voice-only mode"));
        }
      }

      // Start recording — send audio via backend proxy
      audioHandler.startRecording((audioData: Float32Array) => {
        const int16 = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          const s = Math.max(-1, Math.min(1, audioData[i] ?? 0));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(int16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        voiceLive.sendAudio(btoa(binary));
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
  }, [profile?.id, audioHandler, voiceLive, avatarStream, t]);

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

  /** Handle avatar character selection from the visual grid */
  const handleAvatarGridSelect = useCallback(
    (character: string) => {
      form.setValue("avatar_character", character);
      const charDef = AVATAR_CHARACTER_MAP.get(character);
      if (charDef) {
        form.setValue("avatar_style", charDef.defaultStyle);
      }
    },
    [form],
  );

  return (
    <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Left: Settings (scrollable) */}
      <div className="w-80 flex-shrink-0 overflow-y-auto space-y-4 pr-2">
        {/* Voice Live Agent Config Toggle */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">
                  {t("admin:hcp.voiceLiveEnabled", "Voice Live Config")}
                </Label>
                <p className="text-[10px] leading-tight text-muted-foreground">
                  {t(
                    "admin:hcp.voiceLiveEnabledDesc",
                    "Sync voice settings as agent metadata",
                  )}
                </p>
              </div>
              <FormField
                control={form.control}
                name="voice_live_enabled"
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
          </CardContent>
        </Card>

        {/* Voice Settings Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {t("admin:hcp.voiceSettings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              control={form.control}
              name="voice_live_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">
                    {t("admin:hcp.voiceLiveModel")}
                  </FormLabel>
                  <FormControl>
                    <VoiceLiveModelSelect
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <p className="text-[10px] text-muted-foreground">
                    {t("admin:hcp.voiceLiveModelDesc")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
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

        {/* Avatar Settings Card — with visual grid matching AI Foundry */}
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
              <>
                {/* Visual avatar character grid — AI Foundry style */}
                <div className="grid grid-cols-3 gap-2" data-testid="avatar-character-grid">
                  {AVATAR_CHARACTERS.map((c) => {
                    const isSelected = watchCharacter === c.id;
                    const showFallback = failedThumbnails.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAvatarGridSelect(c.id)}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all",
                          "hover:border-primary/50 hover:shadow-sm",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-transparent bg-muted/30",
                        )}
                        data-testid={`avatar-grid-${c.id}`}
                      >
                        {/* Avatar thumbnail with graceful fallback */}
                        <div className="relative h-14 w-14 overflow-hidden rounded-full">
                          {!showFallback ? (
                            <img
                              src={c.thumbnailUrl}
                              alt={c.displayName}
                              className="h-full w-full object-cover"
                              onError={() => handleThumbnailError(c.id)}
                              loading="lazy"
                              data-testid={`avatar-img-${c.id}`}
                            />
                          ) : (
                            <div
                              className={cn(
                                "flex h-full w-full items-center justify-center bg-gradient-to-br text-white text-lg font-bold",
                                c.gradientClasses,
                              )}
                              data-testid={`avatar-fallback-${c.id}`}
                            >
                              {getAvatarInitials(c.displayName)}
                            </div>
                          )}
                        </div>
                        {/* Character name */}
                        <span className="text-[10px] font-medium leading-tight">
                          {c.displayName}
                        </span>
                        {/* Style label */}
                        <span className="text-[9px] text-muted-foreground leading-tight capitalize">
                          {c.defaultStyle.replace(/-/g, " ")}
                        </span>
                        {/* Selection indicator */}
                        {isSelected && (
                          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* More avatars button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => form.setValue("avatar_customized", true)}
                  data-testid="more-avatars-btn"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  {t("admin:hcp.moreAvatars", "More avatars")}
                </Button>

                {/* Style selector for selected character */}
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
              </>
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
        <div className="flex-1 relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 overflow-hidden">
          {/* Pre-rendered video element - always in DOM for WebRTC ontrack */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={isConnected && avatarStream.isConnected
              ? "absolute inset-0 w-full h-full object-cover z-10"
              : "absolute inset-0 w-full h-full object-cover opacity-0 -z-10"}
          />
          {isConnected && avatarStream.isConnected ? (
            null
          ) : isConnected ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <div className="size-24 rounded-full bg-gradient-to-br from-[#A855F7] via-[#7C3AED] to-[#6D28D9] flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.3)]">
                <User className="size-12 text-white" />
              </div>
              <p className="text-sm text-white/70">
                {t("admin:hcp.voiceOnlyMode", "Voice-only mode")}
              </p>
              {audioHandler.isRecording && (
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-[#A855F7] rounded-full animate-pulse"
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
              {/* Avatar preview with image or gradient fallback */}
              {(() => {
                const charMeta = AVATAR_CHARACTER_MAP.get(watchCharacter);
                const showFallback = !charMeta || failedThumbnails.has(watchCharacter);
                return (
                  <div className="relative size-24 overflow-hidden rounded-full shadow-lg">
                    {!showFallback ? (
                      <img
                        src={charMeta.thumbnailUrl}
                        alt={charMeta.displayName}
                        className="h-full w-full object-cover"
                        onError={() => handleThumbnailError(watchCharacter)}
                      />
                    ) : (
                      <div
                        className={cn(
                          "flex h-full w-full items-center justify-center bg-gradient-to-br text-white text-3xl font-bold",
                          getCharacterGradient(watchCharacter),
                        )}
                      >
                        {charMeta ? getAvatarInitials(charMeta.displayName) : <User className="size-12" />}
                      </div>
                    )}
                  </div>
                );
              })()}
              <p className="text-base font-medium text-white">
                {AVATAR_CHARACTER_MAP.get(watchCharacter)?.displayName ?? watchCharacter}
              </p>
              <span className="text-xs px-3 py-1 bg-white/10 text-white/70 rounded-full">
                {form.watch("avatar_style")}
              </span>
              {isNew ? (
                <p className="text-xs text-white/50 text-center px-8">
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
                  className="bg-primary hover:bg-primary/90"
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

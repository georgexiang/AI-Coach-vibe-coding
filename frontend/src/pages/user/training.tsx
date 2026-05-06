import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import {
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { ScenarioCard } from "@/components/coach";
import { ModeSelector } from "@/components/voice";
import { useActiveScenarios } from "@/hooks/use-scenarios";
import { useCreateSession } from "@/hooks/use-session";
import { useConfig } from "@/contexts/config-context";
import type { SessionMode } from "@/types/voice-live";

const ALL_VALUE = "__all__";

export default function ScenarioSelection() {
  const { t } = useTranslation("coach");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(ALL_VALUE);
  const [selectedDifficulty, setSelectedDifficulty] = useState(ALL_VALUE);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<SessionMode>("voice_pipeline");

  const { data, isLoading } = useActiveScenarios();
  const createSession = useCreateSession();
  const config = useConfig();

  const scenarios = data ?? [];

  const products = useMemo(
    () => [...new Set(scenarios.map((s) => s.product))],
    [scenarios]
  );
  const difficulties = useMemo(
    () => [...new Set(scenarios.map((s) => s.difficulty))],
    [scenarios]
  );

  const filteredScenarios = useMemo(() => {
    return scenarios.filter((s) => {
      const matchesSearch =
        searchTerm === "" ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProduct =
        selectedProduct === ALL_VALUE || s.product === selectedProduct;
      const matchesDifficulty =
        selectedDifficulty === ALL_VALUE ||
        s.difficulty === selectedDifficulty;
      return matchesSearch && matchesProduct && matchesDifficulty;
    });
  }, [scenarios, searchTerm, selectedProduct, selectedDifficulty]);

  // Derive availability from feature flags
  const pipelineAvailable = config.voice_enabled;
  const agentAvailable = false; // Agent config not yet discoverable from feature flags; future: check voice status
  const voiceLiveAvailable = config.voice_live_enabled;
  const avatarAvailable = config.avatar_enabled;

  const handleStartTraining = async (scenarioId: string) => {
    try {
      const session = await createSession.mutateAsync({ scenarioId });
      navigate(`/user/training/session?id=${session.id}`);
    } catch {
      // Error handled by TanStack Query
    }
  };

  const handleStartConference = async (scenarioId: string) => {
    try {
      const session = await createSession.mutateAsync({ scenarioId });
      navigate(`/user/training/conference?id=${session.id}`);
    } catch {
      // Error handled by TanStack Query
    }
  };

  const handleStartVoiceSession = async (scenarioId: string) => {
    try {
      const session = await createSession.mutateAsync({ scenarioId, mode: selectedVoiceMode });
      navigate(`/user/training/voice?id=${session.id}&mode=${selectedVoiceMode}`);
    } catch {
      // Error handled by TanStack Query
    }
  };

  const filterRow = (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t("scenarioSelection.filterAllDifficulties")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{tc("allProducts")}</SelectItem>
          {products.map((product) => (
            <SelectItem key={product} value={product}>
              {product}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedDifficulty}
        onValueChange={setSelectedDifficulty}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t("scenarioSelection.filterAllDifficulties")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>
            {t("scenarioSelection.filterAllDifficulties")}
          </SelectItem>
          {difficulties.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("scenarioSelection.searchPlaceholder", { defaultValue: tc("search") })}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  );

  const renderGrid = (onStart: (scenarioId: string) => void) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
              <Skeleton className="h-48 w-full" />
              <div className="space-y-3 p-6">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (filteredScenarios.length === 0) {
      return (
        <EmptyState
          title={t("scenarioSelection.emptyTitle")}
          body={t("scenarioSelection.emptyBody")}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredScenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            onStart={onStart}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-foreground">
        {t("scenarioSelection.title")}
      </h1>

      <Tabs defaultValue="f2f">
        <TabsList>
          <TabsTrigger value="f2f">
            {t("scenarioSelection.tabF2F")}
          </TabsTrigger>
          <TabsTrigger value="conference">
            {t("scenarioSelection.tabConference")}
          </TabsTrigger>
          {config.voice_live_enabled && (
            <TabsTrigger value="voice">
              {t("scenarioSelection.tabVoice")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="f2f" className="mt-6">
          {filterRow}
          {renderGrid(handleStartTraining)}
        </TabsContent>

        <TabsContent value="conference" className="mt-6">
          {filterRow}
          {renderGrid(handleStartConference)}
        </TabsContent>

        {config.voice_live_enabled && (
          <TabsContent value="voice" className="mt-6">
            <div className="mb-6 flex justify-center">
              <ModeSelector
                value={selectedVoiceMode}
                onChange={setSelectedVoiceMode}
                voiceLiveAvailable={voiceLiveAvailable}
                avatarAvailable={avatarAvailable}
                pipelineAvailable={pipelineAvailable}
                agentAvailable={agentAvailable}
              />
            </div>
            {filterRow}
            {renderGrid(handleStartVoiceSession)}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

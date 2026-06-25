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
import { useActiveScenarios } from "@/hooks/use-scenarios";
import { useCreateSession } from "@/hooks/use-session";
import { useCreateConferenceSession } from "@/hooks/use-conference";
import { useFeatureFlags } from "@/hooks/use-config";
import type { Scenario } from "@/types/scenario";

const ALL_VALUE = "__all__";

function getScenarioModes(
  scenario: Scenario,
  features: { voice_live_enabled?: boolean; avatar_enabled?: boolean } | undefined,
) {
  const modes = ["text"];
  const hcp = scenario.hcp_profile;
  const voiceAvailable = Boolean(features?.voice_live_enabled && hcp?.voice_live_enabled);
  const avatarAvailable = Boolean(
    voiceAvailable && features?.avatar_enabled && hcp?.avatar_enabled,
  );

  if (voiceAvailable) {
    modes.push("voice_realtime_model");
    if (avatarAvailable) {
      modes.push("digital_human_realtime_model");
    }
  }

  const defaultMode = avatarAvailable
    ? "digital_human_realtime_model"
    : voiceAvailable
      ? "voice_realtime_model"
      : "text";

  return { modes, defaultMode };
}

export default function ScenarioSelection() {
  const { t } = useTranslation("coach");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(ALL_VALUE);
  const [selectedDifficulty, setSelectedDifficulty] = useState(ALL_VALUE);

  const { data, isLoading } = useActiveScenarios();
  const createSession = useCreateSession();
  const createConferenceSession = useCreateConferenceSession();
  const { data: config } = useFeatureFlags(true);

  const scenarios = data ?? [];

  const products = useMemo(
    () => [...new Set(scenarios.map((s) => s.product).filter(Boolean))] as string[],
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

  const handleStartTraining = async (scenarioId: string, mode: string) => {
    try {
      const session = await createSession.mutateAsync({ scenarioId, mode });
      navigate(`/user/training/session?id=${session.id}`);
    } catch {
      // Error handled by TanStack Query
    }
  };

  const handleStartConference = async (scenarioId: string, mode: string) => {
    void mode;
    try {
      const session = await createConferenceSession.mutateAsync(scenarioId);
      navigate(`/user/training/conference?id=${session.id}`);
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
          placeholder={t("scenarioSelection.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  );

  const renderGrid = (mode: "f2f" | "conference", onStart: (scenarioId: string, trainingMode: string) => void) => {
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

    const modeScenarios = filteredScenarios.filter((s) => s.mode === mode);

    if (modeScenarios.length === 0) {
      return (
        <EmptyState
          title={t("scenarioSelection.emptyTitle")}
          body={t("scenarioSelection.emptyBody")}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {modeScenarios.map((scenario) => {
          const { modes, defaultMode } = getScenarioModes(scenario, config?.features);
          return (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onStart={onStart}
              availableModes={modes}
              defaultMode={defaultMode}
            />
          );
        })}
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
        </TabsList>

        <TabsContent value="f2f" className="mt-6">
          {filterRow}
          {renderGrid("f2f", handleStartTraining)}
        </TabsContent>

        <TabsContent value="conference" className="mt-6">
          {filterRow}
          {renderGrid("conference", handleStartConference)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

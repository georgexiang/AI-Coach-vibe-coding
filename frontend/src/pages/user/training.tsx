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

const ALL_VALUE = "__all__";

export default function ScenarioSelection() {
  const { t } = useTranslation("coach");
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(ALL_VALUE);
  const [selectedDifficulty, setSelectedDifficulty] = useState(ALL_VALUE);

  const { data, isLoading } = useActiveScenarios();
  const createSession = useCreateSession();

  const scenarios = data?.items ?? [];

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

  const handleStartTraining = async (scenarioId: string) => {
    try {
      const session = await createSession.mutateAsync({
        scenario_id: scenarioId,
      });
      navigate(`/user/training/session?id=${session.id}`);
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
          <SelectItem value={ALL_VALUE}>All Products</SelectItem>
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
          placeholder="Search scenarios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  );

  const renderGrid = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border">
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredScenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            onStart={handleStartTraining}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-8">
      <h1 className="mb-8 text-3xl font-semibold text-gray-900">
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
          {renderGrid()}
        </TabsContent>

        <TabsContent value="conference" className="mt-6">
          {filterRow}
          {renderGrid()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

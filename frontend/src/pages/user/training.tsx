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
} from "@/components/ui";
import { HCPProfileCard } from "@/components/shared";

// TODO: Replace with TanStack Query hook in Phase 2
const mockHCPs = [
  {
    id: "1",
    name: "Dr. Wang Wei",
    nameZh: "\u738B\u4F1F",
    specialty: "Oncologist",
    hospital: "Beijing Cancer Hospital",
    personality: ["Skeptical", "Detail-oriented"],
    difficulty: "Hard" as const,
    product: "PD-1 Inhibitor",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=WangWei&backgroundColor=b6e3f4",
  },
  {
    id: "2",
    name: "Dr. Li Na",
    nameZh: "\u674E\u5A1C",
    specialty: "Cardiologist",
    hospital: "Shanghai Cardiovascular Center",
    personality: ["Friendly"],
    difficulty: "Easy" as const,
    product: "ACE Inhibitor",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=LiNa&backgroundColor=ffd5dc",
  },
  {
    id: "3",
    name: "Dr. Zhang Ming",
    nameZh: "\u5F20\u660E",
    specialty: "Neurologist",
    hospital: "Guangzhou General Hospital",
    personality: ["Busy"],
    difficulty: "Medium" as const,
    product: "Migraine Treatment",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=ZhangMing&backgroundColor=c0aede",
  },
  {
    id: "4",
    name: "Dr. Chen Hui",
    nameZh: "\u9648\u6167",
    specialty: "Pulmonologist",
    hospital: "Shenzhen Respiratory Institute",
    personality: ["Detail-oriented"],
    difficulty: "Medium" as const,
    product: "COPD Inhaler",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=ChenHui&backgroundColor=d1f4d1",
  },
  {
    id: "5",
    name: "Dr. Liu Yang",
    nameZh: "\u5218\u6D0B",
    specialty: "Endocrinologist",
    hospital: "Hangzhou Diabetes Center",
    personality: ["Skeptical"],
    difficulty: "Hard" as const,
    product: "GLP-1 Agonist",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=LiuYang&backgroundColor=ffdfba",
  },
  {
    id: "6",
    name: "Dr. Zhao Lin",
    nameZh: "\u8D75\u7433",
    specialty: "Hematologist",
    hospital: "Nanjing Blood Disease Hospital",
    personality: ["Friendly"],
    difficulty: "Easy" as const,
    product: "Anticoagulant Therapy",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=ZhaoLin&backgroundColor=b6e3f4",
  },
];

const ALL_VALUE = "__all__";

export default function ScenarioSelection() {
  const { t } = useTranslation("training");
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(ALL_VALUE);
  const [selectedDifficulty, setSelectedDifficulty] = useState(ALL_VALUE);
  const [selectedSpecialty, setSelectedSpecialty] = useState(ALL_VALUE);

  const products = useMemo(
    () => [...new Set(mockHCPs.map((h) => h.product))],
    [],
  );
  const difficulties = useMemo(
    () => [...new Set(mockHCPs.map((h) => h.difficulty))],
    [],
  );
  const specialties = useMemo(
    () => [...new Set(mockHCPs.map((h) => h.specialty))],
    [],
  );

  const filteredHCPs = useMemo(() => {
    return mockHCPs.filter((hcp) => {
      const matchesSearch =
        searchTerm === "" ||
        hcp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hcp.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hcp.hospital.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProduct =
        selectedProduct === ALL_VALUE || hcp.product === selectedProduct;
      const matchesDifficulty =
        selectedDifficulty === ALL_VALUE ||
        hcp.difficulty === selectedDifficulty;
      const matchesSpecialty =
        selectedSpecialty === ALL_VALUE ||
        hcp.specialty === selectedSpecialty;

      return (
        matchesSearch &&
        matchesProduct &&
        matchesDifficulty &&
        matchesSpecialty
      );
    });
  }, [searchTerm, selectedProduct, selectedDifficulty, selectedSpecialty]);

  const filterRow = (
    <div className="mb-8 flex flex-wrap gap-4">
      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t("allProducts")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t("allProducts")}</SelectItem>
          {products.map((product) => (
            <SelectItem key={product} value={product}>
              {product}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t("allDifficulties")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t("allDifficulties")}</SelectItem>
          {difficulties.map((difficulty) => (
            <SelectItem key={difficulty} value={difficulty}>
              {difficulty}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t("allSpecialties")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t("allSpecialties")}</SelectItem>
          {specialties.map((specialty) => (
            <SelectItem key={specialty} value={specialty}>
              {specialty}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  );

  const cardGrid = (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {filteredHCPs.map((hcp) => (
        <HCPProfileCard
          key={hcp.id}
          name={hcp.name}
          nameZh={hcp.nameZh}
          specialty={hcp.specialty}
          hospital={hcp.hospital}
          personality={hcp.personality}
          difficulty={hcp.difficulty}
          product={hcp.product}
          avatar={hcp.avatar}
          onStartTraining={() => navigate("/user/training/session")}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-foreground">
        {t("selectScenario")}
      </h1>

      <Tabs defaultValue="f2f">
        <TabsList>
          <TabsTrigger value="f2f">{t("f2fTraining")}</TabsTrigger>
          <TabsTrigger value="conference">
            {t("conferenceTraining")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="f2f" className="mt-6">
          {filterRow}
          {cardGrid}
        </TabsContent>

        <TabsContent value="conference" className="mt-6">
          {filterRow}
          {cardGrid}
        </TabsContent>
      </Tabs>
    </div>
  );
}

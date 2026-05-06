import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScenarioTable } from "@/components/admin/scenario-table";
import { ScenarioEditor } from "@/components/admin/scenario-editor";
import {
  useScenarios,
  useCreateScenario,
  useUpdateScenario,
  useDeleteScenario,
  useCloneScenario,
} from "@/hooks/use-scenarios";
import type { Scenario, ScenarioCreate, ScenarioUpdate } from "@/types/scenario";

const ALL_STATUS = "__all__";

export default function ScenariosPage() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [filterStatus, setFilterStatus] = useState(ALL_STATUS);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryStatus = filterStatus === ALL_STATUS ? undefined : filterStatus;
  const { data: scenariosData } = useScenarios({ status: queryStatus });
  const createMutation = useCreateScenario();
  const updateMutation = useUpdateScenario();
  const deleteMutation = useDeleteScenario();
  const cloneMutation = useCloneScenario();

  const scenarios = useMemo(
    () => scenariosData?.items ?? [],
    [scenariosData],
  );

  const handleCreate = () => {
    setEditingScenario(null);
    setIsNew(true);
    setEditorOpen(true);
  };

  const handleEdit = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setIsNew(false);
    setEditorOpen(true);
  };

  const handleSave = (data: ScenarioCreate) => {
    if (isNew) {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success(t("scenarios.save"));
          setEditorOpen(false);
        },
        onError: () => toast.error(t("errors.scenarioSaveFailed")),
      });
    } else if (editingScenario) {
      updateMutation.mutate(
        { id: editingScenario.id, data: data as ScenarioUpdate },
        {
          onSuccess: () => {
            toast.success(t("scenarios.save"));
            setEditorOpen(false);
          },
          onError: () => toast.error(t("errors.scenarioSaveFailed")),
        },
      );
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId, {
        onSuccess: () => {
          toast.success(t("scenarios.deleted", { defaultValue: "Scenario deleted" }));
          setDeleteConfirmId(null);
        },
      });
    }
  };

  const handleClone = (id: string) => {
    cloneMutation.mutate(id, {
      onSuccess: () => toast.success(t("scenarios.cloned", { defaultValue: "Scenario cloned" })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">{t("scenarios.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("scenarios.description", { defaultValue: "Configure training scenarios with products, HCP assignments, and scoring weights" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>{tc("all", { defaultValue: "All" })}</SelectItem>
              <SelectItem value="active">{tc("active", { defaultValue: "Active" })}</SelectItem>
              <SelectItem value="draft">{tc("draft", { defaultValue: "Draft" })}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCreate}>
            <Plus className="size-4" />
            {t("scenarios.createButton")}
          </Button>
        </div>
      </div>

      <ScenarioTable
        scenarios={scenarios}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClone={handleClone}
      />

      <ScenarioEditor
        scenario={editingScenario}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={handleSave}
        isNew={isNew}
      />

      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("scenarios.deleteTitle", { defaultValue: "Delete Scenario" })}
            </DialogTitle>
            <DialogDescription>
              {t("scenarios.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {tc("cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {tc("delete", { defaultValue: "Delete" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

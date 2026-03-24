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
          toast.success("Scenario deleted");
          setDeleteConfirmId(null);
        },
      });
    }
  };

  const handleClone = (id: string) => {
    cloneMutation.mutate(id, {
      onSuccess: () => toast.success("Scenario cloned"),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t("scenarios.title")}</h1>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
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
            <DialogTitle>Delete Scenario</DialogTitle>
            <DialogDescription>
              {t("scenarios.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

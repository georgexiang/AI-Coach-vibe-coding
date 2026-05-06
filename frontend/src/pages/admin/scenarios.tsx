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
  useTransitionScenarioStatus,
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
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  const queryStatus = filterStatus === ALL_STATUS ? undefined : filterStatus;
  const { data: scenariosData } = useScenarios({ status: queryStatus });
  const createMutation = useCreateScenario();
  const updateMutation = useUpdateScenario();
  const deleteMutation = useDeleteScenario();
  const cloneMutation = useCloneScenario();
  const transitionMutation = useTransitionScenarioStatus();

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

  const handleArchive = (id: string) => {
    setArchiveConfirmId(id);
  };

  const confirmArchive = () => {
    if (archiveConfirmId) {
      transitionMutation.mutate(
        { id: archiveConfirmId, status: "archived" },
        {
          onSuccess: () => {
            toast.success(t("scenarios.archived", { defaultValue: "Scenario archived" }));
            setArchiveConfirmId(null);
          },
          onError: () => toast.error(t("errors.transitionFailed", { defaultValue: "Status transition failed" })),
        },
      );
    }
  };

  const handleActivate = (id: string) => {
    transitionMutation.mutate(
      { id, status: "active" },
      {
        onSuccess: () => toast.success(t("scenarios.activated", { defaultValue: "Scenario activated" })),
        onError: () => toast.error(t("errors.transitionFailed", { defaultValue: "Status transition failed" })),
      },
    );
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
              <SelectItem value="archived">{tc("archived", { defaultValue: "Archived" })}</SelectItem>
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
        onArchive={handleArchive}
        onActivate={handleActivate}
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

      <Dialog
        open={archiveConfirmId !== null}
        onOpenChange={() => setArchiveConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("scenarios.archiveTitle", { defaultValue: "Archive Scenario" })}
            </DialogTitle>
            <DialogDescription>
              {t("scenarios.archiveConfirm", { defaultValue: "This scenario will become read-only. You can still clone it to create a new draft." })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveConfirmId(null)}>
              {tc("cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={confirmArchive}>
              {tc("archive", { defaultValue: "Archive" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

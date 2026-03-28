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
import { RubricTable } from "@/components/admin/rubric-table";
import { RubricEditor } from "@/components/admin/rubric-editor";
import {
  useRubrics,
  useCreateRubric,
  useUpdateRubric,
  useDeleteRubric,
} from "@/hooks/use-rubrics";
import type { Rubric, RubricCreate, RubricUpdate } from "@/types/rubric";

const ALL_TYPE = "__all__";

export default function ScoringRubricsPage() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [filterType, setFilterType] = useState(ALL_TYPE);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const queryType = filterType === ALL_TYPE ? undefined : filterType;
  const { data: rubricsData } = useRubrics(
    queryType ? { scenario_type: queryType } : undefined,
  );
  const createMutation = useCreateRubric();
  const updateMutation = useUpdateRubric();
  const deleteMutation = useDeleteRubric();

  const rubrics = useMemo(() => rubricsData ?? [], [rubricsData]);

  const handleCreate = () => {
    setEditingRubric(null);
    setIsNew(true);
    setEditorOpen(true);
  };

  const handleEdit = (rubric: Rubric) => {
    setEditingRubric(rubric);
    setIsNew(false);
    setEditorOpen(true);
  };

  const handleSave = (data: RubricCreate) => {
    if (isNew) {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success(t("rubrics.save"));
          setEditorOpen(false);
        },
        onError: () => toast.error(t("errors.rubricSaveFailed")),
      });
    } else if (editingRubric) {
      updateMutation.mutate(
        { id: editingRubric.id, data: data as RubricUpdate },
        {
          onSuccess: () => {
            toast.success(t("rubrics.save"));
            setEditorOpen(false);
          },
          onError: () => toast.error(t("errors.rubricSaveFailed")),
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
          toast.success(t("rubrics.deleted"));
          setDeleteConfirmId(null);
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">{t("rubrics.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("rubrics.description", { defaultValue: "Define scoring dimensions, weights, and criteria for training evaluations" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPE}>{tc("all")}</SelectItem>
              <SelectItem value="f2f">{t("rubrics.f2f")}</SelectItem>
              <SelectItem value="conference">
                {t("rubrics.conference")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCreate}>
            <Plus className="size-4" />
            {t("rubrics.createButton")}
          </Button>
        </div>
      </div>

      <RubricTable
        rubrics={rubrics}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <RubricEditor
        rubric={editingRubric}
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
            <DialogTitle>{t("rubrics.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("rubrics.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

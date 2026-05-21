import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  useAllSystemEnums,
  useCreateSystemEnum,
  useUpdateSystemEnum,
  useDeleteSystemEnum,
} from "@/hooks/use-system-enums";
import type { SystemEnum, SystemEnumCreate, SystemEnumUpdate } from "@/types/system-enum";

const CATEGORIES = [
  { value: "product", label: "Products" },
  { value: "therapeutic_area", label: "Therapeutic Areas" },
  { value: "specialty", label: "Specialties" },
  { value: "difficulty", label: "Difficulties" },
];

export default function SystemEnumsPage() {
  const { t } = useTranslation("admin");
  const [selectedCategory, setSelectedCategory] = useState("product");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEnum, setEditingEnum] = useState<SystemEnum | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: allEnums, isLoading } = useAllSystemEnums();
  const createMutation = useCreateSystemEnum();
  const updateMutation = useUpdateSystemEnum();
  const deleteMutation = useDeleteSystemEnum();

  const filteredEnums = useMemo(() => {
    if (!allEnums) return [];
    return allEnums
      .filter((e) => e.category === selectedCategory)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [allEnums, selectedCategory]);

  const handleCreate = () => {
    setEditingEnum(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: SystemEnum) => {
    setEditingEnum(item);
    setDialogOpen(true);
  };

  const handleSave = (formData: SystemEnumCreate | SystemEnumUpdate) => {
    if (editingEnum) {
      updateMutation.mutate(
        { id: editingEnum.id, data: formData as SystemEnumUpdate },
        {
          onSuccess: () => {
            toast.success(t("systemEnums.updated", { defaultValue: "Enum value updated" }));
            setDialogOpen(false);
          },
          onError: () => toast.error(t("systemEnums.updateError", { defaultValue: "Failed to update" })),
        }
      );
    } else {
      createMutation.mutate(formData as SystemEnumCreate, {
        onSuccess: () => {
          toast.success(t("systemEnums.created", { defaultValue: "Enum value created" }));
          setDialogOpen(false);
        },
        onError: () => toast.error(t("systemEnums.createError", { defaultValue: "Failed to create" })),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("systemEnums.deleted", { defaultValue: "Enum value deleted" }));
        setDeleteConfirmId(null);
      },
      onError: () => toast.error(t("systemEnums.deleteError", { defaultValue: "Failed to delete" })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {t("systemEnums.title", { defaultValue: "System Enums" })}
        </h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("systemEnums.add", { defaultValue: "Add Value" })}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Label>{t("systemEnums.category", { defaultValue: "Category" })}</Label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p>{t("common.loading", { defaultValue: "Loading..." })}</p>
      ) : (
        <div className="rounded-md border">
          <div className="grid grid-cols-6 gap-4 border-b bg-muted/50 px-4 py-3 text-sm font-medium">
            <div>{t("systemEnums.value", { defaultValue: "Value" })}</div>
            <div>{t("systemEnums.labelEn", { defaultValue: "Label (EN)" })}</div>
            <div>{t("systemEnums.labelZh", { defaultValue: "Label (ZH)" })}</div>
            <div>{t("systemEnums.sortOrder", { defaultValue: "Sort Order" })}</div>
            <div>{t("systemEnums.active", { defaultValue: "Active" })}</div>
            <div>{t("systemEnums.actions", { defaultValue: "Actions" })}</div>
          </div>
          {filteredEnums.map((item) => (
            <div key={item.id} className="grid grid-cols-6 gap-4 border-b px-4 py-3 text-sm last:border-b-0">
              <div className="font-mono">{item.value}</div>
              <div>{item.label_en}</div>
              <div>{item.label_zh}</div>
              <div>{item.sort_order}</div>
              <div>{item.is_active ? "✓" : "—"}</div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {filteredEnums.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              {t("systemEnums.empty", { defaultValue: "No enum values in this category" })}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <EnumFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingEnum={editingEnum}
        category={selectedCategory}
        onSave={handleSave}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("systemEnums.confirmDelete", { defaultValue: "Confirm Delete" })}</DialogTitle>
            <DialogDescription>
              {t("systemEnums.confirmDeleteDesc", { defaultValue: "Are you sure you want to delete this enum value? This cannot be undone." })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {t("common.delete", { defaultValue: "Delete" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EnumFormDialog({
  open,
  onOpenChange,
  editingEnum,
  category,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEnum: SystemEnum | null;
  category: string;
  onSave: (data: SystemEnumCreate | SystemEnumUpdate) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation("admin");
  const [value, setValue] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [labelZh, setLabelZh] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      if (editingEnum) {
        setValue(editingEnum.value);
        setLabelEn(editingEnum.label_en);
        setLabelZh(editingEnum.label_zh);
        setSortOrder(editingEnum.sort_order);
        setIsActive(editingEnum.is_active);
      } else {
        setValue("");
        setLabelEn("");
        setLabelZh("");
        setSortOrder(0);
        setIsActive(true);
      }
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEnum) {
      onSave({ label_en: labelEn, label_zh: labelZh, sort_order: sortOrder, is_active: isActive });
    } else {
      onSave({ category, value, label_en: labelEn, label_zh: labelZh, sort_order: sortOrder, is_active: isActive });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingEnum
              ? t("systemEnums.editTitle", { defaultValue: "Edit Enum Value" })
              : t("systemEnums.createTitle", { defaultValue: "New Enum Value" })}
          </DialogTitle>
          <DialogDescription>
            {editingEnum
              ? t("systemEnums.editDesc", { defaultValue: "Update the enum value details." })
              : t("systemEnums.createDesc", { defaultValue: "Add a new configurable value." })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingEnum && (
            <div className="space-y-2">
              <Label htmlFor="enum-value">{t("systemEnums.value", { defaultValue: "Value" })}</Label>
              <Input
                id="enum-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. drug_name"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="enum-label-en">{t("systemEnums.labelEn", { defaultValue: "Label (EN)" })}</Label>
            <Input
              id="enum-label-en"
              value={labelEn}
              onChange={(e) => setLabelEn(e.target.value)}
              placeholder="English label"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enum-label-zh">{t("systemEnums.labelZh", { defaultValue: "Label (ZH)" })}</Label>
            <Input
              id="enum-label-zh"
              value={labelZh}
              onChange={(e) => setLabelZh(e.target.value)}
              placeholder="中文标签"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enum-sort-order">{t("systemEnums.sortOrder", { defaultValue: "Sort Order" })}</Label>
            <Input
              id="enum-sort-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="enum-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="enum-active">{t("systemEnums.active", { defaultValue: "Active" })}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="submit" disabled={isPending}>
              {editingEnum
                ? t("common.save", { defaultValue: "Save" })
                : t("common.create", { defaultValue: "Create" })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

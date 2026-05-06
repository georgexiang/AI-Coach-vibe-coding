import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  useSystemEnums,
  useSystemEnumCategories,
  useCreateSystemEnum,
  useUpdateSystemEnum,
  useDeleteSystemEnum,
} from "@/hooks/use-system-enums";
import type { SystemEnum, SystemEnumCreate, SystemEnumUpdate } from "@/types/system-enum";

export default function SystemEnumsPage() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SystemEnum | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Form fields
  const [formValue, setFormValue] = useState("");
  const [formLabelEn, setFormLabelEn] = useState("");
  const [formLabelZh, setFormLabelZh] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  const { data: categories = [] } = useSystemEnumCategories();
  const { data: enums = [] } = useSystemEnums(selectedCategory, false);

  const createMutation = useCreateSystemEnum();
  const updateMutation = useUpdateSystemEnum();
  const deleteMutation = useDeleteSystemEnum();

  // Auto-select first category
  const activeCategory = selectedCategory || categories[0] || "";

  const displayEnums = useMemo(() => {
    if (!selectedCategory && categories.length > 0 && !activeCategory) return [];
    return enums;
  }, [enums, selectedCategory, categories, activeCategory]);

  // Ensure we fetch for the active category
  const { data: activeCategoryEnums = [] } = useSystemEnums(
    activeCategory,
    false,
  );

  const enumList = selectedCategory ? displayEnums : activeCategoryEnums;

  function openCreateDialog() {
    setEditingItem(null);
    setFormValue("");
    setFormLabelEn("");
    setFormLabelZh("");
    setFormSortOrder(enumList.length);
    setFormIsActive(true);
    setEditorOpen(true);
  }

  function openEditDialog(item: SystemEnum) {
    setEditingItem(item);
    setFormValue(item.value);
    setFormLabelEn(item.label_en);
    setFormLabelZh(item.label_zh);
    setFormSortOrder(item.sort_order);
    setFormIsActive(item.is_active);
    setEditorOpen(true);
  }

  async function handleSave() {
    const category = selectedCategory || activeCategory;
    if (!category) return;

    if (editingItem) {
      const data: SystemEnumUpdate = {
        label_en: formLabelEn,
        label_zh: formLabelZh,
        sort_order: formSortOrder,
        is_active: formIsActive,
      };
      await updateMutation.mutateAsync({ id: editingItem.id, data });
      toast.success(t("systemEnums.saved"));
    } else {
      const data: SystemEnumCreate = {
        category,
        value: formValue,
        label_en: formLabelEn,
        label_zh: formLabelZh,
        sort_order: formSortOrder,
        is_active: formIsActive,
      };
      await createMutation.mutateAsync(data);
      toast.success(t("systemEnums.saved"));
    }
    setEditorOpen(false);
  }

  async function handleDelete() {
    if (!deleteConfirmId) return;
    await deleteMutation.mutateAsync(deleteConfirmId);
    toast.success(t("systemEnums.deleted"));
    setDeleteConfirmId(null);
  }

  function handleAddCategory() {
    if (newCategoryName.trim()) {
      setSelectedCategory(newCategoryName.trim().toLowerCase().replace(/\s+/g, "_"));
      setNewCategoryOpen(false);
      setNewCategoryName("");
      openCreateDialog();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {t("systemEnums.title")}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewCategoryOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("systemEnums.addCategory")}
          </Button>
          <Button
            onClick={openCreateDialog}
            disabled={!activeCategory && !selectedCategory}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("systemEnums.addValue")}
          </Button>
        </div>
      </div>

      {/* Category Selector */}
      <Card>
        <CardHeader>
          <CardTitle>{t("systemEnums.categories")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={
                  (selectedCategory || activeCategory) === cat
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enum Values Table */}
      <Card>
        <CardContent className="pt-6">
          {enumList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {selectedCategory || activeCategory
                ? t("systemEnums.noValues")
                : t("systemEnums.selectCategory")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">{t("systemEnums.value")}</th>
                    <th className="pb-2 font-medium">{t("systemEnums.labelEn")}</th>
                    <th className="pb-2 font-medium">{t("systemEnums.labelZh")}</th>
                    <th className="pb-2 font-medium">{t("systemEnums.sortOrder")}</th>
                    <th className="pb-2 font-medium">{t("systemEnums.active")}</th>
                    <th className="pb-2 font-medium">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {enumList.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 font-mono text-xs">{item.value}</td>
                      <td className="py-3">{item.label_en}</td>
                      <td className="py-3">{item.label_zh}</td>
                      <td className="py-3">{item.sort_order}</td>
                      <td className="py-3">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            item.is_active ? "bg-success" : "bg-muted"
                          }`}
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? t("systemEnums.editValue") : t("systemEnums.addValue")}
            </DialogTitle>
            <DialogDescription>
              {t("systemEnums.editDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("systemEnums.value")}</Label>
              <Input
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                disabled={!!editingItem}
                placeholder="e.g. oncology"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("systemEnums.labelEn")}</Label>
              <Input
                value={formLabelEn}
                onChange={(e) => setFormLabelEn(e.target.value)}
                placeholder="English label"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("systemEnums.labelZh")}</Label>
              <Input
                value={formLabelZh}
                onChange={(e) => setFormLabelZh(e.target.value)}
                placeholder="中文标签"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("systemEnums.sortOrder")}</Label>
              <Input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
              <Label>{t("systemEnums.active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formValue || !formLabelEn || createMutation.isPending || updateMutation.isPending
              }
            >
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tc("confirmDelete")}</DialogTitle>
            <DialogDescription>
              {t("systemEnums.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("systemEnums.addCategory")}</DialogTitle>
            <DialogDescription>
              {t("systemEnums.addCategoryDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. product_line"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCategoryOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
              {tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

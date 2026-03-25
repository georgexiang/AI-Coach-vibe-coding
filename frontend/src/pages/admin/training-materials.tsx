import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Upload,
  History,
  FileText,
  Pencil,
  Archive,
  ArchiveRestore,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMaterials,
  useMaterialVersions,
  useVersionChunks,
  useUploadMaterial,
  useUpdateMaterial,
  useArchiveMaterial,
  useRestoreMaterial,
} from "@/hooks/use-materials";
import type { TrainingMaterial, MaterialUpdate } from "@/types/material";
import { cn } from "@/lib/utils";

const ALL_PRODUCTS = "__all__";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TrainingMaterialsPage() {
  const { t } = useTranslation("admin");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(ALL_PRODUCTS);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  // Dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [chunksDialogOpen, setChunksDialogOpen] = useState(false);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);

  // Selected material state
  const [selectedMaterial, setSelectedMaterial] =
    useState<TrainingMaterial | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<
    string | undefined
  >();

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadProduct, setUploadProduct] = useState("");
  const [uploadTherapeuticArea, setUploadTherapeuticArea] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMaterialId, setUploadMaterialId] = useState<
    string | undefined
  >();

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editProduct, setEditProduct] = useState("");
  const [editTherapeuticArea, setEditTherapeuticArea] = useState("");
  const [editTags, setEditTags] = useState("");

  // Queries
  const queryProduct =
    selectedProduct === ALL_PRODUCTS ? undefined : selectedProduct;
  const { data: materialsData } = useMaterials({
    page,
    page_size: 20,
    product: queryProduct,
    search: searchQuery || undefined,
    include_archived: showArchived,
  });

  const { data: versions } = useMaterialVersions(
    versionsDialogOpen ? selectedMaterial?.id : undefined,
  );

  const { data: chunks } = useVersionChunks(
    chunksDialogOpen ? selectedMaterial?.id : undefined,
    chunksDialogOpen ? selectedVersionId : undefined,
  );

  // Mutations
  const uploadMutation = useUploadMaterial();
  const updateMutation = useUpdateMaterial();
  const archiveMutation = useArchiveMaterial();
  const restoreMutation = useRestoreMaterial();

  const materials = useMemo(
    () => materialsData?.items ?? [],
    [materialsData],
  );

  const totalPages = materialsData?.total_pages ?? 1;

  // Collect unique products for filter dropdown
  const uniqueProducts = useMemo(() => {
    const products = new Set<string>();
    for (const m of materials) {
      if (m.product) products.add(m.product);
    }
    return Array.from(products).sort();
  }, [materials]);

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadFile(file);
      // Auto-fill name from filename if empty
      setUploadName((prev) => prev || file.name.replace(/\.[^.]+$/, ""));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxFiles: 1,
    multiple: false,
  });

  // Handlers
  const handleOpenUpload = (materialId?: string) => {
    setUploadFile(null);
    setUploadName("");
    setUploadProduct("");
    setUploadTherapeuticArea("");
    setUploadTags("");
    setUploadProgress(0);
    setUploadMaterialId(materialId);
    setUploadDialogOpen(true);
  };

  const handleUpload = () => {
    if (!uploadFile || !uploadName || !uploadProduct) return;

    uploadMutation.mutate(
      {
        file: uploadFile,
        product: uploadProduct,
        name: uploadName,
        therapeuticArea: uploadTherapeuticArea || undefined,
        tags: uploadTags || undefined,
        materialId: uploadMaterialId,
        onProgress: setUploadProgress,
      },
      {
        onSuccess: () => {
          toast.success(t("materials.uploadSuccess"));
          setUploadDialogOpen(false);
        },
        onError: () => {
          toast.error(t("errors.materialUploadFailed"));
        },
      },
    );
  };

  const handleOpenEdit = (material: TrainingMaterial) => {
    setSelectedMaterial(material);
    setEditName(material.name);
    setEditProduct(material.product);
    setEditTherapeuticArea(material.therapeutic_area);
    setEditTags(material.tags);
    setEditDialogOpen(true);
  };

  const handleUpdateMaterial = () => {
    if (!selectedMaterial) return;

    const data: MaterialUpdate = {
      name: editName,
      product: editProduct,
      therapeutic_area: editTherapeuticArea || undefined,
      tags: editTags || undefined,
    };

    updateMutation.mutate(
      { id: selectedMaterial.id, data },
      {
        onSuccess: () => {
          toast.success(t("materials.updateSuccess"));
          setEditDialogOpen(false);
        },
        onError: () => {
          toast.error(t("errors.materialUpdateFailed"));
        },
      },
    );
  };

  const handleOpenVersions = (material: TrainingMaterial) => {
    setSelectedMaterial(material);
    setVersionsDialogOpen(true);
  };

  const handleViewChunks = (materialId: string, versionId: string) => {
    setSelectedMaterial((prev) =>
      prev?.id === materialId ? prev : { ...prev!, id: materialId },
    );
    setSelectedVersionId(versionId);
    setChunksDialogOpen(true);
  };

  const confirmArchive = () => {
    if (archiveConfirmId) {
      archiveMutation.mutate(archiveConfirmId, {
        onSuccess: () => {
          toast.success(t("materials.archive"));
          setArchiveConfirmId(null);
        },
      });
    }
  };

  const confirmRestore = () => {
    if (restoreConfirmId) {
      restoreMutation.mutate(restoreConfirmId, {
        onSuccess: () => {
          toast.success(t("materials.restore"));
          setRestoreConfirmId(null);
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t("materials.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("materials.description")}
          </p>
        </div>
        <Button onClick={() => handleOpenUpload()}>
          <Plus className="size-4" />
          {t("materials.upload")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("materials.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={selectedProduct}
          onValueChange={(v) => {
            setSelectedProduct(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("materials.filterByProduct")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PRODUCTS}>
              {t("materials.allProducts")}
            </SelectItem>
            {uniqueProducts.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={(checked) => {
              setShowArchived(checked === true);
              setPage(1);
            }}
          />
          <Label htmlFor="show-archived" className="text-sm cursor-pointer">
            {t("materials.showArchived")}
          </Label>
        </div>
      </div>

      {/* Materials Table */}
      {materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <FileText className="size-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            {t("materials.noMaterials")}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">
                    {t("materials.name")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("materials.product")}
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium md:table-cell">
                    {t("materials.therapeuticArea")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium">
                    {t("materials.version")}
                  </th>
                  <th className="px-4 py-3 text-center font-medium">
                    {t("materials.status")}
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">
                    {t("materials.uploadDate")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("materials.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr
                    key={material.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{material.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {material.product}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {material.therapeutic_area || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      v{material.current_version}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          material.is_archived ? "secondary" : "default"
                        }
                        className={cn(
                          material.is_archived
                            ? "bg-muted text-muted-foreground"
                            : "bg-green-100 text-green-800",
                        )}
                      >
                        {material.is_archived
                          ? t("materials.archived")
                          : t("materials.active")}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {formatDate(material.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("materials.viewVersions")}
                          onClick={() => handleOpenVersions(material)}
                        >
                          <History className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("materials.uploadNewVersion")}
                          onClick={() => handleOpenUpload(material.id)}
                        >
                          <Upload className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("materials.edit")}
                          onClick={() => handleOpenEdit(material)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {material.is_archived ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("materials.restore")}
                            onClick={() => setRestoreConfirmId(material.id)}
                          >
                            <ArchiveRestore className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("materials.archive")}
                            onClick={() => setArchiveConfirmId(material.id)}
                          >
                            <Archive className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {uploadMaterialId
                ? t("materials.uploadNewVersion")
                : t("materials.upload")}
            </DialogTitle>
            <DialogDescription>{t("materials.uploadHint")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
              )}
            >
              <input {...getInputProps()} />
              <Upload className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                {t("materials.uploadDescription")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("materials.uploadHint")}
              </p>
              {uploadFile && (
                <p className="mt-2 text-sm text-primary font-medium">
                  {uploadFile.name} ({formatFileSize(uploadFile.size)})
                </p>
              )}
            </div>

            {/* Upload progress */}
            {uploadMutation.isPending && (
              <div className="space-y-1">
                <Progress value={uploadProgress} />
                <p className="text-xs text-center text-muted-foreground">
                  {t("materials.uploading")} {uploadProgress}%
                </p>
              </div>
            )}

            {/* Form fields (hidden for new version upload) */}
            {!uploadMaterialId && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="upload-name">{t("materials.name")}</Label>
                  <Input
                    id="upload-name"
                    placeholder={t("materials.namePlaceholder")}
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-product">
                    {t("materials.product")}
                  </Label>
                  <Input
                    id="upload-product"
                    placeholder={t("materials.productPlaceholder")}
                    value={uploadProduct}
                    onChange={(e) => setUploadProduct(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-ta">
                    {t("materials.therapeuticArea")}
                  </Label>
                  <Input
                    id="upload-ta"
                    placeholder={t("materials.therapeuticAreaPlaceholder")}
                    value={uploadTherapeuticArea}
                    onChange={(e) => setUploadTherapeuticArea(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload-tags">{t("materials.tags")}</Label>
                  <Input
                    id="upload-tags"
                    placeholder={t("materials.tagsPlaceholder")}
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                !uploadFile ||
                (!uploadMaterialId && (!uploadName || !uploadProduct)) ||
                uploadMutation.isPending
              }
            >
              {uploadMutation.isPending
                ? t("materials.uploading")
                : t("materials.upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("materials.edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("materials.name")}</Label>
              <Input
                id="edit-name"
                placeholder={t("materials.namePlaceholder")}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-product">{t("materials.product")}</Label>
              <Input
                id="edit-product"
                placeholder={t("materials.productPlaceholder")}
                value={editProduct}
                onChange={(e) => setEditProduct(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ta">{t("materials.therapeuticArea")}</Label>
              <Input
                id="edit-ta"
                placeholder={t("materials.therapeuticAreaPlaceholder")}
                value={editTherapeuticArea}
                onChange={(e) => setEditTherapeuticArea(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tags">{t("materials.tags")}</Label>
              <Input
                id="edit-tags"
                placeholder={t("materials.tagsPlaceholder")}
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateMaterial}
              disabled={!editName || !editProduct || updateMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={versionsDialogOpen} onOpenChange={setVersionsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t("materials.versions")} - {selectedMaterial?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {!versions || versions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("materials.noVersions")}
              </p>
            ) : (
              <div className="space-y-2">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          v{version.version_number}
                        </span>
                        {version.is_active && (
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800"
                          >
                            {t("materials.active")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {version.filename} /{" "}
                        {formatFileSize(version.file_size)} /{" "}
                        {formatDate(version.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleViewChunks(selectedMaterial!.id, version.id)
                      }
                    >
                      <Eye className="size-4" />
                      {t("materials.viewChunks")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Chunks Dialog */}
      <Dialog open={chunksDialogOpen} onOpenChange={setChunksDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("materials.chunks")}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[500px]">
            {!chunks || chunks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("materials.noChunks")}
              </p>
            ) : (
              <div className="space-y-3">
                {chunks.map((chunk) => (
                  <div key={chunk.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        {t("materials.chunkIndex")} #{chunk.chunk_index}
                      </Badge>
                      {chunk.page_label && (
                        <Badge variant="secondary">
                          {t("materials.pageLabel")}: {chunk.page_label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={archiveConfirmId !== null}
        onOpenChange={() => setArchiveConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("materials.archive")}</DialogTitle>
            <DialogDescription>
              {t("materials.archiveConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveConfirmId(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmArchive}>
              {t("materials.archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={restoreConfirmId !== null}
        onOpenChange={() => setRestoreConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("materials.restore")}</DialogTitle>
            <DialogDescription>
              {t("materials.restoreConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreConfirmId(null)}
            >
              Cancel
            </Button>
            <Button onClick={confirmRestore}>{t("materials.restore")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

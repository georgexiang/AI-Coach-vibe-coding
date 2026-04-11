import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Presentation, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;
const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
};

interface SkillMaterialUploaderProps {
  onUpload: (files: File[]) => void;
  isUploading?: boolean;
  acceptedTypes?: string[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pptx" || ext === "ppt") return Presentation;
  if (ext === "pdf" || ext === "docx" || ext === "doc" || ext === "txt" || ext === "md")
    return FileText;
  return File;
}

export function SkillMaterialUploader({
  onUpload,
  isUploading = false,
}: SkillMaterialUploaderProps) {
  const { t } = useTranslation("skill");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setSelectedFiles((prev) => {
        const combined = [...prev, ...acceptedFiles];
        // Deduplicate by name + size
        const seen = new Set<string>();
        const deduped: File[] = [];
        for (const file of combined) {
          const key = `${file.name}:${file.size}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(file);
          }
        }
        return deduped.slice(0, MAX_FILES);
      });
    },
    [],
  );

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(() => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
    }
  }, [selectedFiles, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    multiple: true,
    disabled: isUploading,
  });

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all duration-150",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-primary/5",
          isUploading && "pointer-events-none opacity-50",
        )}
      >
        <input {...getInputProps()} />
        <Upload className="size-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">
          {t("editor.dropzoneTitle", {
            defaultValue: "Drop training materials here, or click to browse",
          })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("editor.dropzoneHint", {
            defaultValue:
              "Accepts PDF, DOCX, PPTX, TXT, MD. Max 50MB per file, up to 10 files.",
          })}
        </p>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t("editor.selectedFiles", {
              defaultValue: "Selected files ({{count}})",
              count: selectedFiles.length,
            })}
          </p>
          <div className="rounded-lg border border-border divide-y divide-border">
            {selectedFiles.map((file, index) => {
              const Icon = getFileIcon(file.name);
              return (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    disabled={isUploading}
                  >
                    <X className="size-3.5" />
                    <span className="sr-only">
                      {t("editor.removeFile", { defaultValue: "Remove" })}
                    </span>
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Upload className="mr-2 size-4 animate-pulse" />
                {t("editor.uploading", { defaultValue: "Uploading..." })}
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" />
                {t("editor.uploadAndConvert", {
                  defaultValue: "Upload and Convert",
                })}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import {
  Upload,
  FileText,
  Eye,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";

interface FileVersion {
  version: string;
  date: string;
  uploadedBy: string;
}

interface FileItem {
  id: string;
  name: string;
  type: "PDF" | "Word" | "Excel";
  size: string;
  uploadedDate: string;
  uploadedBy: string;
  version: string;
  versions: FileVersion[];
}

const mockFiles: FileItem[] = [
  {
    id: "1",
    name: "PD-1 Phase III Results.pdf",
    type: "PDF",
    size: "2.4MB",
    uploadedDate: "Mar 20",
    uploadedBy: "Admin",
    version: "v3",
    versions: [
      { version: "v3", date: "Mar 20, 2026", uploadedBy: "Admin" },
      { version: "v2", date: "Mar 15, 2026", uploadedBy: "Admin" },
      { version: "v1", date: "Mar 10, 2026", uploadedBy: "Admin" },
    ],
  },
  {
    id: "2",
    name: "Safety Profile Summary.docx",
    type: "Word",
    size: "580KB",
    uploadedDate: "Mar 18",
    uploadedBy: "Admin",
    version: "v2",
    versions: [
      { version: "v2", date: "Mar 18, 2026", uploadedBy: "Admin" },
      { version: "v1", date: "Mar 12, 2026", uploadedBy: "Admin" },
    ],
  },
  {
    id: "3",
    name: "Market Analysis Report.xlsx",
    type: "Excel",
    size: "1.2MB",
    uploadedDate: "Mar 17",
    uploadedBy: "Admin",
    version: "v1",
    versions: [{ version: "v1", date: "Mar 17, 2026", uploadedBy: "Admin" }],
  },
  {
    id: "4",
    name: "Clinical Trial Protocol.pdf",
    type: "PDF",
    size: "3.1MB",
    uploadedDate: "Mar 15",
    uploadedBy: "Admin",
    version: "v4",
    versions: [
      { version: "v4", date: "Mar 15, 2026", uploadedBy: "Admin" },
      { version: "v3", date: "Mar 10, 2026", uploadedBy: "Admin" },
      { version: "v2", date: "Mar 5, 2026", uploadedBy: "Admin" },
      { version: "v1", date: "Mar 1, 2026", uploadedBy: "Admin" },
    ],
  },
  {
    id: "5",
    name: "Patient Information Sheet.docx",
    type: "Word",
    size: "450KB",
    uploadedDate: "Mar 14",
    uploadedBy: "Admin",
    version: "v2",
    versions: [
      { version: "v2", date: "Mar 14, 2026", uploadedBy: "Admin" },
      { version: "v1", date: "Mar 8, 2026", uploadedBy: "Admin" },
    ],
  },
  {
    id: "6",
    name: "Competitive Analysis.xlsx",
    type: "Excel",
    size: "890KB",
    uploadedDate: "Mar 12",
    uploadedBy: "Admin",
    version: "v1",
    versions: [{ version: "v1", date: "Mar 12, 2026", uploadedBy: "Admin" }],
  },
];

interface FileListProps {
  folderName: string;
}

export default function FileList({ folderName }: FileListProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  const toggleFileExpansion = (fileId: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  const getFileIcon = (type: string) => {
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      PDF: "bg-red-100 text-red-700",
      Word: "bg-blue-100 text-blue-700",
      Excel: "bg-green-100 text-green-700",
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${colors[type as keyof typeof colors]}`}
      >
        {type}
      </span>
    );
  };

  return (
    <div className="flex-1 bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{folderName}</h2>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="w-4 h-4 mr-2" />
            Upload Files
          </Button>
        </div>

        {/* Drag and Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-gray-50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            Drag and drop files here, or click Upload Files
          </p>
        </div>
      </div>

      {/* File Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Uploaded Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Uploaded By
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Version
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mockFiles.map((file) => {
              const isExpanded = expandedFiles.has(file.id);
              return (
                <>
                  <tr
                    key={file.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleFileExpansion(file.id)}
                  >
                    <td className="px-4 py-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getFileIcon(file.type)}
                        <span className="text-sm text-gray-900">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(file.type)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{file.size}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{file.uploadedDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{file.uploadedBy}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{file.version}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="p-1 hover:bg-gray-100 rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          className="p-1 hover:bg-gray-100 rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          className="p-1 hover:bg-gray-100 rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="px-4 py-3 bg-gray-50">
                        <div className="ml-8">
                          <h4 className="text-xs font-medium text-gray-700 mb-2">
                            Version History
                          </h4>
                          <div className="space-y-1">
                            {file.versions.map((version) => (
                              <div
                                key={version.version}
                                className="flex items-center gap-4 text-xs text-gray-600 py-1"
                              >
                                <span className="font-medium">{version.version}</span>
                                <span>{version.date}</span>
                                <span>by {version.uploadedBy}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

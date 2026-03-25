import { Folder, ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";

interface FolderNode {
  id: string;
  name: string;
  children?: FolderNode[];
}

const folderStructure: FolderNode = {
  id: "root",
  name: "Training Materials",
  children: [
    {
      id: "by-product",
      name: "By Product",
      children: [
        { id: "pd1", name: "PD-1 Inhibitor" },
        { id: "btk", name: "BTK Inhibitor" },
      ],
    },
    {
      id: "by-therapeutic",
      name: "By Therapeutic Area",
      children: [
        { id: "oncology", name: "Oncology" },
        { id: "hematology", name: "Hematology" },
      ],
    },
  ],
};

interface FolderTreeProps {
  onSelectFolder: (folderId: string, folderName: string) => void;
  selectedFolderId: string;
}

export default function FolderTree({ onSelectFolder, selectedFolderId }: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["root", "by-product", "by-therapeutic"])
  );

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderNode = (node: FolderNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedFolderId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg transition-colors ${
            isSelected ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50"
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleFolder(node.id);
            }
            onSelectFolder(node.id, node.name);
          }}
        >
          {hasChildren && (
            <div className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </div>
          )}
          {!hasChildren && <div className="w-4" />}
          <Folder className={`w-4 h-4 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
          <span className="text-sm">{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children?.map((child) => renderNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      {renderNode(folderStructure)}
    </div>
  );
}

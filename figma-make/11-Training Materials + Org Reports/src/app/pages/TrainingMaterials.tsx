import { useState } from "react";
import { Info } from "lucide-react";
import FolderTree from "../components/FolderTree";
import FileList from "../components/FileList";

export default function TrainingMaterials() {
  const [selectedFolder, setSelectedFolder] = useState({
    id: "pd1",
    name: "PD-1 Inhibitor",
  });

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex gap-6 h-[calc(100vh-180px)]">
        {/* Left Panel - Folder Tree */}
        <div className="w-[300px] flex-shrink-0">
          <FolderTree
            onSelectFolder={(id, name) => setSelectedFolder({ id, name })}
            selectedFolderId={selectedFolder.id}
          />
        </div>

        {/* Right Panel - File List */}
        <FileList folderName={selectedFolder.name} />
      </div>

      {/* Retention Policy Banner */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-900">
            <span className="font-medium">Retention Policy:</span> Voice records auto-delete after 90 days
          </p>
        </div>
      </div>
    </div>
  );
}

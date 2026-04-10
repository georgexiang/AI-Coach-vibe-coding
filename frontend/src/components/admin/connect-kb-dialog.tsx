import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useSearchConnections,
  useSearchIndexes,
  useAddKnowledgeConfig,
} from "@/hooks/use-knowledge-base";

interface ConnectKbDialogProps {
  hcpId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectKbDialog({
  hcpId,
  open,
  onOpenChange,
}: ConnectKbDialogProps) {
  const { t } = useTranslation("admin");
  const [selectedConnection, setSelectedConnection] = useState("");
  const [selectedIndex, setSelectedIndex] = useState("");

  const { data: connections, isLoading: connectionsLoading } =
    useSearchConnections();
  const { data: indexes, isLoading: indexesLoading } = useSearchIndexes();
  const addConfigMutation = useAddKnowledgeConfig();

  const selectedConnectionObj = connections?.find(
    (c) => c.name === selectedConnection,
  );

  const handleConnect = () => {
    if (!selectedConnection || !selectedIndex || !selectedConnectionObj) return;

    addConfigMutation.mutate(
      {
        hcpId,
        data: {
          connection_name: selectedConnection,
          connection_target: selectedConnectionObj.target,
          index_name: selectedIndex,
        },
      },
      {
        onSuccess: () => {
          setSelectedConnection("");
          setSelectedIndex("");
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedConnection("");
      setSelectedIndex("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("hcp.connectToFoundryIQ")}</DialogTitle>
          <DialogDescription>
            {t("hcp.knowledgeDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1: Select Connection */}
          <div className="space-y-2">
            <Label>{t("hcp.selectConnection")}</Label>
            <Select
              value={selectedConnection}
              onValueChange={setSelectedConnection}
              disabled={connectionsLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    connectionsLoading
                      ? "Loading..."
                      : t("hcp.selectConnection")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {connections?.map((conn) => (
                  <SelectItem key={conn.name} value={conn.name}>
                    {conn.name}
                    {conn.is_default ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select Knowledge Base / Index */}
          <div className="space-y-2">
            <Label>{t("hcp.selectKnowledgeBase")}</Label>
            <Select
              value={selectedIndex}
              onValueChange={setSelectedIndex}
              disabled={indexesLoading || !selectedConnection}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    indexesLoading
                      ? "Loading..."
                      : t("hcp.selectKnowledgeBase")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {indexes?.map((idx) => (
                  <SelectItem key={idx.name} value={idx.name}>
                    {idx.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("hcp.cancelButton")}
          </Button>
          <Button
            onClick={handleConnect}
            disabled={
              !selectedConnection ||
              !selectedIndex ||
              addConfigMutation.isPending
            }
          >
            {addConfigMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            {t("hcp.connectButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

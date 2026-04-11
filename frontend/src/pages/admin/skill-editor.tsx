import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SkillEditorPage() {
  const { t } = useTranslation("skill");
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/skills")}
        >
          <ArrowLeft className="size-4" />
          {t("editor.backToHub")}
        </Button>
      </div>
      <div className="flex items-center justify-center rounded-lg border bg-muted/50 py-24 text-muted-foreground">
        {t("editor.title")}
      </div>
    </div>
  );
}

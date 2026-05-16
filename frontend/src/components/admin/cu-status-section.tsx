import { useTranslation } from "react-i18next";
import { ExternalLink, Brain, FileAudio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCuPortalUrl } from "@/hooks/use-rubrics";

interface CuStatusSectionProps {
  rubricId: string | undefined;
}

export function CuStatusSection({ rubricId }: CuStatusSectionProps) {
  const { t } = useTranslation(["admin"]);
  const { data: cuInfo, isLoading } = useCuPortalUrl(rubricId);

  if (!rubricId || isLoading) return null;

  const hasContentAnalyzer = !!cuInfo?.cu_content_analyzer_id;
  const hasVoiceAnalyzer = !!cuInfo?.cu_voice_analyzer_id;

  if (!hasContentAnalyzer && !hasVoiceAnalyzer) {
    return (
      <Card className="border bg-muted/50 border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Brain className="size-5" />
            {t("admin:rubrics.cuAnalyzers")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("admin:rubrics.cuNoAnalyzers")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const portalUrl = cuInfo?.content_analyzer_url ?? cuInfo?.voice_analyzer_url;

  return (
    <Card className="border bg-blue-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Brain className="size-5" />
          {t("admin:rubrics.cuAnalyzers")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasContentAnalyzer && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-blue-600" />
              <Label className="text-sm font-medium">
                {t("admin:rubrics.cuContentAnalyzer")}
              </Label>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm font-mono bg-background/80 rounded px-2 py-1 truncate border">
                  {cuInfo.cu_content_analyzer_id}
                </p>
              </TooltipTrigger>
              <TooltipContent>{cuInfo.cu_content_analyzer_id}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {hasVoiceAnalyzer && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileAudio className="size-4 text-purple-600" />
              <Label className="text-sm font-medium">
                {t("admin:rubrics.cuVoiceAnalyzer")}
              </Label>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm font-mono bg-background/80 rounded px-2 py-1 truncate border">
                  {cuInfo.cu_voice_analyzer_id}
                </p>
              </TooltipTrigger>
              <TooltipContent>{cuInfo.cu_voice_analyzer_id}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {cuInfo?.cu_endpoint && (
          <div className="pt-2 border-t">
            <Label className="text-xs text-muted-foreground">
              {t("admin:rubrics.cuEndpoint")}
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs font-mono text-muted-foreground truncate">
                  {cuInfo.cu_endpoint}
                </p>
              </TooltipTrigger>
              <TooltipContent>{cuInfo.cu_endpoint}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {portalUrl && (
          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() =>
                window.open(portalUrl, "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink className="size-3.5 mr-1.5" />
              {t("admin:rubrics.cuViewInPortal")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

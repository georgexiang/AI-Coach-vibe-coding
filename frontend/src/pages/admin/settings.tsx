import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Shield, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminSettingsPage() {
  const { t } = useTranslation("admin");
  const [defaultLanguage, setDefaultLanguage] = useState("zh-CN");
  const [retentionDays, setRetentionDays] = useState("90");
  const [darkMode, setDarkMode] = useState(false);
  const [orgName, setOrgName] = useState("BeiGene");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">
          {t("settings.title", { defaultValue: "System Settings" })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.description", { defaultValue: "Configure platform-wide settings" })}
        </p>
      </div>

      <div className="grid gap-6">
        {/* Language Settings */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Globe className="size-5 text-primary" />
              {t("settings.language", { defaultValue: "Language & Region" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("settings.defaultLanguage", { defaultValue: "Default Language" })}
              </Label>
              <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Shield className="size-5 text-primary" />
              {t("settings.dataRetention", { defaultValue: "Data Retention" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("settings.voiceRetention", { defaultValue: "Voice Recording Retention (days)" })}
              </Label>
              <Input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-[240px]"
              />
              <p className="text-xs text-muted-foreground">
                {t("settings.voiceRetentionHint", {
                  defaultValue: "Voice recordings older than this will be automatically deleted",
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card className="bg-card rounded-lg border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Palette className="size-5 text-primary" />
              {t("settings.branding", { defaultValue: "Branding" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("settings.orgName", { defaultValue: "Organization Name" })}
              </Label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-[320px]"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              <Label className="text-sm">
                {t("settings.darkMode", { defaultValue: "Dark Mode" })}
              </Label>
            </div>
          </CardContent>
        </Card>

        <Button className="w-fit">
          {t("settings.save", { defaultValue: "Save Settings" })}
        </Button>
      </div>
    </div>
  );
}

import { ChevronLeft, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

interface LeftPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  keyMessages: { id: string; text: string; checked: boolean }[];
  onToggleKeyMessage: (id: string) => void;
}

export function LeftPanel({
  isCollapsed,
  onToggleCollapse,
  keyMessages,
  onToggleKeyMessage,
}: LeftPanelProps) {
  if (isCollapsed) {
    return (
      <div className="w-12 bg-slate-50 border-r border-slate-200 flex flex-col items-center pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="rotate-180"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[280px] bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold">Training Panel</h2>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Scenario Briefing */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Scenario Briefing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Product:</span>
            <p className="text-slate-600">PD-1 Inhibitor</p>
          </div>
          <div>
            <span className="font-medium">Context:</span>
            <p className="text-slate-600 text-xs">
              Initial visit with Dr. Wang to introduce new Phase III trial data
              for our PD-1 inhibitor. Focus on efficacy and safety advantages
              over current standards of care.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* HCP Profile */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">HCP Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-[60px] w-[60px]">
              <AvatarImage src="" />
              <AvatarFallback className="bg-blue-100 text-blue-700">
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-sm">
              <p className="font-semibold">Dr. Wang Wei</p>
              <p className="text-slate-600 text-xs">Oncologist</p>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div>
              <span className="font-medium">Personality:</span>
              <p className="text-slate-600">Skeptical, Detail-oriented</p>
            </div>
            <div>
              <span className="font-medium">Background:</span>
              <p className="text-slate-600">
                Prefers evidence-based data, concerned about side effects
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Messages */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Key Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {keyMessages.map((message) => (
            <div key={message.id} className="flex items-start gap-2">
              <Checkbox
                id={message.id}
                checked={message.checked}
                onCheckedChange={() => onToggleKeyMessage(message.id)}
                className="mt-0.5"
              />
              <label
                htmlFor={message.id}
                className="text-xs text-slate-700 cursor-pointer leading-tight"
              >
                {message.text}
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Scoring Criteria */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Scoring Criteria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Key Message:</span>
            <span className="font-medium">30%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Objection Handling:</span>
            <span className="font-medium">25%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Communication:</span>
            <span className="font-medium">20%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Product Knowledge:</span>
            <span className="font-medium">15%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Scientific:</span>
            <span className="font-medium">10%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { ChevronRight, Check, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

interface MessageStatus {
  id: string;
  text: string;
  status: "delivered" | "in-progress" | "pending";
}

interface RightPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  messageStatuses: MessageStatus[];
  sessionTime: string;
  wordCount: number;
}

export function RightPanel({
  isCollapsed,
  onToggleCollapse,
  messageStatuses,
  sessionTime,
  wordCount,
}: RightPanelProps) {
  if (isCollapsed) {
    return (
      <div className="w-12 bg-slate-50 border-l border-slate-200 flex flex-col items-center pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="rotate-180"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[260px] bg-slate-50 border-l border-slate-200 p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold">Coaching Panel</h2>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* AI Coach Hints */}
      <Card className="mb-4 bg-yellow-50 border-yellow-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">AI Coach Hints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-700">
          <p className="leading-tight">
            💡 Consider mentioning the Phase III overall survival data
          </p>
          <p className="leading-tight">
            💡 Dr. Wang values specific numbers — use statistics
          </p>
        </CardContent>
      </Card>

      {/* Message Tracker */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Message Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {messageStatuses.map((message) => (
            <div key={message.id} className="flex items-start gap-2 text-xs">
              {message.status === "delivered" && (
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              )}
              {message.status === "in-progress" && (
                <div className="h-4 w-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                </div>
              )}
              {message.status === "pending" && (
                <Circle className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              )}
              <span
                className={
                  message.status === "delivered"
                    ? "text-green-700"
                    : message.status === "in-progress"
                    ? "text-blue-700"
                    : "text-slate-500"
                }
              >
                {message.text}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Session Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Duration:</span>
            <span className="font-medium">{sessionTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Word Count:</span>
            <span className="font-medium">{wordCount}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

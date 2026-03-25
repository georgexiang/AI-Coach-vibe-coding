import { ScrollArea } from "@/components/ui";
import { AudienceCard } from "./audience-card";
import type { AudienceHcp } from "@/types/conference";

interface AudiencePanelProps {
  hcps: AudienceHcp[];
}

export function AudiencePanel({ hcps }: AudiencePanelProps) {
  return (
    <section
      role="region"
      aria-label="audience"
      className="h-[120px] border-t bg-muted"
    >
      <ScrollArea className="h-full">
        <div className="flex flex-row gap-4 overflow-x-auto p-4">
          {hcps.map((hcp) => (
            <AudienceCard key={hcp.id} hcp={hcp} />
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

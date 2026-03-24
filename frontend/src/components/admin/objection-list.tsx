import { useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ObjectionListProps {
  items: string[];
  onChange: (items: string[]) => void;
  label: string;
  addLabel: string;
}

export function ObjectionList({
  items,
  onChange,
  label,
  addLabel,
}: ObjectionListProps) {
  const lastInputRef = useRef<HTMLInputElement>(null);
  const justAdded = useRef(false);

  useEffect(() => {
    if (justAdded.current && lastInputRef.current) {
      lastInputRef.current.focus();
      justAdded.current = false;
    }
  }, [items.length]);

  const handleAdd = () => {
    justAdded.current = true;
    onChange([...items, ""]);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              ref={index === items.length - 1 ? lastInputRef : undefined}
              value={item}
              onChange={(e) => handleChange(index, e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemove(index)}
              aria-label="Remove item"
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-fit"
      >
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}

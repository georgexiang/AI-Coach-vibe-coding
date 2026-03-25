import { LucideIcon } from "lucide-react";

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: "blue" | "purple";
  onStart: () => void;
}

export function ActionCard({ title, description, icon: Icon, gradient, onStart }: ActionCardProps) {
  const gradientClasses = {
    blue: "bg-gradient-to-br from-blue-500 to-blue-600",
    purple: "bg-gradient-to-br from-purple-500 to-purple-600",
  };

  return (
    <div className={`${gradientClasses[gradient]} rounded-lg p-6 text-white relative overflow-hidden`}>
      <div className="absolute top-0 right-0 opacity-10">
        <Icon className="w-32 h-32" strokeWidth={1} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        
        <p className="text-white/90 text-sm mb-4">
          {description}
        </p>
        
        <button
          onClick={onStart}
          className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        >
          Start
        </button>
      </div>
    </div>
  );
}

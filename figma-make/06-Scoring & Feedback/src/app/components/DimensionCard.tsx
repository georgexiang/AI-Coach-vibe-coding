interface DimensionCardProps {
  name: string;
  score: number;
}

export function DimensionCard({ name, score }: DimensionCardProps) {
  const getColor = (score: number) => {
    if (score > 80) return 'bg-green-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-700">{name}</span>
        <span className="font-semibold text-gray-900">{score}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(score)} transition-all duration-1000 ease-out`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

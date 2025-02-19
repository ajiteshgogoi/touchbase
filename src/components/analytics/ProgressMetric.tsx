import { memo } from 'react';

interface ProgressMetricProps {
  label: string;
  value: number;
  total: number;
}

export const ProgressMetric = memo(({ label, value, total }: ProgressMetricProps) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-medium text-gray-900">{percentage}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
});

ProgressMetric.displayName = 'ProgressMetric';
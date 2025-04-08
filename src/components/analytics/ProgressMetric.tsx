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
        <div className="flex justify-between mb-1.5">
          <span className="text-[15px] font-[450] text-gray-600/90 dark:text-gray-400">{label}</span>
          <span className="text-[15px] font-[600] text-gray-900/90 dark:text-white">{percentage}%</span>
        </div>
        <div className="h-2.5 bg-gray-100/90 dark:bg-gray-800/90 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500/90 dark:bg-primary-400/90 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
});

ProgressMetric.displayName = 'ProgressMetric';
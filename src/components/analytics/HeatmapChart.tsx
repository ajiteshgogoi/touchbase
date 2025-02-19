import { useMemo } from 'react';
import dayjs from 'dayjs/esm';

interface HeatmapProps {
  data: { date: string; count: number }[];
}

export const HeatmapChart = ({ data }: HeatmapProps) => {
  // Group by month for labels
  const months = useMemo(() => {
    const monthGroups = new Map<string, { total: number; days: number }>();
    data.forEach(({ date, count }) => {
      const month = date.substring(0, 7); // YYYY-MM
      const curr = monthGroups.get(month) || { total: 0, days: 0 };
      monthGroups.set(month, {
        total: curr.total + count,
        days: curr.days + 1
      });
    });
    return Array.from(monthGroups.entries()).map(([month, stats]) => ({
      month,
      average: stats.total / stats.days
    }));
  }, [data]);

  // Calculate color intensity based on count
  const maxCount = useMemo(() => Math.max(...data.map(d => d.count)), [data]);
  
  const getColor = useMemo(() => (count: number) => {
    if (count === 0) return 'bg-gray-100';
    const intensity = Math.min(0.9, (count / maxCount) * 0.9);
    return `bg-primary-${Math.round(intensity * 500)}`;
  }, [maxCount]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[600px]">
        <div className="flex justify-between mb-2">
          {months.map(({ month }) => (
            <div key={month} className="text-xs text-gray-500">
              {dayjs(month).format('MMM')}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(180,1fr)] gap-1">
          {data.map(({ date, count }) => (
            <div
              key={date}
              className={`w-3 h-3 rounded-sm ${getColor(count)}`}
              title={`${date}: ${count} interactions`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
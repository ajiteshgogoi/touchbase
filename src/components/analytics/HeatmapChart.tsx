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
    if (count === 0) return 'bg-gray-100/90 hover:bg-gray-200/90';
    const intensity = Math.min(0.9, (count / maxCount) * 0.9);
    const baseColor = 'bg-primary';
    const opacity = '/90';
    const hoverClass = intensity > 0.5 
      ? ` hover:bg-primary-${Math.round((intensity + 0.1) * 500)}${opacity}`
      : ` hover:bg-primary-${Math.round((intensity + 0.2) * 500)}${opacity}`;
    return `${baseColor}-${Math.round(intensity * 500)}${opacity}${hoverClass}`;
  }, [maxCount]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[600px]">
        <div className="flex justify-between mb-3">
          {months.map(({ month }) => (
            <div key={month} className="text-[13px] font-[450] text-gray-600/90">
              {dayjs(month).format('MMM')}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(180,1fr)] gap-1">
          {data.map(({ date, count }) => (
            <div
              key={date}
              className={`w-3.5 h-3.5 rounded-lg transition-colors duration-200 cursor-default ${getColor(count)}`}
              title={`${dayjs(date).format('MMM D, YYYY')}: ${count} interaction${count !== 1 ? 's' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
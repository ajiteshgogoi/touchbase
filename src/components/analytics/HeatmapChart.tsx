import { useMemo } from 'react';
import dayjs from 'dayjs/esm';

interface HeatmapProps {
  data: { date: string; count: number }[];
}

export const HeatmapChart = ({ data }: HeatmapProps) => {
  const endDate = dayjs();

  // Calculate color intensity based on count
  const maxCount = useMemo(() => Math.max(...data.map(d => d.count)), [data]);
  
  const getColor = useMemo(() => (count: number) => {
    if (count === 0) return 'bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30';
    
    const ratio = count / maxCount;
    if (ratio <= 0.25) {
      return 'bg-primary-200 dark:bg-primary-800/60 hover:bg-primary-300 dark:hover:bg-primary-700/60';
    } else if (ratio <= 0.5) {
      return 'bg-primary-400 dark:bg-primary-600/60 hover:bg-primary-500 dark:hover:bg-primary-500/60';
    } else if (ratio <= 0.75) {
      return 'bg-primary-500 dark:bg-primary-500/70 hover:bg-primary-600 dark:hover:bg-primary-400/70';
    } else {
      return 'bg-primary-600 dark:bg-primary-400/80 hover:bg-primary-700 dark:hover:bg-primary-300/80';
    }
  }, [maxCount]);

  return (
    <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark p-6">
      <h3 className="text-xl font-[600] text-gray-900 dark:text-white mb-6">
        {data.reduce((sum, item) => sum + item.count, 0).toLocaleString()} interactions in the last year
      </h3>
      <div className="overflow-x-auto pt-8 pb-2 px-2">
        <div className="flex">
          {/* Day labels */}
          <div className="flex flex-col h-[94px] pr-4">
            <div className="h-[32px]" /> {/* Spacer for month labels */}
            <div className="grid" style={{ gridTemplateRows: 'repeat(7, 10px)', gap: '4px', alignContent: 'space-between' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-[11px] font-[450] text-gray-500/90 dark:text-gray-400 h-[10px] leading-[10px]">
                  {day}
                </div>
              ))}
            </div>
          </div>
          
          {/* Heatmap grid with month labels */}
          <div className="flex gap-[4px]">
            {Array.from({ length: 12 }).map((_, monthIndex) => {
              const monthStart = endDate.subtract(11 - monthIndex, 'month').startOf('month');
              const monthEnd = monthStart.endOf('month');
              const weekStart = monthStart.startOf('week').subtract(1, 'day');
              const weeksInMonth = Math.ceil(monthEnd.diff(weekStart, 'week', true));

              return (
                <div key={monthIndex} className="relative">
                  {/* Month label */}
                  <div className="absolute -top-[32px] text-[13px] font-[450] text-gray-600/90 dark:text-gray-400">
                    {monthStart.format('MMM')}
                  </div>
                  
                  {/* Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${weeksInMonth}, 13px)`,
                      gridTemplateRows: 'repeat(7, 10px)',
                      gap: '4px',
                      height: '82px'
                    }}
                  >
                    {Array.from({ length: weeksInMonth * 7 }).map((_, dayIndex) => {
                      const currentDate = weekStart.add(Math.floor(dayIndex / 7), 'week').add(dayIndex % 7, 'day');
                      const isWithinMonth = currentDate.month() === monthStart.month();
                      const dataPoint = data.find(d => d.date === currentDate.format('YYYY-MM-DD'));

                      return (
                        <div
                          key={dayIndex}
                          className={`w-[10px] h-[10px] rounded-sm transition-colors duration-200 cursor-default
                            ${!isWithinMonth ? 'invisible' : getColor(dataPoint?.count || 0)}`}
                          title={dataPoint && isWithinMonth
                            ? `${currentDate.format('MMM D, YYYY')}: ${dataPoint.count} interaction${dataPoint.count !== 1 ? 's' : ''}`
                            : isWithinMonth ? `${currentDate.format('MMM D, YYYY')}: 0 interactions` : ''
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
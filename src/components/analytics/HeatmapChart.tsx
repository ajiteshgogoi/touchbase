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
    if (count === 0) return 'bg-primary-50 hover:bg-primary-100';
    
    const ratio = count / maxCount;
    if (ratio <= 0.25) {
      return 'bg-primary-200 hover:bg-primary-300';
    } else if (ratio <= 0.5) {
      return 'bg-primary-400 hover:bg-primary-500';
    } else if (ratio <= 0.75) {
      return 'bg-primary-500 hover:bg-primary-600';
    } else {
      return 'bg-primary-600 hover:bg-primary-700';
    }
  }, [maxCount]);

  return (
    <div className="overflow-x-auto pb-4 pt-4">
      <div className="min-w-[800px] pt-1">
        <div className="flex">
          {/* Day labels */}
          <div className="flex flex-col justify-between h-[100px] pr-4">
            <div className="h-[20px]" /> {/* Spacer for month labels */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-[11px] font-[450] text-gray-500/90 h-[10px] leading-[10px]">
                {day}
              </div>
            ))}
          </div>
          
          {/* Heatmap grid with month labels */}
          <div className="flex gap-[4px]">
            {Array.from({ length: 12 }).map((_, monthIndex) => {
              const monthStart = endDate.subtract(11 - monthIndex, 'month').startOf('month');
              const monthEnd = monthStart.endOf('month');
              const weekStart = monthStart.startOf('week');
              const weeksInMonth = Math.ceil(monthEnd.diff(weekStart, 'week', true));

              return (
                <div key={monthIndex} className="relative">
                  {/* Month label */}
                  <div className="absolute -top-[20px] text-[13px] font-[450] text-gray-600/90">
                    {monthStart.format('MMM')}
                  </div>
                  
                  {/* Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${weeksInMonth}, 13px)`,
                      gridTemplateRows: 'repeat(7, 10px)',
                      gap: '4px'
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
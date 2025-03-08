import { useMemo } from 'react';
import dayjs from 'dayjs/esm';

interface HeatmapProps {
  data: { date: string; count: number }[];
}

export const HeatmapChart = ({ data }: HeatmapProps) => {
  // Calculate start and end dates
  const endDate = dayjs();
  const startDate = endDate.subtract(6, 'months').startOf('week');
  const totalWeeks = Math.ceil(endDate.diff(startDate, 'week', true));

  // Calculate month label positions
  const monthLabels = useMemo(() => {
    const labels = [];
    let currentDate = startDate.clone();
    
    while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'month')) {
      if (currentDate.date() <= 7) { // Only add label if we're in the first week of the month
        labels.push({
          text: currentDate.format('MMM'),
          weekIndex: Math.floor(currentDate.diff(startDate, 'week', true))
        });
      }
      currentDate = currentDate.add(1, 'month');
    }
    return labels;
  }, [startDate, endDate]);

  // Calculate color intensity based on count
  const maxCount = useMemo(() => Math.max(...data.map(d => d.count)), [data]);
  
  const getColor = useMemo(() => (count: number) => {
    if (count === 0) return 'bg-gray-100 hover:bg-gray-200';
    
    // Use 4 intensity levels (like GitHub)
    let level;
    const ratio = count / maxCount;
    if (ratio <= 0.25) level = 1;
    else if (ratio <= 0.5) level = 2;
    else if (ratio <= 0.75) level = 3;
    else level = 4;

    // Map levels to appropriate intensities
    const intensityMap = {
      1: '200',
      2: '300',
      3: '400',
      4: '500'
    };

    const baseColor = 'bg-primary';
    const intensity = intensityMap[level as 1 | 2 | 3 | 4];
    const hoverIntensity = intensityMap[Math.min(4, level + 1) as 1 | 2 | 3 | 4];
    
    return `${baseColor}-${intensity} hover:${baseColor}-${hoverIntensity}`;
  }, [maxCount]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[800px]">
        {/* Month labels */}
        <div className="flex mb-2 ml-8">
          <div className="relative w-full h-5">
            {monthLabels.map(({ text, weekIndex }, i) => (
              <div
                key={i}
                className="absolute text-[13px] font-[450] text-gray-600/90 -translate-x-1/2"
                style={{
                  left: `${((weekIndex + 0.5) / totalWeeks) * 100}%`,
                  paddingLeft: i === 0 ? '0' : '8px' // Add spacing between months
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>
        
        {/* Grid with day labels */}
        <div className="flex gap-3">
          {/* Day labels */}
          <div className="flex flex-col justify-between pt-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-[11px] font-[450] text-gray-500/90 h-[10px] leading-[10px] pr-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Heatmap grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${totalWeeks}, 1fr)`,
            gridTemplateRows: 'repeat(7, 1fr)',
            gap: '3px'
          }}>
            {Array.from({ length: totalWeeks * 7 }).map((_, index) => {
              const currentDate = startDate.add(Math.floor(index / 7), 'week').add(index % 7, 'day');
              const dataPoint = data.find(d => d.date === currentDate.format('YYYY-MM-DD'));
              
              return (
                <div
                  key={index}
                  className={`w-[10px] h-[10px] rounded-sm transition-colors duration-200 cursor-default ${getColor(dataPoint?.count || 0)}`}
                  title={dataPoint
                    ? `${dayjs(dataPoint.date).format('MMM D, YYYY')}: ${dataPoint.count} interaction${dataPoint.count !== 1 ? 's' : ''}`
                    : `${currentDate.format('MMM D, YYYY')}: 0 interactions`
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
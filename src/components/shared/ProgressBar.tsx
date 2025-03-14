import { useEffect, useState } from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar = ({ progress, className = '' }: ProgressBarProps) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // Animate progress changes
    setWidth(Math.min(Math.max(progress, 0), 100));
  }, [progress]);

  return (
    <div className={`w-full bg-gray-200 rounded-full h-2.5 ${className}`}>
      <div
        className="bg-primary-500 h-2.5 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
};
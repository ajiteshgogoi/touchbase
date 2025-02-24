import { useUserStats } from '../../hooks/useUserStats';

interface UserMetadata {
  name?: string;
  picture?: string;
}

// Apple-inspired pastel colors with increased saturation for better visibility
const defaultColors = [
  'rgb(255, 59, 48)', // SF Red
  'rgb(0, 122, 255)', // SF Blue
  'rgb(76, 217, 100)', // SF Green
  'rgb(255, 149, 0)', // SF Orange
  'rgb(88, 86, 214)', // SF Purple
  'rgb(255, 204, 0)' // SF Yellow
];

export const UsersSocialProof = () => {
  const { data: stats, isLoading } = useUserStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full py-4">
        <div className="animate-pulse flex -space-x-3">
          {[...Array(3)].map((_, i: number) => (
            <div
              key={i}
              className="w-10 h-10 rounded-full border-2 border-white/90 bg-gray-200 shadow-sm"
              style={{ transform: `translateX(${i * -6}px)` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || stats.totalCount === 0) {
    return null;
  }

  return (
    <div className="w-full py-4">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4">
        <div className="flex -space-x-3 flex-shrink-0">
          {stats.recentUsers.slice(0, 5).map((user: UserMetadata, index: number) => {
            const defaultColor = defaultColors[index % defaultColors.length];
            
            return (
              <div
                key={index}
                className="relative w-10 h-10 rounded-full border-2 border-white/90 shadow-sm overflow-hidden transform transition-transform hover:scale-105 hover:z-10"
                style={{ transform: `translateX(${index * -6}px)` }}
              >
                {(() => {
                  const defaultBg = (
                    <div
                      aria-hidden="true"
                      className="w-full h-full"
                      style={{ backgroundColor: defaultColor }}
                    />
                  );

                  if (!user.picture) return defaultBg;

                  return (
                    <>
                      <img
                        src={user.picture}
                        alt=""
                        aria-hidden="true"
                        className="w-full h-full object-cover opacity-0"
                        onLoad={(e) => {
                          const img = e.target as HTMLImageElement;
                          // Show image only after it loads successfully
                          img.classList.remove('opacity-0');
                        }}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          // Keep image hidden on error
                          img.remove();
                        }}
                      />
                      {defaultBg /* Show colored background by default */}
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
        <p className="text-sm text-gray-600 text-center sm:text-left whitespace-normal break-words max-w-[180px] sm:max-w-[240px]">
          Join <span className="font-semibold text-primary-600">{stats.totalCount.toLocaleString()}</span> others improving their relationships
        </p>
      </div>
    </div>
  );
};

export default UsersSocialProof;
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

  // Early return if no data and not loading
  if (!stats && !isLoading) return null;
  
  // Early return if no users
  if (!isLoading && stats?.totalCount === 0) return null;

  return (
    <div className="w-full py-2">
      <div className="flex flex-col items-center justify-center space-y-5 px-4 h-[150px]">
        {/* Avatars Section */}
        <div className="flex -space-x-3 md:-space-x-4 justify-center relative">
          {isLoading ? (
            // Loading state avatars
            [...Array(7)].map((_, i: number) => (
              <div
                key={i}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border-[2.5px] border-white bg-gray-100/80 shadow-[0_0_10px_rgba(0,0,0,0.05)] animate-pulse translate-x-0"
                style={{ marginLeft: i === 0 ? '0' : '-12px', zIndex: 5 - i }}
              />
            ))
          ) : stats?.recentUsers?.length ? (
            // Actual users avatars
            stats.recentUsers.slice(0, 7).map((user: UserMetadata, index: number) => {
              const defaultColor = defaultColors[index % defaultColors.length];
              
              return (
                <div
                  key={index}
                  className="relative w-10 h-10 md:w-12 md:h-12 rounded-full border-[2.5px] border-white shadow-[0_0_10px_rgba(0,0,0,0.05)] overflow-hidden translate-x-0"
                  style={{ marginLeft: index === 0 ? '0' : '-12px', zIndex: 5 - index }}
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
                            img.classList.remove('opacity-0');
                          }}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.remove();
                          }}
                        />
                        {defaultBg /* Show colored background by default */}
                      </>
                    );
                  })()}
                </div>
              );
            })
          ) : null}
        </div>

        {/* Stats Text - Same height reserved for loading and loaded states */}
        <div className={`min-h-[48px] w-full flex items-center justify-center ${isLoading ? 'animate-pulse bg-gray-100/80 rounded-lg' : ''}`}>
          {!isLoading && stats && (
            <p className="text-[15px] leading-relaxed text-gray-700 font-[450] text-center px-5">
              Join{' '}
              <span className="font-semibold text-primary-600">{stats.totalCount.toLocaleString()}</span>
              {' '}others improving their relationships...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersSocialProof;
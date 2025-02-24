import { useUserStats } from '../../hooks/useUserStats';

interface UserMetadata {
  name?: string;
  picture?: string;
}

// Apple-inspired pastel colors for default avatars
const defaultColors = [
  'rgb(255, 45, 85)', // Red
  'rgb(90, 200, 250)', // Blue
  'rgb(52, 199, 89)', // Green
  'rgb(255, 149, 0)', // Orange
  'rgb(175, 82, 222)' // Purple
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
              className="w-9 h-9 rounded-full border-2 border-white bg-gray-200"
              style={{ transform: `translateX(${i * -4}px)` }}
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
    <div className="flex items-center justify-center w-full py-4">
      <div className="flex items-center gap-4">
        <div className="flex -space-x-3">
          {stats.recentUsers.map((user: UserMetadata, index: number) => {
            // Generate default background color if no picture
            const defaultColor = defaultColors[index % defaultColors.length];
            
            return (
              <div
                key={index}
                className="relative w-9 h-9 rounded-full border-2 border-white shadow-sm overflow-hidden"
                style={{ transform: `translateX(${index * -4}px)` }}
              >
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name || 'User avatar'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: defaultColor }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-sm text-gray-600 flex-shrink-0">
          Join <span className="font-semibold text-primary-600">{stats.totalCount.toLocaleString()}</span> others improving their relationships
        </p>
      </div>
    </div>
  );
};

export default UsersSocialProof;
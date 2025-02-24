import { useUserStats } from '../../hooks/useUserStats';

interface UserMetadata {
  name?: string;
  picture?: string;
}

export const UsersSocialProof = () => {
  const { data: stats, isLoading } = useUserStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full py-4">
        <div className="animate-pulse flex space-x-2">
          {[...Array(3)].map((_, i: number) => (
            <div key={i} className="w-8 h-8 bg-gray-200 rounded-full" />
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
      <div className="flex items-center">
        <div className="flex -space-x-2 mr-3">
          {stats.recentUsers.map((user: UserMetadata, index: number) => (
            <img
              key={index}
              src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`}
              alt={user.name || 'User avatar'}
              className="w-8 h-8 rounded-full ring-2 ring-white bg-gray-50"
              loading="lazy"
            />
          ))}
        </div>
        <p className="text-sm text-gray-600">
          Join <span className="font-semibold text-primary-600">{stats.totalCount.toLocaleString()}</span> others improving their relationships
        </p>
      </div>
    </div>
  );
};

export default UsersSocialProof;
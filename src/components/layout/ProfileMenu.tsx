import { Fragment, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { signOut } from '../../lib/supabase/client';
import { initiateGoogleLogin } from '../../lib/auth/google';
import { Menu, Transition } from '@headlessui/react';

// Lazy load icons individually to reduce initial bundle size
const UserCircleIcon = lazy(() => import('@heroicons/react/24/outline/UserCircleIcon').then(mod => ({ default: mod.default })));
const ChevronDownIcon = lazy(() => import('@heroicons/react/24/outline/ChevronDownIcon').then(mod => ({ default: mod.default })));
const SparklesIcon = lazy(() => import('@heroicons/react/24/outline/SparklesIcon').then(mod => ({ default: mod.default })));
const ChatBubbleIcon = lazy(() => import('@heroicons/react/24/outline/ChatBubbleOvalLeftEllipsisIcon').then(mod => ({ default: mod.default })));
const ChartBarIcon = lazy(() => import('@heroicons/react/24/outline/ChartBarIcon').then(mod => ({ default: mod.default })));
const QuestionMarkCircleIcon = lazy(() => import('@heroicons/react/24/outline/QuestionMarkCircleIcon').then(mod => ({ default: mod.default })));
const Cog6ToothIcon = lazy(() => import('@heroicons/react/24/outline/Cog6ToothIcon').then(mod => ({ default: mod.default })));

const IconFallback = () => <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />;

// Pre-compute styles outside of render
const menuStyles = {
  base: "group flex w-full items-center rounded-lg px-3 py-2.5 text-[15px] font-[450] transform-gpu",
  active: "bg-gray-50/20 dark:bg-gray-800/20 text-primary-600 dark:text-primary-400",
  inactive: "text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
};

// Menu item component to handle active state
const MenuItem: React.FC<{
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ to, onClick, children }) => {
  return (
    <Menu.Item>
      {({ active }) => {
        const className = `${menuStyles.base} ${active ? menuStyles.active : menuStyles.inactive}`;
        if (to) {
          return <Link to={to} className={className}>{children}</Link>;
        }
        return <button onClick={onClick} className={className}>{children}</button>;
      }}
    </Menu.Item>
  );
};

export const ProfileMenu = () => {
  const { user, isPremium } = useStore();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = () => {
    try {
      setIsLoading(true);
      initiateGoogleLogin();
    } catch (error) {
      console.error('Error initiating Google login:', error);
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        disabled={isLoading}
        className="w-[120px] bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 text-white flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-medium shadow-soft dark:shadow-soft-dark hover:shadow-lg transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4 text-white absolute"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span className={isLoading ? 'opacity-0' : 'opacity-100'}>
          Sign In
        </span>
      </button>
    );
  }

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-800 select-none pointer-events-none transition-all duration-200 ${
            isPremium ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'
          }`}
        >
          <Suspense fallback={<IconFallback />}>
            <SparklesIcon className="h-3 w-3" />
          </Suspense>
          <span>Premium</span>
        </div>
        <Menu.Button className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50/20 dark:hover:bg-gray-800/20 hover:text-primary-600 dark:hover:text-primary-400 active:bg-gray-100/30 dark:active:bg-gray-800/30 transition-all duration-200 group" aria-label="Profile menu">
          <div className="relative w-7 h-7 rounded-full border-[1.5px] border-white/90 dark:border-gray-700/90 shadow-[0_0_10px_rgba(0,0,0,0.03)] dark:shadow-[0_0_10px_rgba(0,0,0,0.2)] overflow-hidden bg-primary-50 dark:bg-primary-900/30">
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="w-full h-full object-cover opacity-0 transition-opacity duration-200"
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.classList.remove('opacity-0');
                }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.remove();
                }}
              />
            ) : (
              <Suspense fallback={<IconFallback />}>
                <UserCircleIcon className="h-6 w-6 m-0.5 text-primary-600/90" />
              </Suspense>
            )}
          </div>
          <Suspense fallback={<IconFallback />}>
            <ChevronDownIcon className="h-4 w-4 opacity-60 group-hover:opacity-80" />
          </Suspense>
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 scale-95 translate-y-1"
        enterTo="opacity-100 scale-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 scale-100 translate-y-0"
        leaveTo="opacity-0 scale-95 translate-y-1"
      >
        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-gray-900 backdrop-blur-lg shadow-lg dark:shadow-soft-dark ring-1 ring-black/5 dark:ring-white/10 focus:outline-none divide-y divide-gray-100 dark:divide-gray-800 z-50 will-change-transform">
          <div className="px-1 py-1">
            <MenuItem to="/conversation-prompts">
              <Suspense fallback={<IconFallback />}>
                <ChatBubbleIcon className="h-5 w-5 mr-2 text-primary-500" />
              </Suspense>
              Conversation Starters
            </MenuItem>
            <MenuItem to="/analytics">
              <Suspense fallback={<IconFallback />}>
                <ChartBarIcon className="h-5 w-5 mr-2 text-primary-500" />
              </Suspense>
              Detailed Insights
            </MenuItem>
            <MenuItem to="/help">
              <Suspense fallback={<IconFallback />}>
                <QuestionMarkCircleIcon className="h-5 w-5 mr-2 text-primary-500" />
              </Suspense>
              How to Use
            </MenuItem>
            <MenuItem to="/settings">
              <Suspense fallback={<IconFallback />}>
                <Cog6ToothIcon className="h-5 w-5 mr-2 text-primary-500" />
              </Suspense>
              Settings
            </MenuItem>
          </div>
          <div className="px-1 py-1">
            <MenuItem onClick={handleSignOut}>
              Sign Out
            </MenuItem>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};
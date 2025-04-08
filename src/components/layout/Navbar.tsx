import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const ProfileMenu = lazy(() => import('./ProfileMenu').then(mod => ({ default: mod.ProfileMenu })));

export const Navbar = () => {
  return (
    <nav className="bg-white dark:bg-gray-900 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-100/50 dark:border-gray-800/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex-1 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-baseline text-2xl font-bold group -ml-3 px-3 py-2 rounded-xl hover:bg-gray-50/10 dark:hover:bg-gray-900/10 transition-all duration-200"
            >
              <img
                src="/icon.svg"
                alt="Blue heart icon"
                className="h-7 w-7 mr-0.5 group-hover:scale-105 group-hover:brightness-90 transition-all duration-200 translate-y-[5px]"
              />
              <span className="bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-500 dark:to-primary-300 group-hover:from-primary-700 group-hover:to-primary-500 dark:group-hover:from-primary-600 dark:group-hover:to-primary-400 bg-clip-text text-transparent transition-all duration-200">
                TouchBase
              </span>
            </Link>
            
            <div className="flex items-center">
              <Suspense fallback={
                <div className="h-8 w-8 rounded-full bg-gray-100/70 dark:bg-gray-800/70 animate-pulse"></div>
              }>
                <ProfileMenu />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
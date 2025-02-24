import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const ProfileMenu = lazy(() => import('./ProfileMenu').then(mod => ({ default: mod.ProfileMenu })));

export const Navbar = () => {
  return (
    <nav className="bg-white/60 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-100/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex-1 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-baseline text-2xl font-semibold group -ml-3 px-3 py-2 rounded-xl hover:bg-gray-50/50 transition-all duration-200"
            >
              <img
                src="/icon.svg"
                alt="Blue heart icon"
                className="h-7 w-7 mr-1.5 group-hover:scale-105 transition-transform duration-200 translate-y-[5px]"
              />
              <span className="bg-gradient-to-r from-primary-600 to-primary-400 group-hover:from-primary-700 group-hover:to-primary-500 bg-clip-text text-transparent transition-all duration-200">
                TouchBase
              </span>
            </Link>
            
            <div className="flex items-center">
              <Suspense fallback={
                <div className="h-8 w-8 rounded-full bg-gray-100/70 animate-pulse"></div>
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
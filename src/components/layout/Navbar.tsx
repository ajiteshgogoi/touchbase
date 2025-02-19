import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const ProfileMenu = lazy(() => import('./ProfileMenu').then(mod => ({ default: mod.ProfileMenu })));

export const Navbar = () => {
  return (
    <nav className="bg-white/80 backdrop-blur-sm shadow-soft sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              to="/"
              className="flex items-center text-2xl font-extrabold group"
            >
              <div className="flex items-center">
                <img
                  src="/icon.svg"
                  alt="Blue heart icon"
                  className="h-8 w-8 mr-0.5 group-hover:brightness-90 transition-all"
                />
                <span className="bg-gradient-to-r from-primary-600 to-primary-400 group-hover:from-primary-700 group-hover:to-primary-500 bg-clip-text text-transparent transition-all">
                  TouchBase
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center">
            <Suspense fallback={
              <div className="h-9 w-9 rounded-full bg-gray-100 animate-pulse"></div>
            }>
              <ProfileMenu />
            </Suspense>
          </div>
        </div>
      </div>
    </nav>
  );
};
import { Link } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { ProfileMenu } from './ProfileMenu';

export const Navbar = () => {
  return (
    <nav className="bg-white/80 backdrop-blur-sm shadow-soft sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              to="/"
              className="flex items-center text-2xl font-extrabold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent hover:from-primary-500 hover:to-primary-300 transition-all"
            >
              TouchBase
            </Link>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/notifications"
              className="p-1 rounded-lg text-gray-600 hover:bg-primary-50 hover:text-primary-600 transition-all duration-200 ease-in-out hover:shadow-soft"
            >
              <BellIcon className="h-5 w-5" />
            </Link>
            <ProfileMenu />
          </div>
        </div>
      </div>
    </nav>
  );
};
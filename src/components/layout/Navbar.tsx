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
              className="flex items-center text-2xl font-extrabold group"
            >
              <div className="flex items-center bg-gradient-to-r from-primary-600 to-primary-400 group-hover:from-primary-500 group-hover:to-primary-300 transition-all">
                <img src="/icon.svg" alt="TouchBase" className="h-8 w-8 mr-0.5 [filter:brightness(0)_saturate(100%)_invert(21%)_sepia(90%)_saturate(1966%)_hue-rotate(212deg)_brightness(97%)_contrast(101%)] group-hover:[filter:brightness(0)_saturate(100%)_invert(37%)_sepia(60%)_saturate(1730%)_hue-rotate(211deg)_brightness(100%)_contrast(101%)]" />
                <span className="bg-clip-text text-transparent">TouchBase</span>
              </div>
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
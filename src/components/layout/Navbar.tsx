import { Link } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { signOut } from '../../lib/supabase/client';
import {
  UserCircleIcon,
  BellIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

export const Navbar = () => {
  const { user } = useStore();

  return (
    <nav className="bg-gradient-to-r from-white to-primary-50 dark:from-gray-800 dark:to-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              to="/"
              className="flex items-center text-2xl font-extrabold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent hover:to-primary-600 transition-colors"
            >
              TouchBase
            </Link>
          </div>

          <div className="flex items-center space-x-6">
            <Link
              to="/notifications"
              className="p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 ease-in-out hover:shadow-md"
            >
              <BellIcon className="h-5 w-5" />
            </Link>

            <Link
              to="/settings"
              className="p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 ease-in-out hover:shadow-md"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </Link>

            {user ? (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => signOut()}
                  className="bg-white dark:bg-gray-700 hover:bg-primary-50 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-all duration-200 ease-in-out hover:shadow-md"
                >
                  Sign Out
                </button>
                <Link
                  to="/profile"
                  className="p-1 rounded-full hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 ease-in-out hover:shadow-md"
                >
                  <UserCircleIcon className="h-8 w-8 text-primary-500 dark:text-primary-400" />
                </Link>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 ease-in-out"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
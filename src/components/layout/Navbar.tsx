import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { signOut } from '../../lib/supabase/client';
import {
  UserCircleIcon,
  BellIcon,
  Cog6ToothIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';

export const Navbar = () => {
  const { user, darkMode, setDarkMode } = useStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              to="/"
              className="flex items-center text-primary-600 dark:text-primary-400 font-bold text-xl"
            >
              TouchBase
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <SunIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <MoonIcon className="h-5 w-5 text-gray-500" />
              )}
            </button>

            <Link
              to="/notifications"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <BellIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </Link>

            <Link
              to="/settings"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Cog6ToothIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </Link>

            {user ? (
              <div className="relative ml-3">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => signOut()}
                    className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
                  >
                    Sign Out
                  </button>
                  <Link to="/profile">
                    <UserCircleIcon className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                  </Link>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm"
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
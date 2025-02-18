import { Fragment, useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { UserCircleIcon, ChevronDownIcon, SparklesIcon, ChatBubbleOvalLeftEllipsisIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../stores/useStore';
import { signOut } from '../../lib/supabase/client';
import { initiateGoogleLogin } from '../../lib/auth/google';

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
        className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-soft hover:shadow-lg transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <svg
            className="animate-spin h-5 w-5 text-white"
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
        ) : (
          'Sign In'
        )}
      </button>
    );
  }

  // Pre-compute menu item styles
  const menuItemBaseStyle = "group flex w-full items-center rounded-md px-2 py-2 text-sm";
  const menuItemActiveStyle = "bg-primary-50 text-primary-600";
  const menuItemInactiveStyle = "text-gray-700";

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-0.5 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full text-xs font-medium border border-amber-200 select-none pointer-events-none transition-all duration-200 ${
            isPremium ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'
          }`}
        >
          <SparklesIcon className="h-3 w-3" />
          <span>Premium</span>
        </div>
        <Menu.Button className="flex items-center gap-1 px-1 rounded-lg text-gray-600 hover:bg-primary-50 hover:text-primary-600 transition-colors duration-200">
          <UserCircleIcon className="h-6 w-6" />
          <ChevronDownIcon className="h-4 w-4" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <Menu.Items
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none divide-y divide-gray-100 z-50"
          style={{
            willChange: 'transform, opacity'
          }}
        >
          <div className="px-1 py-1">
            <Menu.Item>
              {({ active }) => (
                <Link
                  to="/conversation-prompts"
                  className={`${menuItemBaseStyle} ${active ? menuItemActiveStyle : menuItemInactiveStyle}`}
                >
                  <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 mr-2 text-primary-500" />
                  Conversation Prompts
                </Link>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <Link
                  to="/help"
                  className={`${menuItemBaseStyle} ${active ? menuItemActiveStyle : menuItemInactiveStyle}`}
                >
                  How to Use
                </Link>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <Link
                  to="/settings"
                  className={`${menuItemBaseStyle} ${active ? menuItemActiveStyle : menuItemInactiveStyle}`}
                >
                  Settings
                </Link>
              )}
            </Menu.Item>
          </div>
          <div className="px-1 py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={handleSignOut}
                  className={`${menuItemBaseStyle} ${active ? menuItemActiveStyle : menuItemInactiveStyle}`}
                >
                  Sign Out
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};
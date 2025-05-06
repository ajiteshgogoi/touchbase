import { FC } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from '@headlessui/react';
import { ChatBubbleOvalLeftEllipsisIcon } from '@heroicons/react/24/outline';

export interface MenuContentProps {
  onSignOut: () => void;
  menuItemBaseStyle: string;
  menuItemActiveStyle: string;
  menuItemInactiveStyle: string;
}

export const MenuContent: FC<MenuContentProps> = ({
  onSignOut,
  menuItemBaseStyle,
  menuItemActiveStyle,
  menuItemInactiveStyle
}) => {
  return (
    <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none divide-y divide-gray-100 z-50"
         style={{ willChange: 'transform, opacity' }}>
      <div className="px-1 py-1">
        <Menu.Item>
          {({ active }) => (
            <Link
              to="/conversation-prompts"
              className={`${menuItemBaseStyle} ${active ? menuItemActiveStyle : menuItemInactiveStyle}`}
            >
              <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 mr-2 text-primary-500" />
              Conversation Starters
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
              onClick={onSignOut}
              className={`${menuItemBaseStyle} ${active ? menuItemActiveStyle : menuItemInactiveStyle}`}
            >
              Sign Out
            </button>
          )}
        </Menu.Item>
      </div>
    </div>
  );
};
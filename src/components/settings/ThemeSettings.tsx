import { useEffect } from 'react';
import type { NotificationSettings as NotificationSettingsType } from '../../types';

interface Props {
  settings: NotificationSettingsType;
  onUpdate: (settings: Partial<NotificationSettingsType>) => Promise<void>;
}

const themes = [
  { value: 'system', label: 'System', description: 'Follow system appearance' },
  { value: 'light', label: 'Light', description: 'Always use light mode' },
  { value: 'dark', label: 'Dark', description: 'Always use dark mode' },
] as const;

export const ThemeSettings = ({ settings, onUpdate }: Props) => {
  // Handle theme changes and system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      const isDark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && mediaQuery.matches);
      
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme(); // Initial application
    
    // Listen for system theme changes
    const handleChange = () => {
      if (settings.theme === 'system') {
        applyTheme();
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  return (
    <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark hover:bg-white/70 dark:hover:bg-gray-900/70 transition-all duration-200 p-6">
      <h2 className="text-xl font-semibold text-primary-500 dark:text-primary-400 mb-6">
        Theme Settings
      </h2>
      <div className="space-y-2">
        <div>
          <div className="text-gray-900 dark:text-gray-100 font-medium">
            Appearance
          </div>
          <p className="text-sm text-gray-600/90 dark:text-gray-400 mt-1">
            Choose how TouchBase looks to you
          </p>
        </div>
        
        <div className="mt-4 space-y-2">
          {themes.map(theme => (
            <div
              key={theme.value}
              className={`
                relative flex items-center p-4 cursor-pointer
                bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl
                border border-gray-100/30 dark:border-gray-800/30
                transition-all
                hover:bg-white/50 dark:hover:bg-gray-900/50
                ${settings.theme === theme.value ? 'ring-1 ring-primary-400/30 dark:ring-primary-400/20' : ''}
              `}
              onClick={() => onUpdate({ theme: theme.value })}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {theme.label}
                </div>
                <p className="text-sm text-gray-600/90 dark:text-gray-400">
                  {theme.description}
                </p>
              </div>
              <div className={`
                h-4 w-4 rounded-full border flex items-center justify-center
                ${settings.theme === theme.value
                  ? 'border-primary-500 bg-primary-500 dark:border-primary-400 dark:bg-primary-400'
                  : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
                }
              `}>
                {settings.theme === theme.value && (
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
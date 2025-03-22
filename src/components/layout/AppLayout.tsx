import { useStore } from '../../stores/useStore';
import { Layout } from './Layout';
import type { NotificationSettings } from '../../types/settings';

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, preferences } = useStore();
  
  console.log('[AppLayout] Current preferences:', preferences);
  
  // Convert UserPreferences to NotificationSettings
  const settings: NotificationSettings | undefined = preferences ? {
    notification_enabled: preferences.notification_enabled,
    theme: preferences.theme,
    timezone: preferences.timezone,
    ai_suggestions_enabled: preferences.ai_suggestions_enabled,
    has_rated_app: preferences.has_rated_app,
    last_rating_prompt: preferences.last_rating_prompt || undefined,
    install_time: preferences.install_time
  } : undefined;

  return (
    <Layout user={user} settings={settings}>
      {children}
    </Layout>
  );
};
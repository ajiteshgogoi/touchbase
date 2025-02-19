export interface NotificationSettings {
  notification_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  ai_suggestions_enabled: boolean;
}
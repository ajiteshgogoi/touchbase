export interface NotificationSettings {
  notification_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  ai_suggestions_enabled: boolean;
  has_rated_app: boolean;
  last_rating_prompt?: string; // ISO date string
  install_time?: string; // ISO date string
}
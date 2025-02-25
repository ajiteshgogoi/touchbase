import type { NotificationSettings } from '../../types/settings';
import type { Subscription } from '../../types/subscription';

interface Props {
  settings: NotificationSettings;
  onUpdate: (settings: Partial<NotificationSettings>) => void;
  isPremium: boolean;
  subscription: Subscription | null | undefined;
}

export const AISettings = ({ settings, onUpdate, isPremium, subscription }: Props) => {
  const isTrialActive = subscription?.trial_end_date && new Date(subscription.trial_end_date) > new Date();
  const canUseAIFeatures = isPremium || isTrialActive;

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-sm hover:shadow-md hover:bg-white/70 transition-all duration-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-primary-500">
          AI Features
        </h2>
        {!canUseAIFeatures && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-600">
            Premium Only
          </span>
        )}
      </div>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="ai-suggestions" className={`font-medium ${canUseAIFeatures ? 'text-gray-900' : 'text-gray-400'}`}>
              Advanced AI Suggestions
            </label>
            <p className={`text-sm mt-1 ${canUseAIFeatures ? 'text-gray-600/90' : 'text-gray-400'}`}>
              Get AI-powered suggestions for future interactions
            </p>
          </div>
          <label className={`relative inline-flex items-center ${canUseAIFeatures ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <input
              id="ai-suggestions"
              type="checkbox"
              className="sr-only peer"
              checked={settings.ai_suggestions_enabled}
              onChange={(e) => {
                if (canUseAIFeatures) {
                  onUpdate({
                    ai_suggestions_enabled: e.target.checked
                  });
                }
              }}
              disabled={!canUseAIFeatures}
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
          </label>
        </div>
      </div>
    </div>
  );
};
import { Link } from 'react-router-dom';
import { ContactFormProps } from './types';

interface PersonalNotesProps extends ContactFormProps {
  isPremium: boolean;
  isOnTrial: boolean;
}

/**
 * Component for personal notes section with premium/trial features
 * Includes character counter and upgrade prompts for non-premium users
 */
export const PersonalNotes = ({
  formData,
  onChange,
  isPremium,
  isOnTrial,
}: PersonalNotesProps) => {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-6 hover:bg-white/70 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-xl font-[600] text-gray-900/90">Personal Notes</h2>
      </div>
      <div>
        {/* Premium/Trial Feature Info */}
        {(isPremium || isOnTrial) ? (
          <div className="mb-4 p-4 bg-primary-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              Add details that can help maintain the relationship.
              Examples:
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Their interests and hobbies</li>              
              <li>Recent life events or achievements</li>
              <li>Conversation preferences (topics they enjoy)</li>
              <li>Shared memories or inside jokes</li>
            </ul>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              Add details that can help maintain the relationship.
              <span className="block mt-2">
                ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">
                  Upgrade to Premium
                </Link> to get AI-powered suggestions based on your notes!
              </span>
            </p>
          </div>
        )}

        {/* Notes Textarea */}
        <div>
          <textarea
            id="notes"
            rows={4}
            value={formData.notes}
            onChange={(e) => onChange({ notes: e.target.value.slice(0, 500) })}
            maxLength={500}
            className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
            placeholder="E.g., Friend from school. Loves hiking and photography. Recently started a new job in tech."
          />
          <div className="mt-2 flex justify-end">
            <span className="text-sm text-gray-500">
              {formData.notes.length}/500 characters
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
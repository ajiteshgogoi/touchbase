import { ContactFormProps } from './types';
import { formatLocalDateTime } from './utils';

/**
 * Component for contact preference settings including
 * preferred method, frequency, last contact date, and relationship level
 */
export const ContactPreferences = ({
  formData,
  onChange,
}: ContactFormProps) => {
  return (
    <div className="bg-white rounded-xl shadow-soft p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Contact Preferences</h2>
      <div className="space-y-6">
        {/* Preferred Contact Method */}
        <div>
          <label htmlFor="preferred_contact_method" className="block text-sm font-medium text-gray-700">
            Preferred Contact Method
          </label>
          <select
            id="preferred_contact_method"
            value={formData.preferred_contact_method || ''}
            onChange={(e) => onChange({
              preferred_contact_method: e.target.value as ContactFormProps['formData']['preferred_contact_method']
            })}
            className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
          >
            <option value="">No preference</option>
            <option value="call">Call</option>
            <option value="message">Message</option>
            <option value="social">Social Media</option>
          </select>
        </div>

        {/* Contact Frequency */}
        <div>
          <label htmlFor="contact_frequency" className="block text-sm font-medium text-gray-700">
            Ideal Contact Frequency
          </label>
          <select
            id="contact_frequency"
            value={formData.contact_frequency || ''}
            onChange={(e) => onChange({
              contact_frequency: e.target.value as ContactFormProps['formData']['contact_frequency']
            })}
            className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
          >
            <option value="">Choose frequency</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>

        {/* Last Contacted */}
        <div>
          <label htmlFor="last_contacted" className="block text-sm font-medium text-gray-700">
            Last Contacted
          </label>
          <input
            type="datetime-local"
            id="last_contacted"
            max={formatLocalDateTime(new Date())}
            value={formData.last_contacted || ''}
            onChange={(e) => {
              const selectedDate = e.target.value ? new Date(e.target.value) : null;
              const now = new Date();
              
              if (selectedDate && selectedDate > now) {
                // If future date/time selected, set to current date/time
                onChange({
                  last_contacted: formatLocalDateTime(now)
                });
              } else {
                onChange({
                  last_contacted: selectedDate ? formatLocalDateTime(selectedDate) : null
                });
              }
            }}
            className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Relationship Level */}
        <div>
          <label htmlFor="relationship_level" className="block text-sm font-medium text-gray-700">
            Relationship Closeness (drag the dot to indicate how close you are to this person)
          </label>
          <input
            type="range"
            id="relationship_level"
            min="1"
            max="5"
            value={formData.relationship_level}
            onChange={(e) => onChange({ relationship_level: parseInt(e.target.value) })}
            className="mt-3 block w-full cursor-pointer
              [&::-webkit-slider-runnable-track]:bg-gradient-to-r [&::-webkit-slider-runnable-track]:from-red-400 [&::-webkit-slider-runnable-track]:to-green-400 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:h-1.5
              [&::-moz-range-track]:bg-gradient-to-r [&::-moz-range-track]:from-red-400 [&::-moz-range-track]:to-green-400 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:h-1.5
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-200 [&::-webkit-slider-thumb]:hover:border-primary-300
              [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-200 [&::-moz-range-thumb]:hover:border-primary-300 [&::-moz-range-thumb]:-mt-[0.5px]"
          />
          <div className="mt-2 flex justify-between text-sm text-gray-600">
            <span>Distant</span>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
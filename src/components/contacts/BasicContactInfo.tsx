import { ContactFormProps } from './types';

/**
 * Component for essential contact information:
 * name (required), contact frequency, and relationship level
 */
export const BasicContactInfo = ({
  formData,
  errors,
  onChange,
}: ContactFormProps) => {
  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-6 hover:bg-white/70 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-xl font-[600] text-gray-900/90">Basic Information</h2>
      </div>
      <div className="space-y-6">
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name *
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={`mt-1 block w-full rounded-lg px-4 py-2.5 shadow-sm transition-colors ${
              errors.name
                ? 'border-red-300 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 hover:border-red-400'
                : 'border-gray-200 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 hover:border-gray-300'
            }`}
            placeholder="Enter name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Contact Frequency */}
        <div>
          <label htmlFor="contact_frequency" className="block text-sm font-medium text-gray-700">
            How often would you like to keep in touch?
          </label>
          <select
            id="contact_frequency"
            value={formData.contact_frequency || ''}
            onChange={(e) => onChange({
              contact_frequency: e.target.value as ContactFormProps['formData']['contact_frequency']
            })}
            className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
          >
            <option value="">Choose frequency</option>
            <option value="every_three_days">Every 3 days</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Every 3 months</option>
          </select>
        </div>

        {/* Relationship Level */}
        <div>
          <label htmlFor="relationship_level" className="block text-sm font-medium text-gray-700">
            How close are you with this person?
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
            <span>Acquaintance</span>
            <span>Very Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
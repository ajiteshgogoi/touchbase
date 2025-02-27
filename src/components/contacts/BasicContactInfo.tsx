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
            How often would you like to keep in touch? *
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
      </div>
    </div>
  );
};
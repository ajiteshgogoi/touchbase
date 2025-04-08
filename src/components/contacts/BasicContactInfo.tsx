import { ContactFormProps } from './types';

/**
 * Component for essential contact information:
 * name (required) and contact frequency (required).
 */
export const BasicContactInfo = ({
  formData,
  errors,
  onChange,
  onError,
}: ContactFormProps) => {
  return (
    <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark p-6 hover:bg-white/70 dark:hover:bg-gray-900/70 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-xl font-[600] text-gray-900/90 dark:text-white">Basic Information</h2>
      </div>
      <div className="space-y-6">
        {/* Name Field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name *
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={`mt-1 block w-full rounded-lg px-4 py-2.5 shadow-sm transition-colors bg-white dark:bg-gray-800 ${
              errors.name
                ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 focus:outline-none focus:border-red-400 dark:focus:border-red-500 focus:ring-1 focus:ring-red-400 dark:focus:ring-red-500 hover:border-red-400 dark:hover:border-red-500'
                : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            placeholder="Enter name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
          )}
        </div>

        {/* Contact Frequency */}
        <div>
          <label htmlFor="contact_frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            How often would you like to keep in touch? *
          </label>
          <select
            id="contact_frequency"
            required
            value={formData.contact_frequency || ''}
            onChange={(e) => {
              const value = e.target.value as ContactFormProps['formData']['contact_frequency'];
              onChange({ contact_frequency: value });
              if (!value) {
                onError({ frequency: 'Please select how often you want to keep in touch' });
              } else {
                onError({ frequency: '' });
              }
            }}
            className={`mt-1 block w-full rounded-lg px-4 py-2.5 shadow-sm transition-colors bg-white dark:bg-gray-800 ${
              errors.frequency
                ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 focus:outline-none focus:border-red-400 dark:focus:border-red-500 focus:ring-1 focus:ring-red-400 dark:focus:ring-red-500 hover:border-red-400 dark:hover:border-red-500'
                : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <option value="">Choose frequency</option>
            <option value="every_three_days">Every 3 days</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Every 3 months</option>
          </select>
          {errors.frequency && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.frequency}</p>
          )}
        </div>
      </div>
    </div>
  );
};
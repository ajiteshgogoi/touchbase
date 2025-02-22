import { ContactFormProps } from './types';
import { isValidPhoneNumber, isValidSocialHandle } from './utils';

/**
 * Component for basic contact information fields including
 * name, phone number, and social media handle
 */
export const BasicInformation = ({
  formData,
  errors,
  onChange,
  onError,
}: ContactFormProps) => {
  return (
    <div className="bg-white rounded-xl shadow-soft p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Basic Information</h2>
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
                ? 'border-red-300 focus:border-red-400 focus:ring-red-400 hover:border-red-400'
                : 'border-gray-200 focus:border-primary-400 focus:ring-primary-400 hover:border-gray-300'
            }`}
            placeholder="Enter name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phone Number Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => {
                const value = e.target.value;
                onChange({ phone: value });
                if (value && !isValidPhoneNumber(value)) {
                  onError({
                    phone: 'Please enter a valid phone number (e.g., +91-1234567890)'
                  });
                } else {
                  onError({ phone: '' });
                }
              }}
              className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
              placeholder="Enter phone number"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
            )}
          </div>

          {/* Social Media Handle Field */}
          <div>
            <label htmlFor="social_media_handle" className="block text-sm font-medium text-gray-700">
              Social Media Handle
            </label>
            <input
              type="text"
              id="social_media_handle"
              value={formData.social_media_handle}
              onChange={(e) => {
                const value = e.target.value;
                onChange({ social_media_handle: value });
                if (value && !isValidSocialHandle(value)) {
                  onError({
                    social_media_handle: 'Social media handle must start with @'
                  });
                } else {
                  onError({ social_media_handle: '' });
                }
              }}
              className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
              placeholder="@username"
            />
            {errors.social_media_handle && (
              <p className="mt-1 text-sm text-red-600">{errors.social_media_handle}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
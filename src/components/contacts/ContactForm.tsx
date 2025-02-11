import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { contactsService } from '../../services/contacts';
import { useStore } from '../../stores/useStore';
import type { Contact } from '../../lib/supabase/types';

interface ContactFormData {
  name: string;
  phone: string;
  social_media_handle: string;
  preferred_contact_method: 'call' | 'message' | 'social' | null;
  notes: string;
  relationship_level: number;
  contact_frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null;
  user_id: string;
  last_contacted: string | null; // Format: YYYY-MM-DDThh:mm in local timezone
  next_contact_due: string | null;
  ai_last_suggestion: string | null;
  ai_last_suggestion_date: string | null;
  missed_interactions: number;
}

// Validation functions
const isValidPhoneNumber = (phone: string) => {
  // Matches formats: +1234567890, 123-456-7890, (123) 456-7890, 1234567890
  const phoneRegex = /^(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
  return phoneRegex.test(phone.trim());
};

const isValidSocialHandle = (handle: string) => {
  return handle === '' || handle.startsWith('@');
};

const formatLocalDateTime = (date: Date, timezone: string) => {
  // Convert the date to the user's timezone and format it
  const userDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  // Format in ISO format which will be converted to UTC when stored
  return userDate.toISOString().slice(0, -8); // Remove seconds and timezone
};

const initialFormData: ContactFormData = {
  name: '',
  phone: '',
  social_media_handle: '',
  preferred_contact_method: null,
  notes: '',
  relationship_level: 3,
  contact_frequency: null,
  user_id: '',
  last_contacted: formatLocalDateTime(new Date(), 'UTC'),
  next_contact_due: null,
  ai_last_suggestion: null,
  ai_last_suggestion_date: null,
  missed_interactions: 0,
};

export const ContactForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isPremium, isOnTrial, preferences } = useStore();
  const timezone = preferences?.timezone || 'UTC';
  const [formData, setFormData] = useState<ContactFormData>({
    ...initialFormData,
    user_id: user?.id || '',
  });
  const [errors, setErrors] = useState({
    phone: '',
    social_media_handle: '',
  });
  const isEditMode = Boolean(id);

  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactsService.getContact(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        phone: contact.phone || '',
        social_media_handle: contact.social_media_handle || '',
        preferred_contact_method: contact.preferred_contact_method,
        notes: contact.notes || '',
        relationship_level: contact.relationship_level,
        contact_frequency: contact.contact_frequency,
        user_id: contact.user_id,
        last_contacted: contact.last_contacted,
        next_contact_due: contact.next_contact_due,
        ai_last_suggestion: contact.ai_last_suggestion,
        ai_last_suggestion_date: contact.ai_last_suggestion_date,
        missed_interactions: contact.missed_interactions,
      });
    }
  }, [contact]);

  useEffect(() => {
    if (user) {
      setFormData(current => ({
        ...current,
        user_id: user.id,
      }));
    }
  }, [user]);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) => 
      contactsService.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate(-1);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Contact> }) =>
      contactsService.updateContact(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate(-1);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      console.error('No user ID available');
      return;
    }

    // Validate phone and social media handle if they are provided
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      setErrors(prev => ({
        ...prev,
        phone: 'Please enter a valid phone number (e.g., +91-9999955555)'
      }));
      return;
    }

    if (formData.social_media_handle && !isValidSocialHandle(formData.social_media_handle)) {
      setErrors(prev => ({
        ...prev,
        social_media_handle: 'Social media handle must start with @'
      }));
      return;
    }

    try {
      if (isEditMode && id) {
        await updateMutation.mutateAsync({ id, updates: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  if (isEditMode && isLoadingContact) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-gray-500">Loading contact...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -m-2 text-gray-400 hover:text-gray-500"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Contact Details
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <div className="bg-white rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Basic Information</h2>
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
              placeholder="Enter full name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, phone: value });
                  if (value && !isValidPhoneNumber(value)) {
                    setErrors(prev => ({
                      ...prev,
                      phone: 'Please enter a valid phone number (e.g., +91-1234567890)'
                    }));
                  } else {
                    setErrors(prev => ({ ...prev, phone: '' }));
                  }
                }}
                className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
                placeholder="Enter phone number"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>

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
                  setFormData({ ...formData, social_media_handle: value });
                  if (value && !isValidSocialHandle(value)) {
                    setErrors(prev => ({
                      ...prev,
                      social_media_handle: 'Social media handle must start with @'
                    }));
                  } else {
                    setErrors(prev => ({ ...prev, social_media_handle: '' }));
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

      {/* Contact Preferences */}
      <div className="bg-white rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Contact Preferences</h2>
        <div className="space-y-6">
          <div>
            <label htmlFor="preferred_contact_method" className="block text-sm font-medium text-gray-700">
              Preferred Contact Method
            </label>
            <select
              id="preferred_contact_method"
              value={formData.preferred_contact_method || ''}
              onChange={(e) => setFormData({
                ...formData,
                preferred_contact_method: e.target.value as ContactFormData['preferred_contact_method']
              })}
              className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
            >
              <option value="">No preference</option>
              <option value="call">Call</option>
              <option value="message">Message</option>
              <option value="social">Social Media</option>
            </select>
          </div>

          <div>
            <label htmlFor="contact_frequency" className="block text-sm font-medium text-gray-700">
              Ideal Contact Frequency
            </label>
            <select
              id="contact_frequency"
              value={formData.contact_frequency || ''}
              onChange={(e) => setFormData({
                ...formData,
                contact_frequency: e.target.value as ContactFormData['contact_frequency']
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

          <div>
            <label htmlFor="last_contacted" className="block text-sm font-medium text-gray-700">
              Last Contacted
            </label>
            <input
              type="datetime-local"
              id="last_contacted"
              max={formatLocalDateTime(new Date(), timezone)}
              value={formData.last_contacted || ''}
              onChange={(e) => {
                const selectedDate = e.target.value ? new Date(e.target.value) : null;
                const now = new Date();
                
                if (selectedDate && selectedDate > now) {
                  // If future date/time selected, set to current date/time
                  setFormData({
                    ...formData,
                    last_contacted: formatLocalDateTime(now, timezone)
                  });
                } else {
                  setFormData({
                    ...formData,
                    last_contacted: selectedDate ? formatLocalDateTime(selectedDate, timezone) : null
                  });
                }
              }}
              className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
            />
          </div>

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
              onChange={(e) => setFormData({ ...formData, relationship_level: parseInt(e.target.value) })}
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

      {/* Notes Section */}
      <div className="bg-white rounded-xl shadow-soft p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Personal Notes</h2>
        <div>
          {(isPremium || isOnTrial) ? (
            <div className="mb-4 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                Add details that can help maintain the relationship. This will help our AI provide you with personalised suggestions for your interactions.
                Examples:
              </p>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Their interests and hobbies</li>
                <li>Important dates (birthdays, anniversaries)</li>
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
                  ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions based on your notes!
                </span>
              </p>
            </div>
          )}
          <div>
            <textarea
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value.slice(0, 500) })}
              maxLength={500}
              className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:border-primary-400 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
              placeholder="E.g., Loves hiking and photography. Birthday: March 15. Recently started a new job in tech."
            />
            <div className="mt-2 flex justify-end">
              <span className="text-sm text-gray-500">
                {formData.notes.length}/500 characters
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-400 transition-colors font-medium shadow-soft hover:shadow-lg"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Contact'}
        </button>
      </div>
    </form>
    </div>
  );
};

export default ContactForm;
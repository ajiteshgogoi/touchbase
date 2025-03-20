import { useState } from 'react';
import { contactsService } from '../../../services/contacts';
import { useStore } from '../../../stores/useStore';
import { UserPlusIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Contact } from '../../../lib/supabase/types';

interface OnboardingStep3Props {
  onComplete: () => void;
  onBack: () => void;
}

type ContactFrequency = Contact['contact_frequency'];

interface ContactForm {
  name: string;
  frequency: ContactFrequency;
}

const FREQUENCY_OPTIONS = [
  { label: 'Weekly', value: 'weekly' as ContactFrequency },
  { label: 'Every 3 Days', value: 'every_three_days' as ContactFrequency },
  { label: 'Every 2 Weeks', value: 'fortnightly' as ContactFrequency },
  { label: 'Monthly', value: 'monthly' as ContactFrequency }

];

export const OnboardingStep3 = ({ onComplete, onBack }: OnboardingStep3Props) => {
  const { user } = useStore();
  const [form, setForm] = useState<ContactForm>({
    name: '',
    frequency: 'monthly'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Please enter a contact name');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await contactsService.createContact({
        user_id: user?.id as string,
        name: form.name.trim(),
        contact_frequency: form.frequency,
        preferred_contact_method: null,
        notes: null,
        phone: null,
        social_media_platform: null,
        social_media_handle: null,
        last_contacted: null,
        next_contact_due: null,
        ai_last_suggestion: null,
        ai_last_suggestion_date: null,
        missed_interactions: 0
      });
      onComplete();
    } catch (err) {
      console.error('Error adding contact:', err);
      setError('Unable to add contact. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-primary-600
          to-primary-400 bg-clip-text text-transparent leading-relaxed pb-1">
          Add Your First Contact
        </h2>
        <p className="text-[15px] text-gray-600/90 max-w-sm mx-auto mt-1.5">
          Start by adding someone you'd like to stay in touch with
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name *
          </label>
          <input
            type="text"
            id="name"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter name"
            className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 
              focus:outline-none focus:border-primary-400 focus:ring-1 
              focus:ring-primary-400 transition-colors duration-200"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            How often would you like to keep in touch? *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FREQUENCY_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, frequency: option.value }))}
                className={`p-3 text-sm font-medium rounded-xl transition-all duration-200 
                  ${form.frequency === option.value 
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-center px-3 py-2 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full px-6 py-3 text-white bg-primary-500 rounded-xl font-medium 
            hover:bg-primary-600 transition-all duration-200 shadow-sm hover:shadow-md 
            active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
            disabled:hover:bg-primary-500 disabled:hover:shadow-sm disabled:active:scale-100 
            inline-flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            'Adding Contact...'
          ) : (
            <>
              <UserPlusIcon className="w-5 h-5" />
              Add Contact
              <ChevronRightIcon className="w-5 h-5" />
            </>
          )}
        </button>
        <button
          onClick={onComplete}
          className="w-full px-6 py-3 text-gray-600 bg-gray-50 rounded-xl font-medium 
            hover:bg-gray-100 transition-all duration-200"
        >
          Skip For Now
        </button>
        <button
          onClick={onBack}
          className="w-full px-6 py-3 text-gray-500 hover:text-gray-700 rounded-xl 
            font-medium transition-colors duration-200"
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default OnboardingStep3;
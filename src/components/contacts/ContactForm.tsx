import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { Contact } from '../../lib/supabase/types';
import { contactsService } from '../../services/contacts';
import { contactValidationService } from '../../services/contact-validation';
import { useStore } from '../../stores/useStore';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { BasicInformation } from './BasicInformation';
import { ContactPreferences } from './ContactPreferences';
import { PersonalNotes } from './PersonalNotes';
import { ContactFormData, FormErrors } from './types';
import { initialFormData, initialErrors } from './utils';

/**
 * ContactForm component for creating and editing contacts
 * Manages form state and validation across child components
 */
export const ContactForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isPremium, isOnTrial } = useStore();
  const [formData, setFormData] = useState<ContactFormData>({
    ...initialFormData,
    user_id: user?.id || '',
  });
  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [isValidating, setIsValidating] = useState(false);
  const isEditMode = Boolean(id);

  // Fetch contact data in edit mode
  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactsService.getContact(id!),
    enabled: isEditMode,
  });

  // Update form data when contact is loaded
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

  // Update user_id when user changes
  useEffect(() => {
    if (user) {
      setFormData(current => ({
        ...current,
        user_id: user.id,
      }));
    }
  }, [user]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Mutations for creating and updating contacts
  const createMutation = useMutation({
    mutationFn: (data: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) =>
      contactsService.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate(-1);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ContactFormData> }) =>
      contactsService.updateContact(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate(-1);
    },
  });

  // Form validation
  const validateForm = async () => {
    if (!user?.id) {
      console.error('No user ID available');
      return false;
    }

    try {
      const { hasDuplicate, duplicates } = await contactValidationService.checkDuplicateName({
        name: formData.name.trim(),
        userId: user.id,
        contactId: isEditMode ? id : undefined
      });

      if (hasDuplicate) {
        setErrors(prev => ({
          ...prev,
          name: contactValidationService.formatDuplicateMessage(duplicates)
        }));
        return false;
      }

      setErrors(prev => ({ ...prev, name: '' }));
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    
    try {
      const isValid = await validateForm();
      if (!isValid) {
        setIsValidating(false);
        return;
      }

      if (isEditMode && id) {
        await updateMutation.mutateAsync({ id, updates: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setIsValidating(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      setIsValidating(false);
    }
  };

  // Loading state
  if (isEditMode && isLoadingContact) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-gray-500">Loading contact...</p>
      </div>
    );
  }

  // Event handlers for child components
  const handleFormDataChange = (updates: Partial<ContactFormData>) => {
    setFormData(current => ({ ...current, ...updates }));
  };

  const handleErrorChange = (updates: Partial<FormErrors>) => {
    setErrors(current => ({ ...current, ...updates }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -m-2 text-gray-400 hover:text-gray-500"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Contact Details
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <BasicInformation
          formData={formData}
          errors={errors}
          onChange={handleFormDataChange}
          onError={handleErrorChange}
        />

        <ContactPreferences
          formData={formData}
          errors={errors}
          onChange={handleFormDataChange}
          onError={handleErrorChange}
        />

        <PersonalNotes
          formData={formData}
          errors={errors}
          onChange={handleFormDataChange}
          onError={handleErrorChange}
          isPremium={isPremium}
          isOnTrial={isOnTrial}
        />

        {/* Action Buttons and Error Messages */}
        <div className="space-y-4">
          <div className="flex justify-center space-x-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-w-[140px] px-6 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium shadow-soft hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isValidating || createMutation.isPending || updateMutation.isPending}
            >
              {isValidating || createMutation.isPending || updateMutation.isPending ? (
                <>
                  <LoadingSpinner />
                  <span>Saving...</span>
                </>
              ) : 'Save Contact'}
            </button>
          </div>
          {/* Error Messages Section */}
          {errors.name && (
            <div className="px-4 py-2 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600 text-center">{errors.name}</p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ContactForm;
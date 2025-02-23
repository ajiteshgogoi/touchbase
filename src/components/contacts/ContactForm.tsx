import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { supabase } from '../../lib/supabase/client';

// Enable UTC plugin for consistent date handling
dayjs.extend(utc);
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { contactsService } from '../../services/contacts';
import { contactValidationService } from '../../services/contact-validation';
import { useStore } from '../../stores/useStore';
import { BasicInformation } from './BasicInformation';
import { ContactPreferences } from './ContactPreferences';
import { PersonalNotes } from './PersonalNotes';
import { ImportantEvents } from './ImportantEvents';
import { ContactFormData, FormErrors, ImportantEventFormData } from './types';
import { initialFormData, initialErrors, formatEventForInput, formatEventToUTC } from './utils';

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

  // Fetch important events in edit mode
  const { data: importantEvents } = useQuery({
    queryKey: ['important-events', id],
    queryFn: () => contactsService.getImportantEvents(id!),
    enabled: isEditMode,
  });

  // Update form data when contact and events are loaded
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
        important_events: [] // Will be populated when events are loaded
      });
    }
  }, [contact]);

  // Update important events when loaded
  useEffect(() => {
    if (importantEvents) {
      setFormData(current => ({
        ...current,
        important_events: importantEvents.map(event => {
          // Always format dates without timezone for datetime-local inputs
          return {
            id: event.id,
            type: event.type as ImportantEventFormData['type'],
            name: event.name,
            date: formatEventForInput(event.date)
          };
        })
      }));
    }
  }, [importantEvents]);

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
    mutationFn: async (data: ContactFormData) => {
      // Extract important_events from data and create contact without it
      const { important_events, ...contactData } = data;
      // First create the contact
      const contact = await contactsService.createContact(contactData);
      // Create any important events without triggering recalculation
      if (formData.important_events.length > 0) {
        await Promise.all(formData.important_events.map(event =>
          supabase
            .from('important_events')
            .insert({
              contact_id: contact.id,
              user_id: contact.user_id,
              type: event.type,
              name: event.name,
              date: formatEventToUTC(event.date) // Convert to UTC for storage
            })
        ));

        // Recalculate next contact due once after all events are added
        await contactsService.recalculateNextContactDue(contact.id);
      }
      
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['important-events'] });
      navigate(-1);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContactFormData> }) => {
      // Extract important_events from updates
      const { important_events, ...contactUpdates } = updates;
      // First update the contact
      const contact = await contactsService.updateContact(id, contactUpdates);
      
      // Then handle important events - we'll replace all events with new ones
      const currentEvents = await contactsService.getImportantEvents(id);
      
      // Delete all existing events (this also deletes associated reminders)
      await Promise.all(currentEvents.map(event =>
        contactsService.deleteImportantEvent(event.id, id)
      ));
      
      // Create new events without recalculating next contact due for each one
      if (formData.important_events.length > 0) {
        await Promise.all(formData.important_events.map(event =>
          // Use supabase directly to avoid triggering recalculation
          supabase
            .from('important_events')
            .insert({
              contact_id: id,
              user_id: contact.user_id,
              type: event.type,
              name: event.name,
              date: formatEventToUTC(event.date)
            })
        ));
      }

      // Recalculate next contact due once after all events are added
      await contactsService.recalculateNextContactDue(id);
      
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['important-events'] });
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

        <ImportantEvents
          formData={formData}
          errors={errors}
          onChange={handleFormDataChange}
          onError={handleErrorChange}
          isEditMode={isEditMode}
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
              <div className="w-[100px] flex justify-center">
                {isValidating || createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </>
                ) : (
                  'Save Contact'
                )}
              </div>
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
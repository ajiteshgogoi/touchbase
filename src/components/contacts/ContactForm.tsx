import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase/client';
import { contactsService } from '../../services/contacts';
import { contactValidationService } from '../../services/contact-validation';
import { useStore } from '../../stores/useStore';
import { BasicContactInfo } from './BasicContactInfo';
import { AdvancedContactInfo } from './AdvancedContactInfo';
import { ContactFormData, FormErrors } from './types';
import { initialFormData, initialErrors, formatEventToUTC } from './utils';

dayjs.extend(utc);

/**
 * ContactForm component for creating and editing contacts
 * Shows basic info by default with option to show advanced fields
 */
export const ContactForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isPremium, isOnTrial } = useStore();
  const [showAdvanced, setShowAdvanced] = useState(Boolean(id)); // Show advanced fields by default in edit mode
  const isEditMode = Boolean(id);

  // Fetch contact and events data in edit mode
  const { data: contactData, isLoading: isLoadingContact } = useQuery({
    queryKey: ['contact-with-events', id],
    queryFn: () => contactsService.getContactWithEvents(id!),
    enabled: isEditMode,
  });

  const [formData, setFormData] = useState<ContactFormData>({
    ...initialFormData,
    user_id: user?.id || '',
  });
  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [isValidating, setIsValidating] = useState(false);

  const handleNavigateBack = () => {
    navigate(-1);
  };

  // Fetch all contacts for hashtag suggestions
  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsService.getContacts(),
    enabled: !!user?.id,
  });

  // Update form data when contact and events are loaded
  useEffect(() => {
    if (contactData?.contact) {
      const contact = contactData.contact;
      setFormData({
        name: contact.name,
        phone: contact.phone || '',
        social_media_platform: contact.social_media_platform || null,
        social_media_handle: contact.social_media_handle || '',
        preferred_contact_method: contact.preferred_contact_method,
        notes: contact.notes || '',
        contact_frequency: contact.contact_frequency,
        user_id: contact.user_id,
        last_contacted: contact.last_contacted,
        next_contact_due: contact.next_contact_due,
        ai_last_suggestion: contact.ai_last_suggestion,
        ai_last_suggestion_date: contact.ai_last_suggestion_date,
        missed_interactions: contact.missed_interactions,
        important_events: contactData.events.map(event => ({
          id: event.id,
          type: event.type as any,
          name: event.name,
          date: event.date
        }))
      });
    }
  }, [contactData]);

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
      const { important_events, ...contactData } = data;
      const contact = await contactsService.createContact(contactData);
      
      if (formData.important_events.length > 0) {
        await Promise.all(formData.important_events.map(event =>
          supabase
            .from('important_events')
            .insert({
              contact_id: contact.id,
              user_id: contact.user_id,
              type: event.type,
              name: event.name,
              date: formatEventToUTC(event.date)
            })
        ));

        await contactsService.recalculateNextContactDue(contact.id);
      }
      
      return contact;
    },
    onSuccess: () => {
      // Update all related queries after successful creation
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['recent-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['total-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-hashtags'] });
      queryClient.invalidateQueries({ queryKey: ['contact-with-events'] });
      toast.success('Contact created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create contact. Please try again.');
      console.error('Error creating contact:', error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContactFormData> }) => {
      // Remove important_events from contact update
      const { important_events, ...contactUpdates } = updates;
      
      // First update the contact
      const contact = await contactsService.updateContact(id, contactUpdates);

      // --- Handle Important Events Deletion and Upsert ---

      // 1. Get IDs of existing events for this contact
      const { data: existingEvents, error: fetchError } = await supabase
        .from('important_events')
        .select('id')
        .eq('contact_id', id);

      if (fetchError) {
        console.error('Error fetching existing events:', fetchError);
        // Optionally throw error or handle it appropriately
        throw new Error('Failed to fetch existing events before update.');
      }

      const existingEventIds = existingEvents?.map(e => e.id) || [];
      const formEventIds = formData.important_events.map(e => e.id).filter(Boolean); // Filter out undefined/null IDs for new events

      // 2. Identify events to delete (exist in DB but not in form)
      const eventsToDeleteIds = existingEventIds.filter(existingId => !formEventIds.includes(existingId));

      // 3. Perform deletions if necessary
      if (eventsToDeleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('important_events')
          .delete()
          .in('id', eventsToDeleteIds);

        if (deleteError) {
          console.error('Error deleting events:', deleteError);
          // Optionally throw error or handle it appropriately
          throw new Error('Failed to delete removed events.');
        }
      }

      // 4. Perform upsert for events present in the form data
      if (formData.important_events.length > 0) {
        const upsertPromises = formData.important_events.map(event =>
          supabase
            .from('important_events')
            .upsert({
              id: event.id, // Let Supabase handle ID generation for new events if null/undefined
              contact_id: id,
              user_id: contact.user_id,
              type: event.type,
              name: event.name,
              date: formatEventToUTC(event.date)
            })
        );
        await Promise.all(upsertPromises);
      }
      // --- End Handle Important Events ---

      await contactsService.recalculateNextContactDue(id);
      
      return contact;
    },
    onSuccess: () => {
      // Update all related queries after successful update
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['recent-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['total-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-hashtags'] });
      queryClient.invalidateQueries({ queryKey: ['contact-with-events'] });
      queryClient.invalidateQueries({ queryKey: ['important-events'] });
      toast.success('Contact updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update contact. Please try again.');
      console.error('Error updating contact:', error);
    }
  });

  // Form submission handler with optimistic updates
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    
    try {
      if (!user?.id) {
        console.error('No user ID available');
        setIsValidating(false);
        return;
      }

      // Proceed with validation checks
      if (!formData.contact_frequency) {
        setErrors(current => ({
          ...current,
          frequency: 'Please select how often you want to keep in touch'
        }));
        setIsValidating(false);
        return;
      }

      // Check for duplicate names
      const { hasDuplicate, duplicates } = await contactValidationService.checkDuplicateName({
        name: formData.name.trim(),
        userId: user.id,
        contactId: isEditMode ? id : undefined
      });

      if (hasDuplicate) {
        setErrors(current => ({
          ...current,
          name: contactValidationService.formatDuplicateMessage(duplicates)
        }));
        setIsValidating(false);
        return;
      }

      // Proceed with optimistic update since duplicate check passed
      // Other validations already happen in real-time

      if (isEditMode && id) {
        // Helper functions for optimistic updates
        const updateContactCache = (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map(contact =>
            contact.id === id ? { ...contact, ...formData } : contact
          );
        };

        const updateContactWithEventsCache = (oldData: any) => {
          if (!oldData?.contact) return oldData;
          return {
            contact: { ...oldData.contact, ...formData },
            events: formData.important_events || []
          };
        };

        // Update all caches optimistically
        queryClient.setQueryData(['contacts'], updateContactCache);
        queryClient.setQueryData(['recent-contacts'], updateContactCache);
        queryClient.setQueryData(['contact-with-events', id], updateContactWithEventsCache);

        // Optimistically update the general important events cache
        queryClient.setQueryData(['important-events'], (oldEventsData: any) => {
          const updatedEventsForThisContact = (formData.important_events || []).map(event => ({
            ...event,
            contact_id: id, // Ensure contact_id is set
            user_id: formData.user_id // Ensure user_id is set
          }));
          if (!Array.isArray(oldEventsData)) return updatedEventsForThisContact;
          // Filter out all old events for this contact_id
          const otherEvents = oldEventsData.filter(event => event.contact_id !== id);
          // Add the current events from the form data
          return [...otherEvents, ...updatedEventsForThisContact];
        });

        // Update reminders cache if contact frequency changed
        if (contactData?.contact?.contact_frequency !== formData.contact_frequency) {
          const optimisticReminder = {
            id: `temp-reminder-${id}`,
            contact_id: id,
            user_id: formData.user_id,
            type: formData.preferred_contact_method || 'message',
            due_date: new Date().toISOString(),
            completed: false,
            created_at: new Date().toISOString()
          };

          queryClient.setQueryData(['reminders'], (oldData: any) => {
            if (!Array.isArray(oldData)) return [optimisticReminder];
            const filtered = oldData.filter(reminder =>
              reminder.contact_id !== id || reminder.name !== null
            );
            return [optimisticReminder, ...filtered];
          });
        }

        // Navigate immediately
        handleNavigateBack();

        // Perform the actual update in background
        updateMutation.mutate({ id, updates: formData }, {
          onError: (error) => {
            console.error('Error updating contact:', error);
            // Revert all optimistic updates
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            queryClient.invalidateQueries({ queryKey: ['recent-contacts'] });
            queryClient.invalidateQueries({ queryKey: ['contact-with-events'] });
            queryClient.invalidateQueries({ queryKey: ['reminders'] });
            queryClient.invalidateQueries({ queryKey: ['important-events'] }); // Revert optimistic event update
          }
        });
      } else {
        // For new contacts, optimistically add to cache with temporary ID
        const tempId = `temp-${Date.now()}`;
        const optimisticContact = {
          id: tempId,
          ...formData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Helper functions for optimistic updates
        const updateContactCache = (oldData: any) => {
          if (!Array.isArray(oldData)) return [optimisticContact];
          // New contacts should appear at start since they're newest
          return [optimisticContact, ...oldData];
        };

        const updateContactWithEventsCache = () => ({
          contact: optimisticContact,
          events: formData.important_events || []
        });

        // Update all caches optimistically
        queryClient.setQueryData(['contacts'], updateContactCache);
        queryClient.setQueryData(['recent-contacts'], updateContactCache);
        queryClient.setQueryData(['contact-with-events', tempId], updateContactWithEventsCache);

        // Optimistically update the general important events cache
        queryClient.setQueryData(['important-events'], (oldEventsData: any) => {
          const newEvents = (formData.important_events || []).map((event, index) => ({
            ...event,
            id: `temp-event-${tempId}-${index}-${Date.now()}`, // Need a temp unique ID for keys
            contact_id: tempId, // Associate with temp contact ID
            user_id: formData.user_id
          }));
          if (!Array.isArray(oldEventsData)) return newEvents;
          return [...oldEventsData, ...newEvents];
        });

        // Also update total contacts count
        queryClient.setQueryData(['total-contacts'], (old: number | undefined) =>
          (old || 0) + 1
        );

        // Update reminders cache if contact frequency is set
        if (formData.contact_frequency) {
          const optimisticReminder = {
            id: `temp-reminder-${tempId}`,
            contact_id: tempId,
            user_id: formData.user_id,
            type: formData.preferred_contact_method || 'message',
            due_date: new Date().toISOString(),
            completed: false,
            created_at: new Date().toISOString()
          };

          queryClient.setQueryData(['reminders'], (oldData: any) => {
            if (!Array.isArray(oldData)) return [optimisticReminder];
            return [optimisticReminder, ...oldData];
          });

          queryClient.setQueryData(['total-reminders'], (old: number | undefined) =>
            (old || 0) + 1
          );
        }

        // Navigate immediately after optimistic updates for better UX
        handleNavigateBack();

        // Create contact in background
        createMutation.mutate(formData, {
          onSuccess: (newContact) => {
            // Update cache with real contact ID
            const updateWithRealId = (oldData: any) => {
              if (!Array.isArray(oldData)) return oldData;
              return oldData.map(item =>
                item.id === tempId ? { ...item, id: newContact.id } : item
              );
            };

            queryClient.setQueryData(['contacts'], updateWithRealId);
            queryClient.setQueryData(['recent-contacts'], updateWithRealId);
            queryClient.setQueryData(['contact-with-events', newContact.id], (old: any) =>
              old ? { ...old, contact: { ...old.contact, id: newContact.id } } : old
            );
          },
          onError: (error) => {
            console.error('Error creating contact:', error);
            // Revert all optimistic updates
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            queryClient.invalidateQueries({ queryKey: ['recent-contacts'] });
            queryClient.invalidateQueries({ queryKey: ['contact-with-events'] });
            queryClient.invalidateQueries({ queryKey: ['total-contacts'] });
            queryClient.invalidateQueries({ queryKey: ['reminders'] });
            queryClient.invalidateQueries({ queryKey: ['total-reminders'] });
            queryClient.invalidateQueries({ queryKey: ['important-events'] }); // Revert optimistic event update
          }
        });
      }

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
    
    // Clear relevant error when field is updated
    if ('name' in updates && typeof updates.name === 'string' && updates.name.trim()) {
      setErrors(current => ({ ...current, name: '' }));
    }
    if ('contact_frequency' in updates && typeof updates.contact_frequency === 'string' && updates.contact_frequency) {
      setErrors(current => ({ ...current, frequency: '' }));
    }
  };

  const handleErrorChange = (updates: Partial<FormErrors>) => {
    setErrors(current => ({ ...current, ...updates }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => {
              e.preventDefault(); // Prevent any default form submission
              handleNavigateBack();
            }}
            type="button" // Explicitly set type to prevent form submission
            className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
              {isEditMode ? 'Edit Contact' : 'Add Contact'}
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-600/90">
              {isEditMode ? 'Update contact information' : 'Add someone you want to stay connected with'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <BasicContactInfo
          formData={formData}
          errors={errors}
          onChange={handleFormDataChange}
          onError={handleErrorChange}
        />

        <div className="flex items-start gap-3 px-1">
          <div className="flex h-6 items-center">
            <input
              id="showAdvanced"
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="showAdvanced" className="text-sm font-medium text-gray-700 hover:cursor-pointer">
              Add more information (optional)
            </label>
            <p className="text-xs text-gray-500">Add details only if it helps improve your relationship</p>
          </div>
        </div>

        {showAdvanced && (
          <AdvancedContactInfo
            formData={formData}
            errors={errors}
            onChange={handleFormDataChange}
            onError={handleErrorChange}
            isPremium={isPremium}
            isOnTrial={isOnTrial}
            isEditMode={isEditMode}
            contacts={allContacts.map(contact => ({
              ...contact,
              notes: contact.notes || ''
            }))}
          />
        )}

        {/* Action Buttons and Error Messages */}
        <div className="space-y-4">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-center gap-3">
            <button
              type="button"
              onClick={handleNavigateBack}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-gray-600 bg-gray-100/90 hover:bg-gray-200/90 active:scale-[0.98] transition-all duration-200 shadow-soft hover:shadow-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isValidating || createMutation.isPending || updateMutation.isPending}
            >
              <div className="flex justify-center min-w-[100px]">
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
          {(errors.name || errors.frequency || errors.phone || errors.social_media_handle) && (
            <div className="px-4 py-2 bg-red-50 rounded-lg space-y-1">
              {errors.name && <p className="text-sm text-red-600 text-center">{errors.name}</p>}
              {errors.frequency && <p className="text-sm text-red-600 text-center">{errors.frequency}</p>}
              {errors.phone && <p className="text-sm text-red-600 text-center">{errors.phone}</p>}
              {errors.social_media_handle && <p className="text-sm text-red-600 text-center">{errors.social_media_handle}</p>}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ContactForm;

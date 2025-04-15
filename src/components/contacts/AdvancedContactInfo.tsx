import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { HashtagHighlighter } from './HashtagHighlighter';
import { CalendarIcon, PlusIcon, XMarkIcon, CakeIcon, HeartIcon, StarIcon } from '@heroicons/react/24/outline';
import { ContactFormProps } from './types';
import {
  isValidPhoneNumber,
  isValidEmail,
  isValidSocialHandle,
  isValidEventName,
  formatEventDate,
  getEventTypeDisplay,
  formatEventToUTC,
  sortEventsByType,
  filterHashtagSuggestions,
  getAllUniqueHashtags,
  formatSocialMediaUrl
} from './utils';
import { HashtagSuggestions } from './HashtagSuggestions';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const getEventIcon = (type: string) => {
  switch (type) {
    case 'birthday':
      return <CakeIcon className="h-5 w-5 text-primary-600" />;
    case 'anniversary':
      return <HeartIcon className="h-5 w-5 text-primary-600" />;
    case 'custom':
      return <StarIcon className="h-5 w-5 text-primary-600" />;
    default:
      return <CalendarIcon className="h-5 w-5 text-primary-600" />;
  }
};

/**
 * Component for additional contact information fields
 */
interface AdvancedContactInfoProps extends ContactFormProps {
  isPremium?: boolean;
  isOnTrial?: boolean;
  contacts?: Array<{ notes: string }>;
}

export const AdvancedContactInfo = ({
  formData,
  errors,
  onChange,
  onError,
  isPremium,
  isOnTrial,
  contacts = []
}: AdvancedContactInfoProps) => {
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<'birthday' | 'anniversary' | 'custom'>(
    formData.important_events.some(event => event.type === 'birthday') ? 'custom' : 'birthday'
  );
  const [eventNameLength, setEventNameLength] = useState(0);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const allHashtags = getAllUniqueHashtags(contacts);

  // Update hashtag suggestions when typing
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const truncatedValue = value.slice(0, 500);
    
    // Count complete and potential hashtags
    const completeHashtags = (truncatedValue.match(/#[a-zA-Z]\w*/g) || []).length;
    const potentialHashtags = (truncatedValue.match(/#/g) || []).length;
    
    // Show error when typing 6th hashtag (complete or just #)
    if (completeHashtags > 5 || potentialHashtags > 5) {
      onError({ notes: 'Max 5 hashtags allowed' });
      setShowHashtagSuggestions(false);
      return;
    } else {
      onError({ notes: '' });
    }

    onChange({ notes: truncatedValue });

    // Handle hashtag suggestions only if we haven't reached max hashtags (including potential ones)
    const suggestions = filterHashtagSuggestions(truncatedValue, allHashtags);
    setHashtagSuggestions(suggestions);
    
    if (suggestions.length > 0 && potentialHashtags <= 5) {
      setShowHashtagSuggestions(true);
    } else {
      setShowHashtagSuggestions(false);
    }
  };

  // Handle hashtag selection from suggestions
  const handleHashtagSelect = (hashtag: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const cursorPosition = textarea.selectionEnd;
      const text = textarea.value;
      
      // Find the last word before cursor
      const textBeforeCursor = text.substring(0, cursorPosition);
      const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
      const start = lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1;
      
      // Replace the partial hashtag with the selected one
      const newText = text.substring(0, start) + hashtag + text.substring(cursorPosition);
      onChange({ notes: newText });
      
      // Hide suggestions
      setShowHashtagSuggestions(false);
    }
  };

  const handleAddEvent = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const typeSelect = document.getElementById('event-type') as HTMLSelectElement;
    const dateInput = document.getElementById('event-date') as HTMLInputElement;
    const nameInput = document.getElementById('event-name') as HTMLInputElement;

    const type = typeSelect.value as 'birthday' | 'anniversary' | 'custom';
    const rawDate = dateInput.value;
    const name = nameInput.value;

    const newErrors = [];

    if (type === 'birthday' || type === 'anniversary') {
      const hasExistingEvent = formData.important_events.some(event => event.type === type);
      if (hasExistingEvent) {
        newErrors.push(`${type} has already been added. Only one ${type} is allowed.`);
      }
    }

    if (type === 'custom' && !isValidEventName(name)) {
      newErrors.push('Custom events require a name between 1 and 50 characters');
    }

    if (!rawDate) {
      newErrors.push('Date is required');
    }

    if (newErrors.length > 0) {
      onError({ important_events: newErrors });
      return;
    }

    const newEvent = {
      type,
      date: formatEventToUTC(rawDate),
      name: type === 'custom' ? name : null
    };

    onChange({
      important_events: [...formData.important_events, newEvent]
    });

    typeSelect.value = 'birthday';
    dateInput.value = '';
    nameInput.value = '';
    setShowNewEventForm(false);
    setSelectedEventType(formData.important_events.some(event => event.type === 'birthday') ? 'custom' : 'birthday');
    setEventNameLength(0);
    onError({ important_events: [] });
  };

  const handleRemoveEvent = (eventToRemove: typeof formData.important_events[0]) => {
    onChange({
      important_events: formData.important_events.filter(event =>
        !(event.type === eventToRemove.type && event.date === eventToRemove.date && event.name === eventToRemove.name)
      )
    });
  };

  return (
    <div className="space-y-8">
      {/* Contact Methods */}
      <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft p-6 hover:bg-white/70 dark:hover:bg-gray-900/70 hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
        <h3 className="text-lg font-[600] text-gray-900/90 dark:text-white mb-6">Contact Methods</h3>
        <div className="space-y-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email Field */}
              <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => {
                  const value = e.target.value;
                  onChange({ email: value });
                }}
                onInput={(e) => {
                  const value = (e.target as HTMLInputElement).value;
                  if (value && !isValidEmail(value)) {
                    onError({
                      email: 'Please enter a valid email address'
                    });
                  } else {
                    onError({ email: '' });
                  }
                }}
                className="mt-1 block w-full rounded-lg border-gray-200 dark:border-gray-700 px-4 py-2.5 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Phone Number Field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value;
                  onChange({ phone: value });
                }}
                onInput={(e) => {
                  const value = (e.target as HTMLInputElement).value;
                  if (value && !isValidPhoneNumber(value)) {
                    onError({
                      phone: 'Please enter a valid phone number (e.g., +1-1234567890)'
                    });
                  } else {
                    onError({ phone: '' });
                  }
                }}
                className="mt-1 block w-full rounded-lg border-gray-200 dark:border-gray-700 px-4 py-2.5 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Enter phone number"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.phone}</p>
              )}
              </div>
            </div>

            {/* Social Media Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Social Media</label>
              <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <select
                    value={formData.social_media_platform || ''}
                    onChange={(e) => {
                      const platform = e.target.value || null;
                      onChange({
                        social_media_platform: platform as any,
                        social_media_handle: '' // Reset handle when platform changes
                      });
                    }}
                    className="w-full rounded-lg border-gray-200 dark:border-gray-700 px-4 py-2.5 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select Platform</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="instagram">Instagram</option>
                    <option value="twitter">Twitter</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value={formData.social_media_handle}
                    onChange={(e) => {
                      const value = e.target.value.replace(/^@+/, ''); // Remove leading @ symbols
                      onChange({ social_media_handle: value });
                    }}
                    onInput={(e) => {
                      const value = (e.target as HTMLInputElement).value.replace(/^@+/, '');
                      
                      // Clear error if value is empty
                      if (!value) {
                        onError({ social_media_handle: '' });
                        return;
                      }

                      // Validate based on platform selection
                      if (!formData.social_media_platform) {
                        onError({
                          social_media_handle: 'Please select a platform first'
                        });
                      } else if (isValidSocialHandle(value, formData.social_media_platform)) {
                        onError({ social_media_handle: '' });
                      } else {
                        onError({
                          social_media_handle: 'Username can only contain letters, numbers, dots, and underscores'
                        });
                      }
                    }}
                    placeholder={formData.social_media_platform
                      ? "Enter username (e.g., johndoe)"
                      : "Select a platform first"}
                    className="w-full rounded-lg border-gray-200 dark:border-gray-700 px-4 py-2.5 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              </div>
              {errors.social_media_handle && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.social_media_handle}</p>
              )}
              {formData.social_media_handle && formData.social_media_platform && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  URL: {formatSocialMediaUrl(formData.social_media_handle, formData.social_media_platform)}
                </p>
              )}
            </div>
          </div>

            {/* Preferred Contact Method */}
            <div>
            <label htmlFor="preferred_contact_method" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Preferred Contact Method
            </label>
            <select
              id="preferred_contact_method"
              value={formData.preferred_contact_method || ''}
              onChange={(e) => onChange({
                preferred_contact_method: e.target.value as ContactFormProps['formData']['preferred_contact_method']
              })}
              className="mt-1 block w-full rounded-lg border-gray-200 dark:border-gray-700 px-4 py-2.5 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">No preference</option>
              <option value="email">Email</option>
              <option value="call">Call</option>
              <option value="message">Message</option>
              <option value="social">Social Media</option>
            </select>
          </div>

        </div>
      </div>

      {/* Important Events */}
      <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft p-6 hover:bg-white/70 dark:hover:bg-gray-900/70 hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-[600] text-gray-900/90 dark:text-white">Important Events</h2>
            </div>           
            <p className="mt-1.5 text-[15px] text-gray-600/90 dark:text-gray-400">Add yearly recurring events (birthday, anniversary, etc.)</p>
          </div>
          {formData.important_events.length < 5 && (
            <button
              type="button"
              onClick={() => {
                // Determine the default event type based on availability
                const canAddBirthday = !formData.important_events.some(event => event.type === 'birthday');
                const canAddAnniversary = !formData.important_events.some(event => event.type === 'anniversary');
                let defaultEventType: 'birthday' | 'anniversary' | 'custom' = 'custom';
                if (canAddBirthday) {
                  defaultEventType = 'birthday';
                } else if (canAddAnniversary) {
                  defaultEventType = 'anniversary';
                }
                setSelectedEventType(defaultEventType);
                setShowNewEventForm(true);
              }}
              className="inline-flex items-center justify-center text-center px-5 py-3 rounded-xl text-[15px] font-[500] text-primary-600 dark:text-primary-400 bg-primary-50/90 dark:bg-primary-900/30 hover:bg-primary-100/90 dark:hover:bg-primary-900/50 active:scale-[0.98] shadow-soft dark:shadow-soft hover:shadow-md dark:hover:shadow-lg transition-all duration-200"
            >
              <PlusIcon className="h-4 w-4 mr-1.5" />
              Add Event
            </button>
          )}
        </div>

        {/* Existing events list */}
        <div className="space-y-4 mb-6">
          {formData.important_events.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No important events added yet</p>
          ) : (
            sortEventsByType(formData.important_events).map((event, index) => (
              <div
                key={index}
                className="flex flex-wrap sm:flex-nowrap items-start justify-between py-2 px-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg group gap-2"
              >
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="p-1.5 sm:p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">
                      {getEventTypeDisplay(event.type, event.name)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                      {formatEventDate(event.date)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEvent(event)}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  title="Remove event"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* New event form */}
        {showNewEventForm && (
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event Type *
                </label>
                <select
                  id="event-type"
                  required
                  className="mt-1 block w-full rounded-lg border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value as 'birthday' | 'anniversary' | 'custom')}
                >
                  {!formData.important_events.some(event => event.type === 'birthday') && (
                    <option value="birthday">Birthday</option>
                  )}
                  {!formData.important_events.some(event => event.type === 'anniversary') && (
                    <option value="anniversary">Anniversary</option>
                  )}
                  <option value="custom">Custom Event</option>
                </select>
              </div>
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Event Date *
                </label>
                <input
                  type="date"
                  id="event-date"
                  required
                  defaultValue={dayjs().format('YYYY-MM-DD')}
                  key={showNewEventForm ? 'new' : 'edit'}
                  className="mt-1 block w-full rounded-lg border-gray-200 dark:border-gray-700 shadow-sm focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert-[0.4] dark:[&::-webkit-calendar-picker-indicator]:invert-[0.65]"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Events will recur yearly on this date
                </p>
              </div>
            </div>

            <div className="custom-event-name">
              <label htmlFor="event-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Event Name (for custom events)
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  id="event-name"
                  className={`block w-full rounded-lg border-gray-200 dark:border-gray-700 shadow-sm ${
                    selectedEventType !== 'custom'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                  }`}
                  placeholder="Enter event name"
                  maxLength={50}
                  onChange={(e) => setEventNameLength(e.target.value.length)}
                  disabled={selectedEventType !== 'custom'}
                />
                <div className={`mt-1 text-xs text-gray-500 dark:text-gray-400 text-right ${selectedEventType === 'custom' ? 'visible' : 'invisible'}`}>
                  {eventNameLength}/50 characters
                </div>
              </div>
            </div>

            {errors.important_events && errors.important_events.length > 0 && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-4">
                {errors.important_events.map((error, index) => (
                  <p key={index} className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNewEventForm(false);
                  setSelectedEventType(formData.important_events.some(event => event.type === 'birthday') ? 'custom' : 'birthday');
                  setEventNameLength(0);
                  onError({ important_events: [] });
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-gray-600 dark:text-gray-300 bg-gray-100/90 dark:bg-gray-800/90 hover:bg-gray-200/90 dark:hover:bg-gray-700/90 active:scale-[0.98] transition-all duration-200 shadow-soft dark:shadow-soft-dark hover:shadow-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddEvent}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 shadow-soft dark:shadow-soft-dark hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                Save Event
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Personal Notes */}
      <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft p-6 hover:bg-white/70 dark:hover:bg-gray-900/70 hover:shadow-md dark:hover:shadow-lg transition-all duration-200">
        <h3 className="text-lg font-[600] text-gray-900/90 dark:text-white mb-6">Personal Notes</h3>
        <div>
          {/* Note Guidelines */}
          <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Add meaningful details to help maintain your connection:
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>Use hashtags to categorise (#family, #friend, #colleague) — max 5 tags</li>
              <li>Include their interests (#sports, #music) and conversation topics</li>
              <li>Add personal context like family details or shared memories</li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Hashtag format: # followed by letter. Only letters/numbers/underscores. Max 15 characters.
            </p>
          </div>

          {/* Premium Upgrade Message */}
          {!isPremium && !isOnTrial && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                  Upgrade to Premium
                </Link> to get personalised suggestions based on your notes!
              </p>
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={handleNotesChange}
              maxLength={500}
              className="mt-1 block w-full rounded-lg border-gray-200 dark:border-gray-700 px-[14px] py-[9px] focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="E.g., #Friend from school. We #workout together. Works in #tech. Has 2 kids: Gloria and Tom."
            />
            <HashtagHighlighter
              text={formData.notes}
              textarea={textareaRef.current}
            />
            <HashtagSuggestions
              suggestions={hashtagSuggestions}
              onSelect={handleHashtagSelect}
              referenceElement={textareaRef.current}
              visible={showHashtagSuggestions}
            />
          </div>
          <div className="mt-2">
            <div className="flex justify-between items-center h-5">
              {errors.notes && (
                <span className="text-sm text-red-600 dark:text-red-400 truncate max-w-[70%]">{errors.notes}</span>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto shrink-0">
                {formData.notes.length}/500 characters
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
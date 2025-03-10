import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { HashtagHighlighter } from './HashtagHighlighter';
import { CalendarIcon, PlusIcon, XMarkIcon, CakeIcon, HeartIcon, StarIcon } from '@heroicons/react/24/outline';
import { ContactFormProps } from './types';
import {
  isValidPhoneNumber,
  isValidSocialHandle,
  isValidEventName,
  formatEventDate,
  getEventTypeDisplay,
  formatEventToUTC,
  sortEventsByType,
  filterHashtagSuggestions,
  getAllUniqueHashtags
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
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });
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
      const textarea = textareaRef.current;
      if (textarea) {
        // Create a temporary div to measure text width
        const { scrollTop, selectionEnd } = textarea;
        const textareaStyles = window.getComputedStyle(textarea);
        const lineHeight = parseInt(textareaStyles.lineHeight);
        const paddingTop = parseInt(textareaStyles.paddingTop);
        const paddingLeft = parseInt(textareaStyles.paddingLeft);
        
        // Create measurement div
        const div = document.createElement('div');
        div.style.cssText = textareaStyles.cssText || '';
        div.style.height = 'auto';
        div.style.width = `${textarea.clientWidth}px`;
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.overflowWrap = 'break-word';
        div.style.overflow = 'hidden';
        document.body.appendChild(div);

        // Get text before cursor and measure
        const textBeforeCursor = truncatedValue.substring(0, selectionEnd);
        const lines = textBeforeCursor.split('\n');
        const lastLine = lines[lines.length - 1];
        
        div.textContent = textBeforeCursor || '';
        const textHeight = div.scrollHeight;
        const currentLineNumber = Math.floor(textHeight / lineHeight);

        // Measure last line width
        div.textContent = lastLine || '';
        const lastLineWidth = Math.min(div.scrollWidth, textarea.clientWidth - paddingLeft * 2);

        document.body.removeChild(div);
        
        // Get textarea dimensions
        const textareaRect = textarea.getBoundingClientRect();
        const textareaBottom = textareaRect.height - 40; // Keep space for suggestions
        
        // Calculate vertical position
        let suggestTop = currentLineNumber * lineHeight - scrollTop + paddingTop;
        
        // If we're too close to the bottom, show above the text
        if (suggestTop > textareaBottom - lineHeight) {
          suggestTop = Math.max(currentLineNumber * lineHeight - scrollTop - 120, 0); // 120px for suggestion box
        }
        
        // Calculate horizontal position, keeping close to cursor
        const position = {
          top: Math.min(suggestTop, textareaBottom),
          left: Math.min(
            Math.max(lastLineWidth - 20, paddingLeft), // Closer to cursor, but not too far left
            textareaRect.width - 170 // Account for suggestion width
          )
        };
        setSuggestionPosition(position);
        setShowHashtagSuggestions(true);
      }
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

  const handleRemoveEvent = (index: number) => {
    onChange({
      important_events: formData.important_events.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-8">
      {/* Contact Methods */}
      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-6 hover:bg-white/70 hover:shadow-md transition-all duration-200">
        <h3 className="text-lg font-[600] text-gray-900/90 mb-6">Contact Methods</h3>
        <div className="space-y-6">
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
                className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
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
                className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
                placeholder="@username"
              />
              {errors.social_media_handle && (
                <p className="mt-1 text-sm text-red-600">{errors.social_media_handle}</p>
              )}
            </div>
          </div>

          {/* Preferred Contact Method */}
          <div>
            <label htmlFor="preferred_contact_method" className="block text-sm font-medium text-gray-700">
              Preferred Contact Method
            </label>
            <select
              id="preferred_contact_method"
              value={formData.preferred_contact_method || ''}
              onChange={(e) => onChange({
                preferred_contact_method: e.target.value as ContactFormProps['formData']['preferred_contact_method']
              })}
              className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
            >
              <option value="">No preference</option>
              <option value="call">Call</option>
              <option value="message">Message</option>
              <option value="social">Social Media</option>
            </select>
          </div>

        </div>
      </div>

      {/* Important Events */}
      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-6 hover:bg-white/70 hover:shadow-md transition-all duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-[600] text-gray-900/90">Important Events</h2>
            </div>
            <p className="mt-1.5 text-[15px] text-gray-600/90">
              Add yearly recurring events (birthday, anniversary, etc.)
            </p>
          </div>
          {formData.important_events.length < 5 && (
            <button
              type="button"
              onClick={() => setShowNewEventForm(true)}
              className="inline-flex items-center justify-center text-center px-5 py-3 rounded-xl text-[15px] font-[500] text-primary-600 bg-primary-50/90 hover:bg-primary-100/90 active:scale-[0.98] shadow-soft hover:shadow-md transition-all duration-200"
            >
              <PlusIcon className="h-4 w-4 mr-1.5" />
              Add Event
            </button>
          )}
        </div>

        {/* Existing events list */}
        <div className="space-y-4 mb-6">
          {formData.important_events.length === 0 ? (
            <p className="text-sm text-gray-500">No important events added yet</p>
          ) : (
            sortEventsByType(formData.important_events).map((event, index) => (
              <div
                key={index}
                className="flex flex-wrap sm:flex-nowrap items-start justify-between py-2 px-3 sm:p-4 bg-gray-50 rounded-lg group gap-2"
              >
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="p-1.5 sm:p-2 bg-primary-50 rounded-lg shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="text-sm font-medium text-gray-900 truncate leading-tight">
                      {getEventTypeDisplay(event.type, event.name)}
                    </div>
                    <div className="text-sm text-gray-500 leading-tight mt-0.5">
                      {formatEventDate(event.date)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEvent(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
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
                <label htmlFor="event-type" className="block text-sm font-medium text-gray-700">
                  Event Type *
                </label>
                <select
                  id="event-type"
                  required
                  className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
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
                <label htmlFor="event-date" className="block text-sm font-medium text-gray-700">
                  Event Date *
                </label>
                <input
                  type="date"
                  id="event-date"
                  required
                  defaultValue={dayjs().format('YYYY-MM-DD')}
                  key={showNewEventForm ? 'new' : 'edit'}
                  className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Events will recur yearly on this date
                </p>
              </div>
            </div>

            <div className="custom-event-name">
              <label htmlFor="event-name" className="block text-sm font-medium text-gray-700">
                Event Name (for custom events)
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  id="event-name"
                  className={`block w-full rounded-lg border-gray-200 shadow-sm ${
                    selectedEventType !== 'custom'
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400'
                  }`}
                  placeholder="Enter event name"
                  maxLength={50}
                  onChange={(e) => setEventNameLength(e.target.value.length)}
                  disabled={selectedEventType !== 'custom'}
                />
                <div className={`mt-1 text-xs text-gray-500 text-right ${selectedEventType === 'custom' ? 'visible' : 'invisible'}`}>
                  {eventNameLength}/50 characters
                </div>
              </div>
            </div>

            {errors.important_events && errors.important_events.length > 0 && (
              <div className="rounded-lg bg-red-50 p-4">
                {errors.important_events.map((error, index) => (
                  <p key={index} className="text-sm text-red-600">
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
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-gray-600 bg-gray-100/90 hover:bg-gray-200/90 active:scale-[0.98] transition-all duration-200 shadow-soft hover:shadow-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddEvent}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                Save Event
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Personal Notes */}
      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-6 hover:bg-white/70 hover:shadow-md transition-all duration-200">
        <h3 className="text-lg font-[600] text-gray-900/90 mb-6">Personal Notes</h3>
        <div>
          {/* Premium/Trial Feature Info */}
          {(isPremium || isOnTrial) ? (
            <div className="mb-4 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                Add meaningful details to help maintain your connection:
              </p>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Use hashtags to categorise (#family, #friend, #colleague) — max 5 tags</li>
                <li>Include their interests (#sports, #music) and conversation topics</li>
                <li>Add personal context like family details or shared memories</li>
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Hashtag format: # followed by letter. Only letters/numbers/underscores. Max 15 characters.
              </p>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                Add details that can help maintain the connection.
                <span className="block mt-2">
                  ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">
                    Upgrade to Premium
                  </Link> to get personalised suggestions based on your notes!
                </span>
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
              className="mt-1 block w-full rounded-lg border-gray-200 px-4 py-2.5 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 shadow-sm hover:border-gray-300 transition-colors"
              placeholder="E.g., #friend from school. Loves hiking and photography. #sports enthusiast"
            />
            <HashtagHighlighter
              text={formData.notes}
              textarea={textareaRef.current}
            />
            <HashtagSuggestions
              suggestions={hashtagSuggestions}
              onSelect={handleHashtagSelect}
              position={suggestionPosition}
              visible={showHashtagSuggestions}
            />
          </div>
          <div className="mt-2">
            <div className="flex justify-between items-center h-5">
              {errors.notes && (
                <span className="text-sm text-red-600 truncate max-w-[70%]">{errors.notes}</span>
              )}
              <span className="text-sm text-gray-500 ml-auto shrink-0">
                {formData.notes.length}/500 characters
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
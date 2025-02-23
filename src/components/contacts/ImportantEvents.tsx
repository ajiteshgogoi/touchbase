import { useState } from 'react';
import { CalendarIcon, PlusIcon, XMarkIcon, CakeIcon, HeartIcon, StarIcon } from '@heroicons/react/24/outline';
import { ContactFormProps } from './types';
import { isValidEventName, formatEventDate, getEventTypeDisplay, formatEventToUTC } from './utils';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Enable UTC plugin for dayjs for consistent date handling
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
 * ImportantEvents component for managing a contact's important recurring events
 * like birthdays, anniversaries, and custom events
 */
export const ImportantEvents = ({
  formData,
  errors,
  onChange,
  onError
}: ContactFormProps) => {
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<'birthday' | 'anniversary' | 'custom'>(
    formData.important_events.some(event => event.type === 'birthday') ? 'custom' : 'birthday'
  );
  const [eventNameLength, setEventNameLength] = useState(0);

  /**
   * Handle adding a new important event
   * Standardizes date format using dayjs for consistent timezone handling
   * Events are collected in formData and saved together with contact
   */
  const handleAddEvent = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Get form data from refs instead of form submission
    const typeSelect = document.getElementById('event-type') as HTMLSelectElement;
    const dateInput = document.getElementById('event-date') as HTMLInputElement;
    const nameInput = document.getElementById('event-name') as HTMLInputElement;

    const type = typeSelect.value as 'birthday' | 'anniversary' | 'custom';
    const rawDate = dateInput.value;
    const name = nameInput.value;

    // Validate the event
    const newErrors = [];

    // Check for duplicate birthday or anniversary
    if (type === 'birthday' || type === 'anniversary') {
      const hasExistingEvent = formData.important_events.some(event => event.type === type);
      if (hasExistingEvent) {
        newErrors.push(`${type} has already been added. Only one ${type} is allowed.`);
      }
    }

    // Validate custom event name
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

    // Add the new event with properly formatted date in UTC
    // The date is stored in YYYY-MM-DDThh:mm format without timezone suffix
    // to maintain compatibility with datetime-local input while preserving UTC time
    const newEvent = {
      type,
      date: formatEventToUTC(rawDate),
      name: type === 'custom' ? name : null
    };

    onChange({
      important_events: [...formData.important_events, newEvent]
    });

    // Clear inputs and hide form
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
    <div className="bg-white rounded-xl shadow-soft p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Important Events</h2>
          <p className="text-sm text-gray-600 mt-1">
            Add yearly recurring events (birthday, anniversary, etc.)
          </p>
        </div>
        {formData.important_events.length < 5 && (
          <button
            type="button"
            onClick={() => setShowNewEventForm(true)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
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
          formData.important_events.map((event, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg group"
            >
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary-50 rounded-lg">
                  {getEventIcon(event.type)}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    {getEventTypeDisplay(event.type)}
                    {event.type === 'custom' && `: ${event.name}`}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {/* Show month, day and time in local timezone */}
                    {formatEventDate(event.date)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveEvent(index)}
                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove event"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* New event section */}
      {showNewEventForm && (
        <div className="space-y-4 border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-type" className="block text-sm font-medium text-gray-700">
                Event Type *
              </label>
              <select
                id="event-type"
                required
                className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-primary-400 focus:ring-primary-400"
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
              {/* Show stored date if editing, otherwise current time */}
              <input
                type="date"
                id="event-date"
                required
                defaultValue={dayjs().format('YYYY-MM-DD')}
                key={showNewEventForm ? 'new' : 'edit'} // Force re-render on form toggle
                className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-primary-400 focus:ring-primary-400"
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
                  : 'focus:border-primary-400 focus:ring-primary-400'
                }`}
                placeholder="Enter event name"
                maxLength={50}
                onChange={(e) => setEventNameLength(e.target.value.length)}
                disabled={selectedEventType !== 'custom'}
              />
              {selectedEventType === 'custom' && (
                <div className="mt-1 text-xs text-gray-500 text-right">
                  {eventNameLength}/50 characters
                </div>
              )}
            </div>
          </div>

          {errors.important_events.length > 0 && (
            <div className="rounded-lg bg-red-50 p-4">
              {errors.important_events.map((error, index) => (
                <p key={index} className="text-sm text-red-600">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowNewEventForm(false);
                setSelectedEventType(formData.important_events.some(event => event.type === 'birthday') ? 'custom' : 'birthday');
                setEventNameLength(0);
                onError({ important_events: [] });
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddEvent}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Save Event
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
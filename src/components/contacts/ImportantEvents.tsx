import { useState } from 'react';
import { CalendarIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ContactFormProps } from './types';
import { isValidEventDate, isValidEventName, formatEventDate, getEventTypeDisplay } from './utils';

/**
 * ImportantEvents component for managing a contact's important dates
 * like birthdays, anniversaries, and custom events
 */
export const ImportantEvents = ({
  formData,
  errors,
  onChange,
  onError
}: ContactFormProps) => {
  const [showNewEventForm, setShowNewEventForm] = useState(false);

  const handleAddEvent = (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formDataObj = new FormData(form);
    
    const type = formDataObj.get('type') as 'birthday' | 'anniversary' | 'custom';
    const date = formDataObj.get('date') as string;
    const name = formDataObj.get('name') as string;

    // Validate the event
    const newErrors = [];
    if (!isValidEventDate(date)) {
      newErrors.push('Event date cannot be in the past');
    }
    if (type === 'custom' && !isValidEventName(name)) {
      newErrors.push('Custom events require a name (max 100 characters)');
    }

    if (newErrors.length > 0) {
      onError({ important_events: newErrors });
      return;
    }

    // Add the new event
    const newEvent = {
      type,
      date,
      name: type === 'custom' ? name : null
    };

    onChange({
      important_events: [...formData.important_events, newEvent]
    });

    // Clear the form and hide it
    form.reset();
    setShowNewEventForm(false);
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
        <h2 className="text-lg font-semibold text-gray-800">Important Events</h2>
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
                  <CalendarIcon className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    {getEventTypeDisplay(event.type)}
                    {event.type === 'custom' && `: ${event.name}`}
                  </h3>
                  <p className="text-sm text-gray-500">
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

      {/* New event form */}
      {showNewEventForm && (
        <form onSubmit={handleAddEvent} className="space-y-4 border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Event Type *
              </label>
              <select
                id="type"
                name="type"
                required
                className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-primary-400 focus:ring-primary-400"
                defaultValue="birthday"
              >
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="custom">Custom Event</option>
              </select>
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                required
                className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-primary-400 focus:ring-primary-400"
              />
            </div>
          </div>

          <div className="custom-event-name">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Event Name (for custom events)
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-primary-400 focus:ring-primary-400"
              placeholder="Enter event name"
            />
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
                onError({ important_events: [] });
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Save Event
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
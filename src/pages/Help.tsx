import {
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  LightBulbIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  DevicePhoneMobileIcon,
  CalendarIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export const Help = () => {
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const sections = [
    {
      id: 'contacts',
      title: 'Adding Contacts',
      icon: UserPlusIcon,
      description: 'Create and manage your contacts effectively',
      content: (
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Click the 'Add Contact' button on the dashboard</li>
          <li>Fill in their name (required)</li>
          <li>Add their phone number and/or social media handle (optional)</li>
          <li>Set your preferred contact method and frequency</li>
          <li>Use the relationship closeness slider to indicate how close you are</li>
          <li>Add important recurring events (birthdays, anniversaries, etc.)</li>
          <li>Add personal notes to help maintain the relationship</li>
          <div className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
            <strong>Pro Tip:</strong> You can add up to 5 important events per contact, including one birthday and one anniversary. Custom events give you flexibility to track any recurring date that matters to your relationship.
          </div>
        </ol>
      )
    },
    {
      id: 'interactions',
      title: 'Logging Interactions',
      icon: ChatBubbleLeftRightIcon,
      description: 'Keep track of your conversations and meetings',
      content: (
        <>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Click 'Log Interaction' on any contact's card</li>
            <li>Select the type of interaction (call, message, social or meeting)</li>
            <li>Choose when it happened (just now, today, yesterday, etc.)</li>
            <li>Add optional notes about the interaction</li>
            <li>Rate how the interaction went</li>
          </ol>
          <div className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
            <strong>Pro Tip:</strong> Regular logging helps TouchBase provide better reminders and insights about your relationships.
          </div>
        </>
      )
    },
    {
      id: 'reminders',
      title: 'Quick Reminders',
      icon: CalendarIcon,
      description: 'Set up one-time reminders for special occasions',
      content: (
        <>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Go to Reminders page and click 'Add Quick Reminder'</li>
            <li>Pick the contact for whom you want to set a quick reminder</li>
            <li>Enter the reminder description</li>
            <li>Set the due date</li>
            <li>Optionally mark it as important to show in Important Events timeline</li>
          </ol>
          <div className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
            <strong>Pro Tip:</strong> Quick reminders are perfect for one-time events. Mark them as important to highlight key events in your timeline without affecting regular contact schedules.
          </div>
        </>
      )
    },
    {
      id: 'analytics',
      title: 'Detailed Analytics',
      icon: ChartBarIcon,
      description: 'Get insights into your relationships',
      content: (
        <>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Click 'Get Detailed Analytics' on the dashboard</li>
            <li>View your interaction patterns through the heatmap visualisation</li>
            <li>See your top engaged contacts and their interaction frequencies</li>
            <li>Identify relationships that need attention</li>
            <li>Get AI-powered insights about your interactions with each contact</li>
          </ol>
          <div className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
            <strong>Pro Tip:</strong> Analytics are generated on demand and saved for you to revisit anytime. The insights help you understand your relationship patterns and make meaningful improvements.
          </div>
        </>
      )
    },
    {
      id: 'notifications',
      title: 'Enabling Notifications',
      icon: BellIcon,
      description: 'Stay updated with timely reminders',
      content: (
        <>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Go to Settings in the profile menu</li>
            <li>Find the 'Notification Preferences' section</li>
            <li>Toggle on notifications</li>
            <li>Allow notification permissions when prompted</li>
            <li>Set your timezone for accurate reminder timing</li>
          </ol>
          <div className="mt-4 text-sm bg-yellow-50 p-3 rounded-lg">
            <strong>Important:</strong> Enabling notifications is crucial for receiving timely reminders about your interactions. Without notifications, you might miss important updates about when to reconnect with your contacts.
          </div>
        </>
      )
    },
    {
      id: 'installation',
      title: 'Installing the App',
      icon: DevicePhoneMobileIcon,
      description: 'Get TouchBase on your device',
      content: (
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="font-medium">iOS:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>On Safari, tap the <span className="text-primary-500">Share</span> button</li>
              <li>Select <span className="text-primary-500">Add to Home Screen</span></li>
              <li>Tap <span className="text-primary-500">Add</span> to install</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Android:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Tap the <span className="text-primary-500">Install</span> prompt when it appears, or</li>
              <li>Open menu (3 dots on top right corner)</li>
              <li>Select <span className="text-primary-500">Install app</span> or <span className="text-primary-500">Add to home screen</span></li>
            </ol>
          </div>
          <div className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
            <strong>Pro Tip:</strong> Installing TouchBase as an app provides the best experience with quick access from your home screen.
          </div>
        </div>
      )
    },
    {
      id: 'tips',
      title: 'Tips for Success',
      icon: LightBulbIcon,
      description: 'Make the most of TouchBase',
      content: (
        <>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Set realistic contact frequencies based on your relationship with each person</li>
            <li>Use the notes section to record important details about your contacts</li>
            <li>Log interactions right after they happen for better tracking</li>
            <li>Check your dashboard regularly to see who you need to connect with</li>
            <li>Add personal context in your notes to make future interactions meaningful</li>
          </ul>
          <div className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
            <strong>Remember:</strong> The goal is to maintain connections without feeling overwhelmed. TouchBase helps you stay organised and mindful of your relationships.
          </div>
        </>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center py-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -m-2 text-gray-400 hover:text-gray-500 absolute left-6 top-6"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent py-3">
          How to Use TouchBase
        </h1>
        <p className="text-gray-600 mt-4">
          Learn how to manage your relationships effectively with our comprehensive guide
        </p>
      </div>

      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.id} className="bg-white rounded-xl shadow-soft overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full text-left p-6 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <section.icon className="h-6 w-6 text-primary-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{section.description}</p>
                </div>
              </div>
              <ChevronDownIcon
                className={`h-5 w-5 text-gray-400 transition-transform ${
                  expandedSection === section.id ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedSection === section.id && (
              <div className="px-6 pb-6 pt-2 text-gray-600">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-600 space-y-2 py-4">
        <div>
          View our{' '}
          <a href="/terms" className="text-primary-500 hover:text-primary-600">
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="/privacy" className="text-primary-500 hover:text-primary-600">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
};

export default Help;
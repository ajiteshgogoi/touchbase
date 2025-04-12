import {
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  LightBulbIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  DevicePhoneMobileIcon,
  CalendarIcon,
  ChevronDownIcon,
  QuestionMarkCircleIcon,
  HashtagIcon,
  ArrowUpTrayIcon,
  ChatBubbleOvalLeftEllipsisIcon
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
      description: 'Create and manage your relationships effectively',
      content: (
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Click the 'Add Contact' button on the dashboard</li>
          <li>Fill in their name (required)</li>
          <li>Choose how often you'd like to keep in touch (required)</li>
          <li>Click 'Add detailed information' to access additional fields:</li>
          <ul className="list-disc list-inside ml-8 mt-2 space-y-1 text-gray-600 dark:text-gray-400">
            <li>Contact methods (phone, social media)</li>
            <li>Yearly recurring important events (birthdays, anniversaries, etc.)</li>
            <li>Personal notes and preferences</li>
          </ul>
          <div className="mt-4">
            <div className="text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
              <strong className="text-primary-700 dark:text-primary-400">Pro Tip:</strong> Start with essential details and add more information if you desire. You can add up to 5 yearly recurring important events per contact, including one birthday and one anniversary.
            </div>
          </div>
        </ol>
      )
    },
    {
      id: 'bulk-import',
      title: 'Importing Contacts',
      icon: ArrowUpTrayIcon,
      description: 'Import multiple contacts from your devices',
      content: (
        <>
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 mb-2">VCF Import</h4>
              <ol className="list-decimal list-inside space-y-2 ml-4 text-gray-600 dark:text-gray-400">
                <li>Export selected contacts from your device's contacts app:
                  <ul className="list-disc list-inside ml-8 mt-1 space-y-1">
                    <li>iPhone: Open Contacts → Tap Select → Choose specific contacts you want to export → Share → Share Contact → Save to Files as VCF</li>
                    <li>Android: Open Contacts → Press and hold to start selection → Tap additional contacts to select multiple → Tap Share/Export icon → Save as VCF file</li>
                    <li>Google Contacts: Visit contacts.google.com → Click the checkbox next to specific contacts you want to export → Click More (⋮) → Export → Choose vCard → Export</li>
                  </ul>
                </li>
                <li>Click 'Bulk Import' on the Contacts page</li>
                <li>Select 'Upload VCF file' and choose your file</li>
              </ol>
              <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-2">Note: Imported contacts will have a monthly contact frequency by default, which you can adjust individually later.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 mb-2">CSV Import</h4>
              <ol className="list-decimal list-inside space-y-2 ml-4 text-gray-600 dark:text-gray-400">
                <li>Download the template using 'Download CSV template' option in Bulk Import</li>
                <li>Fill in the required fields:
                  <ul className="list-disc list-inside ml-8 mt-1">
                    <li>name: Contact's full name</li>
                    <li>contact_frequency: How often to connect (every_three_days, weekly, fortnightly, monthly, quarterly)</li>
                  </ul>
                </li>
                <li>Optional fields:
                  <ul className="list-disc list-inside ml-8 mt-1">
                    <li>email: Valid email address (e.g., example@domain.com)</li>
                    <li>phone: International format, 7-15 digits (e.g., +11234567890)</li>
                    <li>social_media_platform: linkedin, instagram, twitter</li>
                    <li>social_media_handle: Username without @ symbol</li>
                    <li>preferred_contact_method: call, message, social, email</li>
                    <li>birthday: YYYY-MM-DD format (e.g., 1990-05-15)</li>
                    <li>anniversary: YYYY-MM-DD format</li>
                    <li>custom_event_1_name, custom_event_2_name, custom_event_3_name</li>
                    <li>custom_event_1_date, custom_event_2_date, custom_event_3_date: All in YYYY-MM-DD format</li>
                  </ul>
                </li>
                <li>Save your CSV file</li>
                <li>Click 'Bulk Import' and select 'Upload CSV file'</li>
              </ol>
              <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-2">Start with a few close contacts. The template includes examples to help you get started.</p>
            </div>

            <div className="mt-4 text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
              <strong className="text-primary-700 dark:text-primary-400">Important:</strong> TouchBase is about nurturing meaningful relationships. Consider importing only the contacts you actively want to stay connected with, rather than your entire address book.
            </div>
          </div>
        </>
      )
    },
    {
      id: 'categorisation',
      title: 'Contact Categories',
      icon: HashtagIcon,
      description: 'Organise contacts using hashtags',
      content: (
        <>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>In any contact's notes, use hashtags to categorise them (e.g., #family, #friend, #colleague)</li>
            <li>Type '#' to see suggestions from existing categories</li>
            <li>On the contacts page, use category filters to find contacts</li>
            <li>Multiple categories can be assigned to a single contact</li>
          </ol>
          <div className="mt-4 space-y-4">
            <div className="text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
              <strong className="text-primary-700 dark:text-primary-400">Pro Tip:</strong> Create consistent categories across contacts to make filtering more effective. Common categories include #family, #friend, #colleague, #client, etc.
            </div>
            <div className="text-[15px] leading-relaxed bg-gray-50/90 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-gray-100/50 dark:border-gray-700/50 shadow-sm text-gray-600 dark:text-gray-300">
              <strong className="text-gray-700 dark:text-gray-300">Hashtag Rules:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Must start with # followed by a letter</li>
                <li>Maximum length of 15 characters</li>
                <li>Can contain letters, numbers and underscores</li>
                <li>Cannot contain spaces or special characters</li>
                <li>Maximum 5 hashtags per contact</li>
              </ul>
            </div>
          </div>
        </>
      )
    },
    {
      id: 'interactions',
      title: 'Logging Interactions',
      icon: ChatBubbleLeftRightIcon,
      description: 'Keep track of your conversations',
      content: (
        <>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Click 'Log Interaction' on any contact's card</li>
            <li>Select the type of interaction (call, message, social or meeting)</li>
            <li>Choose when it happened (just now, today, yesterday, etc.)</li>
            <li>Add optional notes about the interaction</li>
            <li>Rate how the interaction went</li>
          </ol>
          <div className="mt-4 text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
            <strong className="text-primary-700 dark:text-primary-400">Pro Tip:</strong> Regular logging helps TouchBase provide better reminders and insights about your relationships.
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
            <li>Optionally mark it as important to show in the 'Important Events' timeline</li>
          </ol>
          <div className="mt-4 text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
            <strong className="text-primary-700 dark:text-primary-400">Pro Tip:</strong> Quick reminders are perfect for one-time events. Mark them as important to highlight key events in your timeline without affecting regular contact schedules.
          </div>
        </>
      )
    },
    {
      id: 'ai-assistant',
      title: 'AI Chat Assistant',
      icon: ChatBubbleOvalLeftEllipsisIcon,
      description: 'Use Base to manage your contacts with natural language',
      content: (
        <>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Click the chat bubble icon in the bottom right corner (Premium users only)</li>
            <li>Type your request in plain English, such as:
              <ul className="list-disc list-inside ml-8 mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                <li>"I just had coffee with Alex. Log it."</li>
                <li>"Add Sarah as a new contact. She's a friend from college."</li>
                <li>"Do I have any reminders due this week?"</li>
                <li>"When did I last talk to Tom?"</li>
              </ul>
            </li>
            <li>Base will understand your request and help you:
              <ul className="list-disc list-inside ml-8 mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                <li>Create and update contacts</li>
                <li>Log interactions with context</li>
                <li>Set up reminders and check events</li>
                <li>Check your interaction history</li>
              </ul>
            </li>
            <li>Confirm any actions when prompted</li>
          </ol>
          <div className="mt-4 text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
            <strong className="text-primary-700 dark:text-primary-400">Pro Tip:</strong> Base remembers your conversation context, so you can have natural back-and-forth interactions. Feel free to ask follow-up questions or provide additional details when needed.
          </div>
        </>
      )
    },
    {
      id: 'analytics',
      title: 'Relationship Insights',
      icon: ChartBarIcon,
      description: 'Gain deeper understanding about your connections',
      content: (
        <>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Click 'Detailed Insights' from the Profile Menu</li>
            <li>View your interaction patterns through the heatmap visualisation</li>
            <li>See your top engaged contacts and their interaction frequencies</li>
            <li>Identify relationships that need attention</li>
            <li>Get personalised insights about your interactions and suggestions for improvement</li>
          </ol>
          <div className="mt-4 text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
            <strong className="text-primary-700 dark:text-primary-400">Pro Tip:</strong> Insights are generated on demand and saved for you to revisit anytime. They help you understand your relationship patterns and make meaningful improvements.
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
          <div className="mt-4 space-y-4">
            <div className="text-[15px] leading-relaxed bg-yellow-50/90 dark:bg-yellow-900/30 backdrop-blur-sm p-4 rounded-xl border border-yellow-100/50 dark:border-yellow-900/50 shadow-sm text-gray-600 dark:text-gray-300">
              <strong className="text-amber-600 dark:text-amber-400">Important:</strong> Enabling notifications is crucial for receiving timely reminders about your interactions. Without notifications, you might miss important updates about when to reconnect with your contacts.
            </div>
            <div className="text-[15px] leading-relaxed bg-gray-50/90 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-gray-100/50 dark:border-gray-700/50 shadow-sm text-gray-600 dark:text-gray-300">
              <strong className="text-gray-700 dark:text-gray-300">Troubleshooting:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Android users experiencing push service errors should disable battery optimisation for TouchBase and Chrome in system settings.</li>
                <li>iOS users may need to manually enable notifications for web apps in device settings.</li>
              </ul>
            </div>
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
            <p className="font-medium">Android:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Get TouchBase from the <a href="https://play.google.com/store/apps/details?id=app.touchbase.site.twa" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-600">Google Play Store</a></li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium">iOS:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>On Safari, tap the <span className="text-primary-500 dark:text-primary-400">Share</span> button</li>
              <li>Select <span className="text-primary-500 dark:text-primary-400">Add to Home Screen</span></li>
              <li>Tap <span className="text-primary-500 dark:text-primary-400">Add</span> to install</li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Web App:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Visit <a href="https://touchbase.site" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300">https://touchbase.site</a> on desktop Chrome</li>
              <li>Click the install icon (computer monitor with down arrow) in the address bar</li>
              <li>Click <span className="text-primary-500 dark:text-primary-400">Install</span> to add to your device</li>
            </ol>
          </div>
          <div className="mt-4 text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
            <strong className="text-primary-700 dark:text-primary-400">Pro Tip:</strong> Installing TouchBase as an app provides the best experience with quick access from your home screen and push-notifications.
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
            <li>Avoid overwhelm by only adding contacts you want to stay connected with</li>
            <li>Set realistic contact frequencies based on your relationship with each person</li>
            <li>Use the notes section to record important details about your relationships</li>
            <li>Log interactions right after they happen for better tracking</li>
            <li>Check your dashboard regularly to see who you need to connect with</li>
            <li>Add personal context in your notes to make future interactions meaningful</li>
            <li>To select multiple contacts for deletion, long-press a contact on mobile, or right-click a contact on desktop to enter selection mode.</li>
          </ul>
          <div className="mt-4 space-y-4">
            <div className="text-[15px] leading-relaxed bg-gray-50/90 dark:bg-gray-800/60 backdrop-blur-sm p-4 rounded-xl border border-gray-100/50 dark:border-gray-700/50 shadow-sm text-gray-600 dark:text-gray-300">
              <strong className="text-gray-700 dark:text-gray-300">Contact Health:</strong> Each contact card shows a coloured indicator representing the relationship health:
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center"><div className="h-2 w-2 aspect-square rounded-full bg-green-400/90 mr-2"></div>Healthy (No missed interactions)</div>
                                <div className="flex items-center"><div className="h-2 w-2 rounded-full bg-lime-400/90 mr-2"></div>Good (1 missed interaction)</div>
                                <div className="flex items-center"><div className="h-2 w-2 rounded-full bg-yellow-400/90 mr-2"></div>Fair (2 missed interactions)</div>
                                <div className="flex items-center"><div className="h-2 w-2 rounded-full bg-orange-400/90 mr-2"></div>Poor (3 missed interactions)</div>
                                <div className="flex items-center"><div className="h-2 w-2 aspect-square rounded-full bg-red-400/90 mr-2"></div>Critical (4+ missed interactions)</div>
              </div>
            </div>
            <div className="text-[15px] leading-relaxed bg-primary-50/90 dark:bg-primary-900/30 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 dark:border-primary-900/50 shadow-sm text-gray-600 dark:text-gray-300">
              <strong className="text-primary-700 dark:text-primary-400">Remember:</strong> The goal is to maintain connections without feeling overwhelmed. TouchBase helps you stay organised and mindful of your most important relationships.
            </div>
          </div>
        </>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center justify-center w-full mb-8 relative">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 -m-2.5 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-50/10 dark:hover:bg-gray-900/10 rounded-xl transition-all duration-200 absolute left-0"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 dark:from-primary-500 dark:to-primary-300 bg-clip-text text-transparent py-3 leading-tight flex flex-col sm:flex-row items-center">
              <QuestionMarkCircleIcon className="h-11 w-11 mb-3 sm:mb-0 sm:mr-2 text-primary-500 dark:text-primary-400" style={{ marginTop: '0.1em' }} />
              How to Use TouchBase
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-600/90 dark:text-gray-400">
              A detailed guide on staying connected and nurturing your relationships
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.id} className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl shadow-lg dark:shadow-soft-dark border border-gray-100/50 dark:border-gray-800/50 overflow-hidden transition-all duration-300">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full text-left p-6 flex items-start justify-between gap-4 hover:bg-white/70 dark:hover:bg-gray-900/70 transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-primary-50/80 dark:bg-primary-900/30 rounded-xl">
                  <section.icon className="h-6 w-6 text-primary-500 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="text-lg font-[600] text-gray-900/90 dark:text-white">{section.title}</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-gray-600/90 dark:text-gray-400">{section.description}</p>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center">
                <ChevronDownIcon
                  className={`h-5 w-5 text-gray-400/80 transition-transform duration-300 group-hover:text-gray-500/80 ${
                    expandedSection === section.id ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>
            {expandedSection === section.id && (
              <div className="px-6 pb-6 pt-2 text-gray-600/90 dark:text-gray-400 animate-fadeIn">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-600 dark:text-gray-400 space-y-2 py-4">
        <div>
          View our{' '}
          <a href="/terms" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300">
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="/privacy" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
};

export default Help;
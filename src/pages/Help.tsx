import {
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  LightBulbIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

export const Help = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How to Use TouchBase</h1>
        <p className="mt-2 text-gray-600">
          Learn how to manage your relationships effectively
        </p>
      </div>

      <div className="space-y-6">
        {/* Adding Contacts */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <UserPlusIcon className="h-6 w-6 text-primary-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Adding Contacts</h2>
            </div>
            <div className="w-full">
              <div className="mt-2 text-gray-600 space-y-2">
                <p>To add a new contact:</p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Click the 'Add Contact' button on the dashboard</li>
                  <li>Fill in their name (required)</li>
                  <li>Add their phone number and/or social media handle (optional)</li>
                  <li>Set your preferred contact method and frequency</li>
                  <li>Use the relationship closeness slider to indicate how close you are</li>
                  <li>Add personal notes to help maintain the relationship</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Logging Interactions */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Logging Interactions</h2>
            </div>
            <div className="w-full">
              <div className="mt-2 text-gray-600 space-y-2">
                <p>Easily log your interactions in one tap:</p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Click 'Log Interaction' on any contact's card</li>
                  <li>Select the type of interaction (call, message, social or meeting)</li>
                  <li>Choose when it happened (just now, today, yesterday, etc.)</li>
                  <li>Add optional notes about the interaction</li>
                  <li>Rate how the interaction went</li>
                </ol>
                <p className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
                  <strong>Pro Tip:</strong> Regular logging helps TouchBase provide better reminders and insights about your relationships.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-primary-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Detailed Analytics</h2>
            </div>
            <div className="w-full">
              <div className="mt-2 text-gray-600 space-y-2">
                <p>Get deep insights into your relationships (Premium feature):</p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Click 'Get Detailed Analytics' on the dashboard</li>
                  <li>View your interaction patterns through the heatmap visualization</li>
                  <li>See your top engaged contacts and their interaction frequencies</li>
                  <li>Identify relationships that need attention</li>
                  <li>Get AI-powered insights about your interactions with each contact</li>
                </ol>
                <p className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
                  <strong>Pro Tip:</strong> Analytics are generated weekly and saved for you to revisit anytime. The insights help you understand your relationship patterns and make meaningful improvements.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <BellIcon className="h-6 w-6 text-primary-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Enabling Notifications</h2>
            </div>
            <div className="w-full">
              <div className="mt-2 text-gray-600 space-y-2">
                <p>Stay on top of your relationships with notifications:</p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Go to Settings in the profile menu</li>
                  <li>Find the 'Notification Preferences' section</li>
                  <li>Toggle on notifications</li>
                  <li>Allow notification permissions when prompted</li>
                  <li>Set your timezone for accurate reminder timing</li>
                </ol>
                <p className="mt-4 text-sm bg-yellow-50 p-3 rounded-lg">
                  <strong>Important:</strong> Enabling notifications is crucial for receiving timely reminders about your interactions. Without notifications, you might miss important updates about when to reconnect with your contacts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* General Tips */}
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <LightBulbIcon className="h-6 w-6 text-primary-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Tips for Success</h2>
            </div>
            <div className="w-full">
              <div className="mt-2 text-gray-600 space-y-2">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Set realistic contact frequencies based on your relationship with each person</li>
                  <li>Use the notes section to record important details about your contacts (interests, important dates, recent events)</li>
                  <li>Log interactions right after they happen for better tracking</li>
                  <li>Check your dashboard regularly to see who you need to connect with</li>
                  <li>Add personal context in your notes to make future conversations more meaningful</li>
                </ul>
                <p className="mt-4 text-sm bg-primary-50 p-3 rounded-lg">
                  <strong>Remember:</strong> The goal is to maintain meaningful connections without feeling overwhelmed. TouchBase helps you stay organised and mindful of your relationships.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 pt-4">
          For bugs or feedback, please contact <a href="mailto:ajiteshgogoi@gmail.com" className="text-primary-500 hover:text-primary-600">ajiteshgogoi@gmail.com</a>
        </div>
      </div>
    </div>
  );
};

export default Help;
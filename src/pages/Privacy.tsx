import { useEffect } from 'react';

export const Privacy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Our Commitment</h2>
          <p className="text-gray-700">
            TouchBase is built on trust. We understand the sensitive nature of relationship data and implement robust security measures to protect your information. This privacy policy explains our practices and your rights regarding your data.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
          <p className="text-gray-700 mb-2">
            We collect only the information necessary to provide our relationship management service:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Account information (name, email address)</li>
            <li>Contact details you add to manage your relationships</li>
            <li>Interaction history and notes you create</li>
            <li>Contact frequency preferences and relationship levels</li>
            <li>Usage analytics for service improvement</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Technical Security Measures</h2>
          <p className="text-gray-700 mb-2">
            We implement multiple layers of security:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Row-level security ensuring strict data isolation between users</li>
            <li>JWT token verification for all authenticated requests</li>
            <li>End-to-end encryption for all data transmissions (TLS 1.3)</li>
            <li>Rate limiting to prevent abuse</li>
            <li>Regular security audits and monitoring</li>
            <li>Robust webhook signature verification for payment processing</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. AI Features</h2>
          <p className="text-gray-700 mb-2">
            Our AI-powered features are designed with privacy in mind:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>AI suggestions are generated based on your interaction notes</li>
            <li>Your data is processed securely when generating suggestions</li>
            <li>We do not use your data to train AI models</li>
            <li>You can report any inappropriate suggestions through our built-in reporting system</li>
            <li>You can disable AI features in Settings</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Data Storage</h2>
          <p className="text-gray-700">
            Your data is stored securely in the EU region using Supabase's infrastructure, which provides:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Encrypted database backups</li>
            <li>UUID-based data tracking for enhanced privacy</li>
            <li>Strict access controls and authentication</li>
            <li>Automated backup systems</li>
            <li>Detailed error logging and monitoring</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. User Controls</h2>
          <p className="text-gray-700">
            You have complete control over your data:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Access and modify your personal information</li>
            <li>Report inappropriate AI suggestions</li>
            <li>Manage notification preferences</li>
            <li>Delete your account and data instantly</li>
            <li>Control contact frequency settings</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Data Usage</h2>
          <p className="text-gray-700">
            We use your information solely to:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Provide our relationship management services</li>
            <li>Send relevant reminders based on your preferences</li>
            <li>Generate personalised interaction suggestions</li>
            <li>Improve service performance and reliability</li>
            <li>Protect against misuse and abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Data Deletion</h2>
          <p className="text-gray-700">
            When you delete your account:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>All your data is immediately and permanently deleted</li>
            <li>Authentication tokens are revoked</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
          <p className="text-gray-700">
            Our service is not directed to children under 13. We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Changes to Privacy Policy</h2>
          <p className="text-gray-700">
            We may update this privacy policy to reflect changes in our practices or for legal reasons. We will notify you of any material changes via email and/or a prominent notice in our application before the changes become effective.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
          <p className="text-gray-700">
            If you have questions about this Privacy Policy or your data, please contact us through our help section. We aim to respond to all enquiries within 48 hours.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
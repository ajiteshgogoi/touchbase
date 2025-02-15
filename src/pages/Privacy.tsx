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
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p className="text-gray-700">
            TouchBase is built on trust. We understand that you're entrusting us with your personal connections and relationship data. This privacy policy explains how we protect that trust through clear data practices and robust security measures.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
          <p className="text-gray-700">
            We collect information that you provide directly to us:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Account information (name, email address)</li>
            <li>Contact information you add to manage your relationships</li>
            <li>Interaction history and notes you create</li>
            <li>Contact frequency preferences and relationship levels</li>
            <li>Usage data and analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Data Storage and Processing</h2>
          <p className="text-gray-700">
            Your data is stored securely on our infrastructure:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>All data is hosted on Supabase's secure infrastructure in the EU region</li>
            <li>Database backups are encrypted and performed daily</li>
            <li>We use PostgreSQL with row-level security for data isolation</li>
            <li>All data transmissions are encrypted using TLS 1.3</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. AI Features and Data Processing</h2>
          <p className="text-gray-700">
            TouchBase uses AI to provide personalised interaction suggestions:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>AI suggestions are generated based on your interaction notes and patterns</li>
            <li>Your data is processed securely when generating suggestions</li>
            <li>We do not use your data to train AI models</li>
            <li>You can report any inappropriate AI suggestions through our reporting feature</li>
            <li>Reported suggestions are reviewed to improve the system</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. How We Use Your Information</h2>
          <p className="text-gray-700">
            We use your information solely to:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Provide and improve our relationship management services</li>
            <li>Send relevant notifications and reminders</li>
            <li>Generate personalised interaction suggestions</li>
            <li>Analyse app performance and user experience</li>
            <li>Protect against fraud and abuse</li>
          </ul>
          <p className="mt-4 text-gray-700">
            <strong>We do not:</strong>
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Sell your data to third parties</li>
            <li>Use your data for advertising</li>
            <li>Share your contacts' information with other users</li>
            <li>Mine your data for insights beyond improving our service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Security Measures</h2>
          <p className="text-gray-700">
            We implement industry-standard security measures:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>End-to-end encryption for all data transmissions</li>
            <li>Regular security audits and penetration testing</li>
            <li>Multi-region data backups with encryption at rest</li>
            <li>Strict access controls and authentication requirements</li>
            <li>Regular security updates and vulnerability patching</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Your Privacy Controls</h2>
          <p className="text-gray-700">
            You have full control over your data:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Access and export your personal information</li>
            <li>Correct or update inaccurate data</li>
            <li>Delete your account and all associated data</li>
            <li>Control notification preferences</li>
            <li>Report inappropriate AI suggestions</li>
            <li>Manage analytics data collection</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
          <p className="text-gray-700">
            We retain your information only as long as necessary:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Active accounts: Data retained while account is active</li>
            <li>Account deletion: All data permanently deleted immediately upon request</li>
            <li>Analytics: Anonymised after 12 months</li>
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
import { useEffect } from 'react';

export const Terms = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p className="text-gray-700">
            TouchBase is a relationship management tool designed to help you maintain meaningful connections. By accessing and using TouchBase, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree with any of these terms, please do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Use Licence</h2>
          <p className="text-gray-700">
            Subject to your compliance with these Terms, TouchBase grants you a personal, non-exclusive, non-transferable licence to use our service for managing your personal relationships. This licence is for personal, non-commercial use only.
          </p>
          <p className="mt-4 text-gray-700">
            You agree not to:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Use the service for commercial purposes</li>
            <li>Attempt to access other users' data</li>
            <li>Reverse engineer or modify the application</li>
            <li>Use the service for automated data collection</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. User Responsibilities</h2>
          <p className="text-gray-700">
            As a TouchBase user, you are responsible for:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>Ensuring you have the right to store contact information</li>
            <li>Using the service in compliance with applicable laws</li>
            <li>Respecting others' privacy and data protection rights</li>
            <li>Keeping your contact information accurate and up-to-date</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Contact Information</h2>
          <p className="text-gray-700">
            When adding contacts to TouchBase:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>You confirm you have the right to store and use their information</li>
            <li>You agree to keep their information confidential</li>
            <li>You will promptly remove information when no longer needed</li>
            <li>You will not use contact information for marketing or spam</li>
            <li>You accept responsibility for any misuse of contact information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. AI Features</h2>
          <p className="text-gray-700">
            Regarding our AI-powered features:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>AI suggestions are for assistance only, not professional advice</li>
            <li>Suggestions are generated based on your interaction notes</li>
            <li>You can report inappropriate suggestions for review</li>
            <li>AI processing follows our Privacy Policy guidelines</li>
            <li>TouchBase is not liable for AI suggestion outcomes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Data Usage</h2>
          <p className="text-gray-700">
            Your data usage rights and restrictions:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>You retain ownership of your personal data</li>
            <li>We process data as described in our Privacy Policy</li>
            <li>You grant us limited rights to provide our services</li>
            <li>You can export or delete your data at any time</li>
            <li>We maintain strict data security measures</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Service Modifications</h2>
          <p className="text-gray-700">
            TouchBase reserves the right to:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Modify or discontinue features with notice</li>
            <li>Update the service to improve security or functionality</li>
            <li>Change pricing with 30 days notice</li>
            <li>Limit service access for policy violations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Privacy and Security</h2>
          <p className="text-gray-700">
            Your use of TouchBase is governed by our Privacy Policy. We implement industry-standard security measures, but you acknowledge that:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>No internet transmission is 100% secure</li>
            <li>You are responsible for your account security</li>
            <li>You must report security concerns promptly</li>
            <li>Two-factor authentication is recommended</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
          <p className="text-gray-700">
            TouchBase shall not be liable for:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Loss of data due to user error or internet issues</li>
            <li>Misuse of contact information by users</li>
            <li>Outcomes of AI-generated suggestions</li>
            <li>Service interruptions or modifications</li>
            <li>Third-party actions or content</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Account Termination</h2>
          <p className="text-gray-700">
            TouchBase may terminate accounts that:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Violate these Terms of Service</li>
            <li>Misuse contact information</li>
            <li>Engage in prohibited activities</li>
            <li>Create security risks</li>
          </ul>
          <p className="mt-4 text-gray-700">
            Upon termination, your data will be immediately and permanently deleted.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
          <p className="text-gray-700">
            We may update these Terms of Service to reflect product improvements or legal requirements. We will notify you of material changes via email or in-app notification. Continued use after changes constitutes acceptance of new terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
          <p className="text-gray-700">
            For questions about these Terms of Service or to report violations, please contact us through our help section. We aim to respond to all enquiries within 48 hours.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
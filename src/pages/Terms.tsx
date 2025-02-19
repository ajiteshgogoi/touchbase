import { useEffect } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

export const Terms = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -m-2 text-gray-400 hover:text-gray-500"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-3xl font-bold">Terms of Service</h1>
      </div>

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
            <li>Use automated systems to access the service</li>
            <li>Circumvent security measures</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. User Account Security</h2>
          <p className="text-gray-700">
            As a TouchBase user, you are responsible for:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities occurring under your account</li>
            <li>Using strong, unique passwords</li>
            <li>Reporting any unauthorised access immediately</li>
            <li>Ensuring secure access to the service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Contact Information</h2>
          <p className="text-gray-700">
            When managing contacts in TouchBase:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>You confirm you have the right to store their information</li>
            <li>You will maintain data accuracy and update as needed</li>
            <li>You will promptly remove information when no longer needed</li>
            <li>You will not use contact information for marketing or spam</li>
            <li>You accept responsibility for appropriate data handling</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. AI Features</h2>
          <p className="text-gray-700">
            Regarding our AI-powered features:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>AI suggestions are for assistance only, not professional advice</li>
            <li>Suggestions are based on your interaction notes and patterns</li>
            <li>You can report inappropriate suggestions using the built-in reporting system</li>
            <li>You can disable AI features in Settings</li>
            <li>We review all reported suggestions to improve the service</li>
            <li>TouchBase is not liable for AI suggestion outcomes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
          <p className="text-gray-700">
            Your responsibilities regarding data security:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Use the service on secure devices and networks</li>
            <li>Keep your access credentials confidential</li>
            <li>Report security concerns promptly</li>
            <li>Log out from shared devices</li>
            <li>Enable two-factor authentication when available</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Service Reliability</h2>
          <p className="text-gray-700">
            TouchBase implements several measures to ensure service reliability:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Regular system maintenance and updates</li>
            <li>Performance monitoring and optimisation</li>
            <li>Automated backup systems</li>
            <li>Rate limiting to prevent abuse</li>
            <li>Error tracking and resolution</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Service Modifications</h2>
          <p className="text-gray-700">
            TouchBase reserves the right to:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Modify or discontinue features with notice</li>
            <li>Update the service to improve security</li>
            <li>Change pricing with 30 days notice</li>
            <li>Limit service access for policy violations</li>
            <li>Implement new security measures</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Cancellation and Refund Policy</h2>
          <p className="text-gray-700">
            When you cancel your subscription:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>You will continue to have access to all subscription benefits until the end of your current billing period</li>
            <li>Your subscription will not auto-renew for the next billing period</li>
            <li>No partial refunds will be provided for the remaining subscription period</li>
            <li>Refunds are only considered under exceptional circumstances, at TouchBase's sole discretion</li>
            <li>All refund decisions made by TouchBase are final</li>
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
            <li>Attempt to circumvent limitations</li>
          </ul>
          <p className="mt-4 text-gray-700">
            Upon account deletion, all your data is immediately and permanently removed from our systems.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
          <p className="text-gray-700">
            We may update these Terms of Service to reflect service improvements or legal requirements. We will notify you of material changes via email or in-app notification. Continued use after changes constitutes acceptance of new terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
          <p className="text-gray-700">
            For questions about these Terms of Service or to report violations, please visit our <a href="/support" className="text-primary-500 hover:text-primary-600 font-medium">Support page</a>. We aim to respond to all enquiries within 48 hours.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
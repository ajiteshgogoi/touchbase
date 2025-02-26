import { useEffect } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

export const Terms = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center justify-center w-full mb-8 relative">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200 absolute left-0"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent py-3 leading-tight flex flex-col sm:flex-row items-center">
              <span>Terms of</span>
              <span className="sm:ml-2">Service</span>
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-600/90">
              Please read these terms carefully before using TouchBase
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft divide-y divide-gray-100/50">
        {/* Rest of the content remains the same */}
        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">1. Introduction</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            TouchBase is a relationship management tool designed to help you maintain meaningful connections. By accessing and using TouchBase, you agree to be bound by these Terms of Service and our <a href="/privacy" className="text-primary-500 hover:text-primary-600">Privacy Policy</a>. If you do not agree with any of these terms, please do not use the service.
          </p>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">2. Use Licence</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-4">
            Subject to your compliance with these Terms, TouchBase grants you a personal, non-exclusive, non-transferable licence to use our service for managing your personal relationships. This licence is for personal, non-commercial use only.
          </p>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">You agree not to:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Use the service for commercial purposes</li>
            <li>Attempt to access other users' data</li>
            <li>Reverse engineer or modify the application</li>
            <li>Use automated systems to access the service</li>
            <li>Circumvent security measures</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">3. User Account Security</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">As a TouchBase user, you are responsible for:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities occurring under your account</li>
            <li>Using strong, unique passwords</li>
            <li>Reporting any unauthorised access immediately</li>
            <li>Ensuring secure access to the service</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">4. Contact Information</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">When managing contacts in TouchBase:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>You confirm you have the right to store their information</li>
            <li>You will maintain data accuracy and update as needed</li>
            <li>You will promptly remove information when no longer needed</li>
            <li>You will not use contact information for marketing or spam</li>
            <li>You accept responsibility for appropriate data handling</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">5. AI Features</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">Regarding our AI-powered features:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>AI suggestions are for assistance only, not professional advice</li>
            <li>Suggestions are based on your interaction notes and patterns</li>
            <li>You can report inappropriate suggestions using the built-in reporting system</li>
            <li>You can disable AI features in Settings</li>
            <li>We review all reported suggestions to improve the service</li>
            <li>TouchBase is not liable for AI suggestion outcomes</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">6. Data Security</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">Your responsibilities regarding data security:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Use the service on secure devices and networks</li>
            <li>Keep your access credentials confidential</li>
            <li>Report security concerns promptly</li>
            <li>Log out from shared devices</li>
            <li>Enable two-factor authentication when available</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">7. Service Reliability</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">TouchBase implements several measures to ensure service reliability:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Regular system maintenance and updates</li>
            <li>Performance monitoring and optimisation</li>
            <li>Automated backup systems</li>
            <li>Rate limiting to prevent abuse</li>
            <li>Error tracking and resolution</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">8. Service Modifications</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">TouchBase reserves the right to:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Modify or discontinue features with notice</li>
            <li>Update the service to improve security</li>
            <li>Change pricing with 30 days notice</li>
            <li>Limit service access for policy violations</li>
            <li>Implement new security measures</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">9. Cancellation and Refund Policy</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">When you cancel your subscription:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>You will continue to have access to all subscription benefits until the end of your current billing period</li>
            <li>Your subscription will not auto-renew for the next billing period</li>
            <li>No partial refunds will be provided for the remaining subscription period</li>
            <li>Refunds are only considered under exceptional circumstances, at TouchBase's sole discretion</li>
            <li>All refund decisions made by TouchBase are final</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">10. Account Termination</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">TouchBase may terminate accounts that:</p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Violate these Terms of Service</li>
            <li>Misuse contact information</li>
            <li>Engage in prohibited activities</li>
            <li>Create security risks</li>
            <li>Attempt to circumvent limitations</li>
          </ul>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-600/90">
            Upon account deletion, all your data is immediately and permanently removed from our systems.
          </p>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">11. Changes to Terms</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            We may update these Terms of Service to reflect changes in our practices or for legal reasons. We will notify you of any material changes via email and/or a prominent notice in our application before the changes become effective.
          </p>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">12. Contact Information</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            For questions about these Terms of Service or to report violations, please visit our <a href="/support" className="text-primary-500 hover:text-primary-600">Support page</a>. We aim to respond to all enquiries within 48 hours.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
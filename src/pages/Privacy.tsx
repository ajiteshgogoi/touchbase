import { useEffect } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

export const Privacy = () => {
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
              <span>Privacy</span>
              <span className="sm:ml-2">Policy</span>
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-600/90">
              How we protect and handle your data
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft divide-y divide-gray-100/50">
        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">1. Our Commitment</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            TouchBase is built on trust. We understand the sensitive nature of relationship data and implement robust security measures to protect your information. This privacy policy explains our practices and your rights regarding your data. For more information about using our service, please see our <a href="/terms" className="text-primary-500 hover:text-primary-600">Terms of Service</a>.
          </p>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">2. Information We Collect</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">
            We collect only the information necessary to provide our relationship management service:
          </p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Account information (name, email address, google profile picture)</li>
            <li>Contact details you add to manage your relationships</li>
            <li>Interaction history and notes you create</li>
            <li>Contact frequency preferences and relationship levels</li>
            <li>Usage analytics for service improvement</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">3. Technical Security Measures</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">
            We implement multiple layers of security:
          </p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Row-level security ensuring strict data isolation between users</li>
            <li>JWT token verification for all authenticated requests</li>
            <li>End-to-end encryption for all data transmissions (TLS 1.3)</li>
            <li>Rate limiting to prevent abuse</li>
            <li>Regular security audits and monitoring</li>
            <li>Robust webhook signature verification for payment processing</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">4. AI Features</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 mb-2">
            Our AI-powered features are designed with privacy in mind:
          </p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>AI suggestions are generated based on your interaction notes</li>
            <li>Your data is processed securely when generating suggestions</li>
            <li>We do not use your data to train AI models</li>
            <li>You can report any inappropriate suggestions through our built-in reporting system</li>
            <li>You can disable AI features in Settings</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">5. Data Storage</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            Your data is stored securely in the EU region using Supabase's infrastructure, which provides:
          </p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Encrypted database backups</li>
            <li>UUID-based data tracking for enhanced privacy</li>
            <li>Strict access controls and authentication</li>
            <li>Automated backup systems</li>
            <li>Detailed error logging and monitoring</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">6. User Controls</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            You have complete control over your data:
          </p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Access and modify your personal information</li>
            <li>Report inappropriate AI suggestions</li>
            <li>Manage notification preferences</li>
            <li>Delete your account and data instantly</li>
            <li>Control contact frequency settings</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">7. Data Usage</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            We use your information solely to:
          </p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>Provide our relationship management services</li>
            <li>Send relevant reminders based on your preferences</li>
            <li>Generate personalised interaction suggestions</li>
            <li>Improve service performance and reliability</li>
            <li>Protect against misuse and abuse</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">8. Data Deletion</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            When you delete your account:
          </p>
          <ul className="list-disc ml-6 text-[15px] leading-relaxed text-gray-600/90 space-y-1">
            <li>All your data is immediately and permanently deleted</li>
            <li>Authentication tokens are revoked</li>
          </ul>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">9. Children's Privacy</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            Our service is not directed to children under 13. We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
          </p>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">10. Changes to Privacy Policy</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            We may update this privacy policy to reflect changes in our practices or for legal reasons. We will notify you of any material changes via email and/or a prominent notice in our application before the changes become effective.
          </p>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 mb-4">11. Contact Us</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90">
            If you have questions about this Privacy Policy or your data, please visit our <a href="/support" className="text-primary-500 hover:text-primary-600">Support page</a>. We aim to respond to all enquiries within 48 hours.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
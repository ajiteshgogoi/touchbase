import { useEffect } from 'react';

export const Privacy = () => {
  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
          <p className="text-gray-700">
            We collect information that you provide directly to us, including:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Account information (name, email address)</li>
            <li>Contact information you add to manage your relationships</li>
            <li>Interaction history and notes you create</li>
            <li>Usage data and analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
          <p className="text-gray-700">
            We use the information we collect to:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Provide, maintain and improve our services</li>
            <li>Send you notifications and reminders</li>
            <li>Generate analytics and insights</li>
            <li>Protect against fraud and abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
          <p className="text-gray-700">
            We do not sell or share your personal information with third parties except as described in this policy. We may share your information with:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Service providers who assist in our operations</li>
            <li>When required by law or to protect rights</li>
            <li>With your consent</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
          <p className="text-gray-700">
            We implement appropriate technical and organisational measures to protect your information. However, no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
          <p className="text-gray-700">
            You have the right to:
          </p>
          <ul className="list-disc ml-6 mt-2 text-gray-700">
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
          <p className="text-gray-700">
            We retain your information for as long as your account is active or as needed to provide services. We will delete or anonymize your information upon request or when no longer needed.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Children's Privacy</h2>
          <p className="text-gray-700">
            Our service is not directed to children under 13. We do not knowingly collect information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Changes to Privacy Policy</h2>
          <p className="text-gray-700">
            We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
          <p className="text-gray-700">
            If you have questions about this Privacy Policy, please contact us through our help section.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
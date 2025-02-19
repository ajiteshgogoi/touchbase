import { useEffect } from 'react';

export const Support = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Support</h1>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">Company Address</h3>
              <p className="text-gray-700">
                TouchBase Technologies<br />
                24, Lane 2, Basisthapur<br />
                Guwahati, Assam<br />
                781028<br />
                India
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Phone</h3>
              <p className="text-gray-700">
                <a href="tel:[+91-9395877156]" className="text-primary-500 hover:text-primary-600 font-medium">+91-9395877156</a>
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Email</h3>
              <p className="text-gray-700">
                <a href="mailto:help@touchbase.site" className="text-primary-500 hover:text-primary-600 font-medium">help@touchbase.site</a>
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Support Hours</h2>
          <p className="text-gray-700">
            Our support team is available Monday through Friday, 9:00 AM to 6:00 PM IST (Indian Standard Time).
            We aim to respond to all inquiries within 48 hours.
          </p>
        </section>

      </div>
    </div>
  );
};

export default Support;
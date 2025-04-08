import { useEffect } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export const Support = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Helmet>
        <link rel="canonical" href="https://touchbase.site/support" />
      </Helmet>
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
              <span>Support</span>
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-600/90 dark:text-gray-400">
              We're here to help you with any questions
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark divide-y divide-gray-100/50 dark:divide-gray-800/50">
        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 dark:text-white mb-4">Contact Information</h2>
          <div className="space-y-6">
            <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg border border-gray-100/50 dark:border-gray-800/50 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-[600] text-gray-900/90 dark:text-white mb-2">Company Address</h3>
                <p className="text-[15px] leading-relaxed text-gray-600/90 dark:text-gray-400">
                  TouchBase Technologies<br />
                  24, Lane 2, Basisthapur<br />
                  Guwahati, Assam<br />
                  781028<br />
                  India
                </p>
              </div>

              <div>
                <h3 className="text-lg font-[600] text-gray-900/90 dark:text-white mb-2">Phone</h3>
                <p className="text-[15px] leading-relaxed">
                  <a href="tel:[+91-9395877156]" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-[500]">+91-9395877156</a>
                </p>
              </div>

              <div>
                <h3 className="text-lg font-[600] text-gray-900/90 dark:text-white mb-2">Email</h3>
                <p className="text-[15px] leading-relaxed">
                  <a href="mailto:help@touchbase.site" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-[500]">help@touchbase.site</a>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 dark:text-white mb-4">Support Hours</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 dark:text-gray-400">
            Our support team is available Monday through Friday, 9:00 AM to 6:00 PM IST (Indian Standard Time).
            We aim to respond to all inquiries within 48 hours.
          </p>
        </section>

        <section className="p-6">
          <h2 className="text-xl font-[600] text-gray-900/90 dark:text-white mb-4">Additional Resources</h2>
          <p className="text-[15px] leading-relaxed text-gray-600/90 dark:text-gray-400">
            Check out our <a href="/blog" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-[500]">blog</a> for tips and updates.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Support;
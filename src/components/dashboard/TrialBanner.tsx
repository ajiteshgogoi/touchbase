import { Link } from 'react-router-dom';

export const TrialBanner = ({ daysRemaining }: { daysRemaining: number }) => (
  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-4 rounded-lg shadow-soft mb-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-sm font-medium">
        You have {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining in your free trial period.
      </p>
      <div className="flex-shrink-0">
        <Link
          to="/settings"
          className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-1.5 bg-white text-purple-600 rounded-lg text-sm font-medium shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          Upgrade Now
        </Link>
      </div>
    </div>
  </div>
);

export default TrialBanner;
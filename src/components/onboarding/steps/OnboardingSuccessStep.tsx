import { useState } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

interface OnboardingSuccessStepProps {
  onClose: () => void;
}

export const OnboardingSuccessStep = ({ onClose }: OnboardingSuccessStepProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = async () => {
    setIsSubmitting(true);
    await onClose();
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="rounded-full bg-primary-50 dark:bg-primary-900/30 p-3">
          <CheckCircleIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            Congratulations!
          </h2>
          <p className="text-[15px] text-gray-600/90 dark:text-gray-400 max-w-sm mx-auto">
            You're ready to start building meaningful relationships
          </p>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          className="w-full px-6 py-3 text-white bg-primary-500 dark:bg-primary-600 rounded-xl font-medium
            hover:bg-primary-600 dark:hover:bg-primary-700 transition-all duration-200 shadow-sm dark:shadow-soft-dark hover:shadow-md
            active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
            disabled:hover:bg-primary-500 dark:disabled:hover:bg-primary-600 disabled:hover:shadow-sm disabled:active:scale-100"
        >
          <span className="min-w-[80px] inline-block text-center">
            {isSubmitting ? 'Starting...' : 'Get Started'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default OnboardingSuccessStep;
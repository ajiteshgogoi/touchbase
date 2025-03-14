import { useLayoutEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

interface OnboardingSuccessStepProps {
  onClose: () => void;
}

export const OnboardingSuccessStep = ({ onClose }: OnboardingSuccessStepProps) => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useLayoutEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="space-y-6 py-4">
      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        numberOfPieces={200}
        recycle={false}
        colors={['#4F46E5', '#10B981', '#3B82F6', '#6366F1']}
      />
      
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="rounded-full bg-primary-50 p-3">
          <CheckCircleIcon className="w-8 h-8 text-primary-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-primary-600
            to-primary-400 bg-clip-text text-transparent">
            Congratulations!
          </h2>
          <p className="text-[15px] text-gray-600/90 max-w-sm mx-auto">
            You're ready to start building meaningful relationships.
          </p>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={onClose}
          className="w-full px-6 py-3 text-white bg-primary-500 rounded-xl font-medium 
            hover:bg-primary-600 transition-all duration-200 shadow-sm hover:shadow-md 
            active:scale-[0.98]"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default OnboardingSuccessStep;
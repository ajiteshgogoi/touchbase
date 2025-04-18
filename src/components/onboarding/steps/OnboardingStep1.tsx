import React, { useState, useEffect } from 'react';
import {
  HeartIcon,
  UserGroupIcon,
  BellIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface OnboardingStep1Props {
  onNext: () => void;
  onSkip: () => void;
  userName?: string;
}

interface Feature {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

// Define features as a constant array that will never be empty
const FEATURES: readonly Feature[] = Object.freeze([
  {
    icon: HeartIcon,
    title: 'Meaningful Connections',
    description: 'Build stronger relationships by staying in touch intentionally'
  },
  {
    icon: UserGroupIcon,
    title: 'Contact Management',
    description: 'Manage your important relationships in one place'
  },
  {
    icon: BellIcon,
    title: 'Smart Reminders',
    description: 'Get timely notifications to maintain regular contact'
  },
  {
    icon: ChartBarIcon,
    title: 'Relationship Insights',
    description: 'Understand your interaction patterns and strengthen bonds'
  }
]);

if (FEATURES.length === 0) {
  throw new Error('FEATURES array must not be empty');
}

export const OnboardingStep1 = ({ onNext, onSkip, userName }: OnboardingStep1Props) => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [isSkipping, setIsSkipping] = useState(false);

  const handleSkip = async () => {
    setIsSkipping(true);
    await onSkip();
    setIsSkipping(false);
  };

  // Auto-advance features
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % FEATURES.length);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // Get current feature and ensure it's always valid
  const safeIndex = activeFeature % FEATURES.length;
  // We can safely assert this will never be undefined due to the modulo operation
  // and the non-empty array check above
  const currentFeature = FEATURES[safeIndex]!;

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="space-y-3 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-primary-600
          to-primary-400 bg-clip-text text-transparent leading-relaxed pb-1">
          Welcome{userName ? `, ${userName}` : ''}!
        </h2>
        <p className="text-base text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
          Let's help you build and nurture meaningful relationships
        </p>
      </div>

      {/* Feature Showcase */}
      <div className="relative">
        <div className="h-[200px] flex items-center justify-center">
          <div 
            key={safeIndex}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 pt-2 pb-6 text-center opacity-100"
          >
            <div className="mb-6">
              {React.createElement(currentFeature.icon, {
                className: "w-12 h-12 text-primary-500 dark:text-primary-400 mx-auto"
              })}
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              {currentFeature.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {currentFeature.description}
            </p>
          </div>
        </div>

        {/* Feature Dots */}
        <div className="flex justify-center gap-2 mt-4">
          {FEATURES.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveFeature(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === safeIndex
                  ? 'bg-primary-500 dark:bg-primary-600 w-6'
                  : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
              }`}
              aria-label={`Show feature ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4">
        <button
          onClick={onNext}
          className="w-full px-6 py-3 text-white bg-primary-500 dark:bg-primary-600 rounded-xl font-medium
            hover:bg-primary-600 dark:hover:bg-primary-700 transition-all duration-200 shadow-sm dark:shadow-soft-dark hover:shadow-md
            hover:scale-[1.02] active:scale-[0.98]"
        >
          Get Started
        </button>
        <button
          onClick={handleSkip}
          disabled={isSkipping}
          className="w-full px-6 py-3 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl font-medium
            hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50 dark:disabled:hover:bg-gray-800
            disabled:hover:scale-100 disabled:active:scale-100"
        >
          <span className="min-w-[70px] inline-block text-center">
            {isSkipping ? 'Skipping...' : 'Skip Tour'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default OnboardingStep1;
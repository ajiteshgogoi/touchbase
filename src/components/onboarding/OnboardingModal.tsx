import React, { useState, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useStore } from '../../stores/useStore';
import { useOnboarding } from '../../hooks/useOnboarding';
import { OnboardingStep1 } from './steps/OnboardingStep1';
import { OnboardingStep2 } from './steps/OnboardingStep2';
import { OnboardingStep3 } from './steps/OnboardingStep3';
import { OnboardingSuccessStep } from './steps/OnboardingSuccessStep';
import Confetti from 'react-confetti';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { user } = useStore();
  const { markCompleted } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(1);
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
      
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
    };

    if (isOpen) {
      handleResize();
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    };
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    await markCompleted();
    setCurrentStep(4); // Show success step
  };

  const handleSkip = async () => {
    await markCompleted();
    onClose();
  };

  const renderStep = () => {
    const props = {
      userName: user?.user_metadata?.full_name
    };

    switch (currentStep) {
      case 1:
        return (
          <OnboardingStep1 
            onNext={handleNext} 
            onSkip={handleSkip}
            {...props}
          />
        );
      case 2:
        return (
          <OnboardingStep2 
            onNext={handleNext} 
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <OnboardingStep3 
            onComplete={handleComplete} 
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <OnboardingSuccessStep 
            onClose={onClose}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[100]" onClose={() => {}}>
        <div className="min-h-full">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4 z-10">
            {currentStep === 4 && (
              <Confetti
                width={windowSize.width}
                height={windowSize.height}
                numberOfPieces={200}
                recycle={false}
                colors={['#4F46E5', '#10B981', '#3B82F6', '#6366F1']}
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
            )}
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
                <div className="relative">
                  {/* Progress bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
                    <div 
                      className="h-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${(Math.min(currentStep, 4) / 4) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6">
                  {renderStep()}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default OnboardingModal;
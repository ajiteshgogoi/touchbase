import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal = ({ isOpen, onClose }: InstallModalProps) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-[0.98]"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-[0.98]"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl p-8 text-left align-middle shadow-lg transition-all">
                <Dialog.Title as="h3" className="text-2xl font-[650] text-gray-900 text-center tracking-[-0.02em]">
                  Install TouchBase App
                </Dialog.Title>
                <p className="mt-2 text-base text-gray-600/90 text-center">Get quick access to TouchBase from your home screen</p>
                
                <div className="mt-8 space-y-6 text-[15px] text-gray-600">
                  <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-100/50 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-primary-500" viewBox="0 0 384 512" fill="currentColor">
                        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                      </svg>
                      <p className="font-medium">iPhone & iPad Installation</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">1</div>
                      <p>On Safari, tap the <span className="text-primary-600 font-medium">Share</span> button</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">2</div>
                      <p>Select <span className="text-primary-600 font-medium">Add to Home Screen</span></p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">3</div>
                      <p>Tap <span className="text-primary-600 font-medium">Add</span> to install</p>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-gray-100/50 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M17.6,9.48l1.84-3.18c0.16-0.31,0.04-0.69-0.26-0.85c-0.29-0.15-0.65-0.06-0.83,0.22l-1.88,3.24 c-2.86-1.21-6.08-1.21-8.94,0L5.65,5.67c-0.19-0.29-0.58-0.38-0.87-0.2C4.5,5.65,4.41,6.01,4.56,6.3L6.4,9.48 C3.3,11.25,1.28,14.44,1,18h22C22.72,14.44,20.7,11.25,17.6,9.48z M7,15.25c-0.69,0-1.25-0.56-1.25-1.25 c0-0.69,0.56-1.25,1.25-1.25S8.25,13.31,8.25,14C8.25,14.69,7.69,15.25,7,15.25z M17,15.25c-0.69,0-1.25-0.56-1.25-1.25 c0-0.69,0.56-1.25,1.25-1.25s1.25,0.56,1.25,1.25C18.25,14.69,17.69,15.25,17,15.25z" fill="currentColor"/>
                      </svg>
                      <p className="font-medium">Android Installation Steps</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">1</div>
                      <p>Tap the <span className="text-primary-600 font-medium">Install</span> prompt when it appears</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">2</div>
                      <p>Or open menu (3 dots on top right)</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">3</div>
                      <p>Select <span className="text-primary-600 font-medium">Install app</span></p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <button
                    type="button"
                    className="w-full px-6 py-3 text-sm font-medium text-gray-700 bg-white hover:bg-primary-50 hover:border-primary-100 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
                    onClick={onClose}
                    aria-label="Close dialog"
                  >
                    Got it
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default InstallModal;
import { Fragment, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal = ({ isOpen, onClose }: InstallModalProps) => {
  useLayoutEffect(() => {
    if (isOpen) {
      // Calculate scrollbar width
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
      
      // Add modal-open class to body
      document.body.classList.add('modal-open');
    } else {
      // Remove modal-open class and reset scrollbar width
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    }

    return () => {
      // Cleanup
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    };
  }, [isOpen]);

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[100]" onClose={onClose}>
        <div className="min-h-full">
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4 z-10">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100/75">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-medium text-gray-900">
                      Install TouchBase App
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500/90">
                      Get quick access to TouchBase from your home screen
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 -m-2 text-gray-400 hover:text-gray-500 transition-colors"
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-6">
                    {/* Android Instructions */}
                    <div className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100/50 shadow-soft space-y-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M17.6,9.48l1.84-3.18c0.16-0.31,0.04-0.69-0.26-0.85c-0.29-0.15-0.65-0.06-0.83,0.22l-1.88,3.24 c-2.86-1.21-6.08-1.21-8.94,0L5.65,5.67c-0.19-0.29-0.58-0.38-0.87-0.2C4.5,5.65,4.41,6.01,4.56,6.3L6.4,9.48 C3.3,11.25,1.28,14.44,1,18h22C22.72,14.44,20.7,11.25,17.6,9.48z M7,15.25c-0.69,0-1.25-0.56-1.25-1.25 c0-0.69,0.56-1.25,1.25-1.25S8.25,13.31,8.25,14C8.25,14.69,7.69,15.25,7,15.25z M17,15.25c-0.69,0-1.25-0.56-1.25-1.25 c0-0.69,0.56-1.25,1.25-1.25s1.25,0.56,1.25,1.25C18.25,14.69,17.69,15.25,17,15.25z" fill="currentColor"/>
                        </svg>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">Android Installation</h4>
                        </div>
                      </div>
                      <div className="flex flex-col items-center text-center py-6">
                        <h4 className="text-lg font-medium text-gray-900 mb-2">Download TouchBase</h4>
                        <p className="text-sm text-gray-600 mb-6">Get the official app from Google Play Store for the best experience</p>
                        <a
                          href="https://play.google.com/store/apps/details?id=app.touchbase.site.twa"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                        >
                          <svg className="w-6 h-6 mr-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M17.9,2.6L9.5,10.2L7.9,8.6L16.3,1L17.9,2.6z M22,12c0-0.9-0.3-1.9-0.9-2.7l-2.6,2.6l2.6,2.6C21.7,13.9,22,13,22,12z M12.4,11.5l7.5,7.5l-1.6,1.6l-7.5-7.5L12.4,11.5z M2,12c0,1,0.3,1.9,0.9,2.7l2.6-2.6L2.9,9.4C2.3,10.1,2,11.1,2,12z M12,22 c3.2,0,6-1.7,7.5-4.3l-2.6-2.6C15.8,17,14,18,12,18c-3.3,0-6-2.7-6-6s2.7-6,6-6c2,0,3.8,1,4.9,2.9l2.6-2.6C17.9,3.7,15.2,2,12,2 C6.5,2,2,6.5,2,12S6.5,22,12,22z"/>
                          </svg>
                          Get it on Google Play
                        </a>
                      </div>
                    </div>

                    {/* iOS Instructions */}
                    <div className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100/50 shadow-soft space-y-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" viewBox="0 0 384 512" fill="currentColor">
                          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                        </svg>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">iPhone & iPad Installation</h4>
                        </div>
                      </div>
                      <div className="space-y-3 pl-8">
                        <div className="flex gap-3 items-start">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-50/90 text-primary-600 flex items-center justify-center font-medium text-sm">1</div>
                          <p className="text-sm text-gray-600 mt-1">On Safari, tap the <span className="text-primary-600 font-[500]">Share</span> button</p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-50/90 text-primary-600 flex items-center justify-center font-medium text-sm">2</div>
                          <p className="text-sm text-gray-600 mt-1">Select <span className="text-primary-600 font-[500]">Add to Home Screen</span></p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-50/90 text-primary-600 flex items-center justify-center font-medium text-sm">3</div>
                          <p className="text-sm text-gray-600 mt-1">Tap <span className="text-primary-600 font-[500]">Add</span> to install</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 bg-gray-50/80 rounded-b-2xl border-t border-gray-100/75">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white/80 ring-1 ring-gray-200/75 rounded-xl hover:bg-gray-50/90 transition-all duration-200 shadow-sm"
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
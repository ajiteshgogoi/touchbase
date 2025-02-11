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
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium text-gray-900 text-center">
                  Install TouchBase App
                </Dialog.Title>
                
                <div className="mt-4 space-y-4 text-sm text-gray-600">
                  <div className="space-y-2">
                    <p className="font-medium">iOS:</p>
                    <p>1. On Safari, tap the <span className="text-primary-500">Share</span> button</p>
                    <p>2. Select <span className="text-primary-500">Add to Home Screen</span></p>
                    <p>3. Tap <span className="text-primary-500">Add</span> to install</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">Android:</p>
                    <p>1. Tap the install prompt when it appears, or</p>
                    <p>2. Open menu (3 dots on top right corner)</p>
                    <p>3. Select <span className="text-primary-500">Install app</span> or <span className="text-primary-500">Add to home screen</span></p>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-primary-100 px-4 py-2 text-sm font-medium text-primary-900 hover:bg-primary-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                    onClick={onClose}
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
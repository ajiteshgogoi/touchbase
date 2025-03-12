import { Fragment, useLayoutEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CloudArrowDownIcon, ArrowUpTrayIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface ImportMethod {
  id: 'google' | 'csv_upload' | 'csv_template';
  name: string;
  description: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: ImportMethod['id']) => void;
  isProcessing: boolean;
}

const IMPORT_METHODS: ImportMethod[] = [
  {
    id: 'google',
    name: 'Import from Google Contacts',
    description: 'Import your contacts directly from Google',
    icon: <UserGroupIcon className="h-6 w-6 text-primary-500" />
  },
  {
    id: 'csv_upload',
    name: 'Upload CSV file',
    description: 'Import contacts from a CSV file',
    icon: <ArrowUpTrayIcon className="h-6 w-6 text-primary-500" />
  },
  {
    id: 'csv_template',
    name: 'Download CSV Template',
    description: 'Get a sample CSV file with the correct format',
    icon: <CloudArrowDownIcon className="h-6 w-6 text-primary-500" />
  }
];

export const BulkImportModal = ({ isOpen, onClose, onSelect, isProcessing }: Props) => {
  useLayoutEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
      document.documentElement.style.setProperty('--scrollbar-width', '0px');
    }

    return () => {
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
                  <Dialog.Title as="h3" className="text-lg font-medium text-gray-900">
                    Import Contacts
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 -m-2 text-gray-400 hover:text-gray-500 transition-colors"
                    disabled={isProcessing}
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-40">
                      <LoadingSpinner />
                      <p className="mt-4 text-primary-500">Processing import...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {IMPORT_METHODS.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => !method.disabled && onSelect(method.id)}
                          disabled={method.disabled}
                          className={`w-full p-4 text-left border rounded-xl transition-all duration-200 flex items-start gap-4 ${
                            method.disabled 
                              ? 'border-gray-200/75 bg-gray-50/90 cursor-not-allowed opacity-60'
                              : 'border-gray-200/75 hover:border-primary-400 hover:bg-primary-50/90 hover:shadow-sm'
                          }`}
                        >
                          <span className="flex-shrink-0">{method.icon}</span>
                          <div>
                            <h4 className="font-medium text-gray-900">{method.name}</h4>
                            <p className="text-sm text-gray-600/90 mt-1">
                              {method.disabled ? method.disabledReason : method.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
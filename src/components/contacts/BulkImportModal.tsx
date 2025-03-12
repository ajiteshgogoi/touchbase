import { Fragment, useLayoutEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CloudArrowDownIcon, ArrowUpTrayIcon, UserGroupIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { supabase } from '../../lib/supabase/client';
import { useStore } from '../../stores/useStore';

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
}

interface ImportError {
  row: number;
  errors: string[];
}

interface ImportResult {
  success: boolean;
  message: string;
  successCount: number;
  failureCount: number;
  errors: ImportError[];
}

const IMPORT_METHODS: ImportMethod[] = [
  {
    id: 'google',
    name: 'Import from Google Contacts',
    description: 'Import your contacts directly from Google',
    icon: <UserGroupIcon className="h-6 w-6 text-primary-500" />,
    disabled: true,
    disabledReason: 'Coming soon'
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

// Get the Edge Function URL from environment variables
const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.functions.supabase.co');

export const BulkImportModal = ({ isOpen, onClose, onSelect }: Props) => {
  const { } = useStore(); // Keep useStore for future use
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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

  const handleMethodSelect = async (method: ImportMethod['id']) => {
    if (method === 'csv_template') {
      const response = await fetch('/contacts_template.csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return;
    }

    onSelect(method);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset states
    setUploadError(null);
    setImportResult(null);
    setIsUploading(true);

    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please upload a CSV file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const formData = new FormData();
      formData.append('file', file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }

      if (!EDGE_FUNCTION_URL) {
        throw new Error('Edge function URL not configured');
      }

      const response = await fetch(`${EDGE_FUNCTION_URL}/bulk-import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Get the detailed error message from the response
        if (result.error?.includes('Invalid Record Length')) {
          const match = result.error.match(/columns length is (\d+), got (\d+) on line (\d+)/);
          if (match) {
            const [_, expected, got, line] = match;
            throw new Error(`CSV format error on line ${line}: Expected ${expected} columns but got ${got} columns. Please ensure each row has exactly ${expected} columns, even if some values are empty.`);
          }
        }
        throw new Error(result.error || 'Failed to import contacts');
      }

      setImportResult(result);

      // Clear the file input
      event.target.value = '';

    } catch (error: unknown) {
      console.error('Import error:', error);
      setUploadError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setUploadError(null);
    setImportResult(null);
    onClose();
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[100]" onClose={handleClose}>
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
                    onClick={handleClose}
                    className="p-2 -m-2 text-gray-400 hover:text-gray-500 transition-colors"
                    disabled={isUploading}
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center h-40">
                      <LoadingSpinner />
                      <p className="mt-4 text-primary-500">
                        {isUploading ? 'Uploading file...' : 'Processing import...'}
                      </p>
                    </div>
                  ) : importResult ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <h4 className="text-lg font-medium text-gray-900">Import Complete</h4>
                        <p className="mt-1 text-sm text-gray-500">
                          Successfully imported {importResult.successCount} contacts
                          {importResult.failureCount > 0 && ` with ${importResult.failureCount} failures`}
                        </p>
                      </div>

                      {importResult.errors.length > 0 && (
                        <div className="mt-4 bg-red-50 rounded-lg p-4">
                          <div className="flex items-start">
                            <ExclamationCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-red-800">Import Errors</h3>
                              <div className="mt-2 text-sm text-red-700">
                                <ul className="list-disc pl-5 space-y-1">
                                  {importResult.errors.map((error, index) => (
                                    <li key={index}>
                                      Row {error.row}: {error.errors.join(', ')}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleClose}
                        className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {uploadError && (
                        <div className="p-4 bg-red-50 rounded-lg">
                          <p className="text-sm text-red-600">{uploadError}</p>
                        </div>
                      )}

                      {IMPORT_METHODS.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => !method.disabled && handleMethodSelect(method.id)}
                          disabled={method.disabled}
                          className={`w-full p-4 text-left border rounded-xl transition-all duration-200 flex items-start gap-4 relative ${
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
                          {method.id === 'csv_upload' && (
                            <input
                              type="file"
                              accept=".csv"
                              onChange={handleFileUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              disabled={method.disabled}
                            />
                          )}
                        </button>
                      ))}

                      <div className="text-center text-sm text-gray-600">
                        Check the <a href="/help#contacts" className="text-primary-500 hover:text-primary-600">Help Page</a> for detailed information about CSV file format and fields.
                      </div>
                    
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
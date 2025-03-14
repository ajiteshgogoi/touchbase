import { Fragment, useLayoutEffect, useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CloudArrowDownIcon, ArrowUpTrayIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ProgressBar } from '../shared/ProgressBar';
import { supabase } from '../../lib/supabase/client';
import { useStore } from '../../stores/useStore';
import { getQueryClient } from '../../utils/queryClient';

interface ImportMethod {
  id: 'google' | 'csv_upload' | 'csv_template' | 'vcf_upload';
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
    icon: (
      <svg
        className="h-6 w-6 text-primary-500"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
    disabled: true,
    disabledReason: 'Coming soon'
  },
  {
    id: 'vcf_upload',
    name: 'Upload VCF file',
    description: 'Import contacts from a VCF (vCard) file',
    icon: <ArrowUpTrayIcon className="h-6 w-6 text-primary-500" />
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
  const [progress, setProgress] = useState<number>(0);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  // Keep track of current progress outside of state to prevent race conditions
  const progressRef = useRef<number>(0);
  const isCompletingRef = useRef<boolean>(false);

  // Cleanup interval on unmount or modal close
  useLayoutEffect(() => {
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [progressInterval]);

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

  const startProgressSimulation = () => {
    // Clear any existing interval
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    setProgress(0);
    progressRef.current = 0;
    isCompletingRef.current = false;
    const interval = setInterval(() => {
      // Don't update if we're completing
      if (!isCompletingRef.current) {
        // Generate random increment between 2-8%
        const increment = Math.random() * 6 + 2;
        progressRef.current += increment;
        // Cap at 93% to leave room for completion
        setProgress(Math.min(93, progressRef.current));
      }
    }, 500);
    setProgressInterval(interval);
  };

  const completeProgress = async () => {
    // Mark as completing to prevent further progress updates
    isCompletingRef.current = true;

    // Clear the interval
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }

    // Ensure we stay at the last progress value before going to 100%
    const lastProgress = Math.min(93, progressRef.current);
    setProgress(lastProgress);
    
    // Set to 100% and wait to show completion
    setProgress(100);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reset completing flag
    isCompletingRef.current = false;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset states
    setUploadError(null);
    setImportResult(null);
    setIsUploading(true);
    setProgress(0);

    try {
      // Start progress simulation
      startProgressSimulation();
      
      // Get file extension and validate type
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !['csv', 'vcf'].includes(fileExt)) {
        throw new Error('Please upload a CSV or VCF file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', fileExt); // Add file type to form data

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }

      if (!EDGE_FUNCTION_URL) {
        throw new Error('Edge function URL not configured');
      }

      const endpoint = fileExt === 'vcf' ? 'bulk-import-vcf' : 'bulk-import';
      const response = await fetch(`${EDGE_FUNCTION_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

     const result = await response.json();

     if (response.ok) {
       await completeProgress();
       setImportResult(result);
     } else {
        if (fileExt === 'csv') {
          // Parse different types of CSV errors
          if (result.error?.includes('Invalid Record Length')) {
            const match = result.error.match(/columns length is (\d+), got (\d+) on line (\d+)/);
            if (match) {
              const [_, expected, got, line] = match;
              throw new Error(`CSV format error on line ${line}: Expected ${expected} columns but got ${got} columns. Please ensure each row has exactly ${expected} columns, even if some values are empty.`);
            }
          } else if (result.error?.includes('CSV_RECORD_INCONSISTENT_COLUMNS')) {
            const lineMatch = result.error.match(/on line (\d+)/);
            const line = lineMatch ? lineMatch[1] : 'unknown';
            throw new Error(`CSV format error on line ${line}: The number of columns is inconsistent with the header. Please check for extra or missing commas. Each row must have exactly 15 columns, even if some values are empty.`);
          } else if (result.error?.includes('CSV_QUOTE')) {
            const lineMatch = result.error.match(/on line (\d+)/);
            const line = lineMatch ? lineMatch[1] : 'unknown';
            throw new Error(`CSV format error on line ${line}: Invalid quote formatting. Please ensure all quoted fields are properly closed and escaped.`);
          }
          // If no specific CSV error is matched, show a CSV-specific default message
          throw new Error(result.error || 'Failed to import contacts. Please check the CSV format and try again.');
        } else {
          // VCF specific error handling
          throw new Error(result.error || 'Failed to import contacts. Please check the VCF file format and try again.');
        }
      }

      // Invalidate all related queries after successful import
      const queryClient = getQueryClient();
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['total-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['total-reminders'] });
      queryClient.invalidateQueries({ queryKey: ['important-events'] });

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
    setProgress(0);
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
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

                <div className="flex-1 overflow-y-auto">
                  {isUploading ? (
                    <div className="p-6 flex flex-col items-center justify-center h-40">
                      <LoadingSpinner />
                      <div className="w-full max-w-xs mt-4">
                        <ProgressBar progress={progress} />
                      </div>
                      <p className="mt-2 text-primary-500">
                        {`Processing ${Math.round(progress)}%`}
                      </p>
                    </div>
                  ) : importResult ? (
                    <div className="p-6 space-y-4">
                      <div className="text-center">
                        <h4 className="text-lg font-medium text-primary-500">Import Complete</h4>
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
                    </div>
                  ) : (
                    <div className="p-6 space-y-4">
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
                          {(method.id === 'csv_upload' || method.id === 'vcf_upload') && (
                            <input
                              type="file"
                              accept={method.id === 'csv_upload' ? '.csv' : '.vcf'}
                              onChange={handleFileUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              disabled={method.disabled}
                            />
                          )}
                        </button>
                      ))}

                      <div className="text-center text-sm text-gray-600">
                        Check the <a href="/help#contacts" className="text-primary-500 hover:text-primary-600">Help Page</a> for detailed information about CSV file format and fields
                      </div>
                    </div>
                  )}
                </div>

                {importResult && (
                  <div className="flex-shrink-0 flex justify-end px-6 py-4 bg-gray-50/80 border-t border-gray-100/75">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white/80 ring-1 ring-gray-200/75 rounded-xl hover:bg-gray-50/90 transition-all duration-200 shadow-sm"
                    >
                      Close
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
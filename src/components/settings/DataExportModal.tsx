import { Fragment, useLayoutEffect, useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ProgressBar } from '../shared/ProgressBar';
import { supabase } from '../../lib/supabase/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}


export const DataExportModal = ({ isOpen, onClose }: Props) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
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

  // Handle modal scroll locking
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
        // Cap at 89% to leave room for completion
        setProgress(Math.min(89, progressRef.current));
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

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);

    try {
      startProgressSimulation();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }


      const response = await fetch('https://api.touchbase.site/functions/v1/export-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'X-Client-Secret': import.meta.env.VITE_CLIENT_SECRET
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export data');
      }

      // Get the filename from the Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"$/);
      const filename = filenameMatch?.[1] ?? `touchbase_export_${new Date().toISOString().split('T')[0]}.zip`;

      // Create a blob from the response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      await completeProgress();

      // Create a link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      handleClose();
    } catch (error: unknown) {
      console.error('Export error:', error);
      setExportError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setExportError(null);
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
              <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl">
                <div className="flex items-center justify-between p-6 border-b border-gray-100/75 dark:border-gray-800/75">
                  <Dialog.Title as="h3" className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Export Data
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="p-2 -m-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                    disabled={isExporting}
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6">
                  {isExporting ? (
                    <div className="flex flex-col items-center justify-center h-40">
                      <LoadingSpinner />
                      <div className="w-full max-w-xs mt-4">
                        <ProgressBar progress={progress} />
                      </div>
                      <p className="mt-2 text-primary-500 dark:text-primary-400">
                        {`Exporting ${Math.round(progress)}%`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {exportError && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-sm text-red-600 dark:text-red-500">{exportError}</p>
                        </div>
                      )}

                      <div className="text-center">
                        <ArrowDownTrayIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                          Export Your Data
                        </h3>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Download all your contacts, interactions, events and reminders in CSV format
                        </p>
                      </div>

                      <button
                        onClick={handleExport}
                        className="w-full mt-4 px-4 py-3 text-sm font-medium text-white bg-primary-500 dark:bg-primary-600 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-sm dark:shadow-soft-dark hover:shadow-md transition-all duration-200"
                      >
                        Export Data
                      </button>

                      <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
                        Your data will be exported as a ZIP file containing separate CSV files
                      </p>
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
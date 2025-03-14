import { Fragment, useLayoutEffect, useState } from 'react';
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
  const [totalContacts, setTotalContacts] = useState<number>(0);

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

  const calculateTotalContacts = async (file: File): Promise<number> => {
    if (file.name.toLowerCase().endsWith('.csv')) {
      // For CSV, count lines minus header using streams
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim()).length - 1;
      return lines;
    } else {
      // For VCF, count contacts by streaming
      let count = 0;
      let buffer = '';
      const decoder = new TextDecoder();
      const reader = file.stream().getReader();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Count complete vCards
          while (buffer.includes('END:VCARD')) {
            const endIndex = buffer.indexOf('END:VCARD') + 'END:VCARD'.length;
            const vcard = buffer.slice(0, endIndex);
            buffer = buffer.slice(endIndex);

            if (vcard.includes('BEGIN:VCARD')) {
              count++;
            }
          }
        }

        // Process any remaining buffer
        buffer += decoder.decode();
        while (buffer.includes('END:VCARD')) {
          const endIndex = buffer.indexOf('END:VCARD') + 'END:VCARD'.length;
          const vcard = buffer.slice(0, endIndex);
          buffer = buffer.slice(endIndex);

          if (vcard.includes('BEGIN:VCARD')) {
            count++;
          }
        }

        return count;
      } finally {
        reader.releaseLock();
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset states
    setUploadError(null);
    setImportResult(null);
    setIsUploading(true);
    setProgress(0);
    setTotalContacts(0);

    try {
      const total = await calculateTotalContacts(file);
      setTotalContacts(total);
      
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
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': fileExt === 'vcf' ? 'text/event-stream' : 'application/json'
        },
        body: formData
      });

      let result;
      if (fileExt === 'vcf') {
        // For VCF files, process chunks as they come in
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Failed to read response stream');
        }

        let processedContacts = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          console.log('Received chunk:', chunk);

          // Split chunk into lines
          const lines = chunk.trim().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            
            console.log('Processing line:', line);

            // Try parsing as JSON first
            try {
              const jsonResult = JSON.parse(line);
              if (jsonResult.success !== undefined) {
                result = jsonResult;
                break;
              }
            } catch {
              // Not JSON, check if it's a progress update
              const match = line.match(/processed:(\d+)/);
              if (match && match[1]) {
                processedContacts = parseInt(match[1], 10);
                const progressPercentage = (processedContacts / total) * 100;
                console.log('Progress update:', progressPercentage);
                setProgress(progressPercentage);
                setImportResult(prev => prev ? { ...prev, successCount: processedContacts } : null);
              }
            }
          }

          if (result?.success !== undefined) {
            break;
          }
        }

        reader.releaseLock();
      } else {
        // For CSV files, handle as before
        result = await response.json();
      }

     // Update progress based on imported contacts
     if (response.ok) {
       const processedCount = result.successCount + result.failureCount;
       const progressPercentage = (processedCount / total) * 100;
       setProgress(progressPercentage);
       setImportResult(result);
     }
     
     if (!response.ok) {
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
    setTotalContacts(0);
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
                        {`Processing ${Math.round(progress)}% (${importResult?.successCount || 0}/${totalContacts} contacts)`}
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
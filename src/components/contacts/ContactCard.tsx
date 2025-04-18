import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BasicContact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { contactsPaginationService } from '../../services/pagination';
import { contactsService } from '../../services/contacts';
import { contentReportsService } from '../../services/content-reports';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import {
  PhoneIcon,
  TrashIcon,
  PencilSquareIcon,
  FlagIcon,
  CakeIcon,
  HeartIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline/esm/index.js';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid/esm/index.js';
import { CheckCircleIcon as CheckCircleOutlineIcon } from '@heroicons/react/24/outline/esm/index.js';
import {
  getEventTypeDisplay,
  formatEventDate,
  sortEventsByType,
  extractHashtags,
  formatHashtagForDisplay,
  formatSocialMediaUrl
} from './utils';
import dayjs from 'dayjs';

interface ContactCardProps {
  contact: BasicContact;
  eventsMap: Record<string, ImportantEvent[]>;
  isPremium: boolean;
  isOnTrial: boolean;
  onDelete: (contactId: string) => Promise<void>;
  onQuickInteraction: (params: { contactId: string; type: Interaction['type']; contactName: string }) => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  isContactsPage?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onToggleSelect?: (contactId: string) => void;
  onStartSelectionMode?: () => void;
  isBulkDeleting?: boolean;
}

export const ContactCard = ({
  contact,
  eventsMap,
  isPremium,
  isOnTrial,
  onDelete,
  onQuickInteraction,
  isExpanded,
  onExpandChange,
  onLoadingChange,
  isContactsPage,
  isSelected,
  isSelectionMode,
  onToggleSelect,
  onStartSelectionMode,
  isBulkDeleting = false
}: ContactCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const pressStartTime = useRef<number | null>(null);
  const mouseButton = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Only handle long press when not in selection mode
    if (!isSelectionMode && !isBulkDeleting && !isDeleting) {
      pressStartTime.current = Date.now();
      if ('button' in e) {
        mouseButton.current = e.button;
      }

      pressTimer.current = setTimeout(() => {
        onStartSelectionMode?.();
        onToggleSelect?.(contact.id);
      }, 500);
    }
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    // Only handle events when not in selection mode
    if (!isSelectionMode) {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
      pressStartTime.current = null;

      // Handle right click to enter selection mode
      if ('button' in e && e.button === 2) {
        onStartSelectionMode?.();
        onToggleSelect?.(contact.id);
      }
    }
  };

  const handlePressMove = () => {
    // Only handle movement outside selection mode
    if (!isSelectionMode && pressTimer.current) {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    }
  };

  // Handle keyboard shortcuts //
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isSelectionMode && !isBulkDeleting && !isDeleting) {
        onToggleSelect?.(contact.id);
      } else if (!isBulkDeleting && !isDeleting) {
        onExpandChange(!isExpanded);
      }
    }
  };

  // Handle right click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSelectionMode && !isBulkDeleting && !isDeleting) {
      onStartSelectionMode?.();
      onToggleSelect?.(contact.id);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
      }
    };
  }, []);

  const { data: expandedDetails, isLoading } = useQuery({
    queryKey: ['expanded-contact', contact.id],
    queryFn: () => contactsPaginationService.getExpandedContactDetails(contact.id),
    enabled: isExpanded,
    staleTime: 5 * 60 * 1000,
  });

  // Notify parent about loading state changes and handle selection mode
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Collapse card when entering selection mode
  useEffect(() => {
    if (isSelectionMode && isExpanded) {
      onExpandChange(false);
    }
  }, [isSelectionMode, isExpanded, onExpandChange]);

  const handleDeleteContact = async () => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        setIsDeleting(true);
        await onDelete(contact.id);
      } catch (error) {
        console.error('Error deleting contact:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleReportContent = async (content: string) => {
    if (confirm('Report this AI suggestion as inappropriate?')) {
      try {
        await contentReportsService.reportContent(content, {
          contactId: contact.id,
          contentType: 'suggestion'
        });
        alert('Thank you for reporting. We will review this suggestion.');
      } catch (error) {
        console.error('Error reporting content:', error);
        alert('Failed to report content. Please try again.');
      }
    }
  };

  return (
    <div
      id={contact.id}
      ref={cardRef}
      onClick={(e) => {
        if (isSelectionMode && !isDeleting && !isBulkDeleting && e.button === 0) {
          onToggleSelect?.(contact.id);
        }
      }}
      className={`contact-card bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border ${
        isSelected ? 'border-primary-400 dark:border-primary-500 shadow-md dark:shadow-lg' : 'border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft hover:shadow-md dark:hover:shadow-lg'
      } transition-all duration-200 scroll-mt-6 ${isSelectionMode ? 'cursor-pointer' : ''}`}
    >
      {/* Compact Header */}
      <div
        onClick={(e) => {
          e.stopPropagation(); // Prevent triggering container's click
          // Only handle click for touch events and expand/collapse
          if (!('button' in e) && isSelectionMode && !isDeleting && !isBulkDeleting) {
            onToggleSelect?.(contact.id);
          } else if (e.button === 0 && !e.ctrlKey && !e.metaKey && !isSelectionMode && !isDeleting && !isBulkDeleting) {
            onExpandChange(!isExpanded);
          }
        }}
        onMouseDown={handlePressStart}
        onMouseUp={(e) => {
          // Handle selection on mouse up in selection mode
          if (isSelectionMode && !isDeleting && !isBulkDeleting && e.button === 0) {
            onToggleSelect?.(contact.id);
          }
          handlePressEnd(e);
        }}
        onMouseMove={handlePressMove}
        onMouseLeave={handlePressEnd}
        onTouchStart={(e) => {
          if (!isSelectionMode && !isBulkDeleting && !isDeleting) {
            handlePressStart(e);
          }
        }}
        onTouchEnd={(e) => {
          if (!isSelectionMode && !isBulkDeleting && !isDeleting) {
            handlePressEnd(e);
          }
        }}
        onTouchMove={handlePressMove}
        onTouchCancel={handlePressEnd}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className="flex items-center justify-between p-4"
      >
        {/* Left side: Status indicator and name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-6 flex-shrink-0">
            {isSelectionMode ? (
              <div
                className={`rounded-lg transition-colors ${
                  isSelected ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400'
                }`}
                aria-label={isSelected ? "Unselect contact" : "Select contact"}
              >
                {isSelected ? (
                  <CheckCircleSolidIcon className="h-6 w-6" />
                ) : (
                  <CheckCircleOutlineIcon className="h-6 w-6" />
                )}
              </div>
            ) : (
              <div className="text-gray-500">
                {isExpanded ? (
                  <ChevronDownIcon className="h-5 w-5 text-primary-500" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5" />
                )}
              </div>
            )}
          </div>
          <div className="py-1">
            <div className="flex items-center space-y-1">
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 transition-colors tracking-[-0.01em]">
                  {contact.name}
                </h3>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${
                      contact.missed_interactions > 3 ? 'bg-red-400' :
                      contact.missed_interactions > 2 ? 'bg-orange-400' :
                      contact.missed_interactions > 1 ? 'bg-yellow-400' :
                      contact.missed_interactions > 0 ? 'bg-lime-400' :
                      'bg-green-400'
                    }`}
                    title={`${contact.missed_interactions} missed interactions`}
                  />
                  {contact.contact_frequency && (
                    <span>
                      {contact.contact_frequency === 'every_three_days'
                        ? 'Bi-weekly'
                        : contact.contact_frequency.charAt(0).toUpperCase() + contact.contact_frequency.slice(1).replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex ml-4 space-x-2">
          <Link
            to={isSelectionMode ? '#' : `/contacts/${contact.id}/edit`}
            state={{ from: '/contacts' }}
            className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${
              isSelectionMode || isDeleting ? 'invisible cursor-pointer pointer-events-none' : 'text-gray-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30'
            }`}
            title={isSelectionMode ? "Click to select/deselect" : "Edit contact"}
            onClick={(e) => {
              e.stopPropagation(); // Stop propagation to prevent card expansion
              if (isSelectionMode && !isBulkDeleting) {
                onToggleSelect?.(contact.id);
              }
            }}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering collapse/expand
              if (isSelectionMode && !isBulkDeleting) {
                e.stopPropagation();
                onToggleSelect?.(contact.id);
              } else if (!isBulkDeleting) {
                handleDeleteContact();
              }
            }}
            className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${
              isSelectionMode ? 'invisible' :
              isDeleting ? 'text-gray-400 dark:text-gray-600 cursor-pointer pointer-events-none' : 'text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
            }`}
            title={isSelectionMode ? "Click to select/deselect" : isDeleting ? 'Deleting contact...' : 'Delete contact'}
          >
            {isDeleting ? (
              <div className="h-4 w-4 flex items-center justify-center">
                <div className="transform scale-50 -m-2">
                  <LoadingSpinner />
                </div>
              </div>
            ) : (
              <TrashIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Details Section */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-4 border-t border-gray-100 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
          {isLoading ? (
            <div className="py-8 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : expandedDetails && (
            <div className="mt-4 space-y-4">
              {(expandedDetails.phone || expandedDetails.email || expandedDetails.social_media_handle) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-gray-600/90">
                  {expandedDetails.phone && (
                    <a
                      href={isDeleting ? '#' : `tel:${expandedDetails.phone}`}
                      className={`flex items-center px-3 py-2.5 bg-gray-50 dark:bg-gray-800 ${!isDeleting && 'hover:bg-gray-100 dark:hover:bg-gray-700'} rounded-lg transition-colors group ${isDeleting ? 'cursor-not-allowed opacity-60' : ''}`}
                      onClick={e => isDeleting && e.preventDefault()}
                    >
                      <PhoneIcon className="h-4 w-4 mr-2 text-green-500/90 dark:text-green-400/90 flex-shrink-0 group-hover:text-green-600/90 dark:group-hover:text-green-300/90 transition-colors" />
                      <span className="truncate leading-5 font-[450] text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {expandedDetails.phone}
                      </span>
                    </a>
                  )}
                  {expandedDetails.email && (
                    <a
                      href={isDeleting ? '#' : `mailto:${expandedDetails.email}`}
                      className={`flex items-center px-3 py-2.5 bg-gray-50 dark:bg-gray-800 ${!isDeleting && 'hover:bg-gray-100 dark:hover:bg-gray-700'} rounded-lg transition-colors group ${isDeleting ? 'cursor-not-allowed opacity-60' : ''}`}
                      onClick={e => isDeleting && e.preventDefault()}
                    >
                      <svg className="h-4 w-4 mr-2 text-blue-500/90 dark:text-blue-400/90 flex-shrink-0 group-hover:text-blue-600/90 dark:group-hover:text-blue-300/90 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate leading-5 font-[450] text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {expandedDetails.email}
                      </span>
                    </a>
                  )}
                  {expandedDetails.social_media_handle && expandedDetails.social_media_platform && (
                    <a
                      href={isDeleting ? '#' : formatSocialMediaUrl(expandedDetails.social_media_handle, expandedDetails.social_media_platform)}
                      target={isDeleting ? '_self' : '_blank'}
                      rel="noopener noreferrer"
                      className={`flex items-center px-3 py-2.5 bg-gray-50 dark:bg-gray-800 ${!isDeleting && 'hover:bg-gray-100 dark:hover:bg-gray-700'} rounded-lg transition-colors group ${isDeleting ? 'cursor-not-allowed opacity-60' : ''}`}
                      onClick={e => isDeleting && e.preventDefault()}
                    >
                      {expandedDetails.social_media_platform === 'linkedin' ? (
                        <svg className="h-4 w-4 mr-2 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/>
                        </svg>
                      ) : expandedDetails.social_media_platform === 'twitter' ? (
                        <svg className="h-4 w-4 mr-2 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 mr-2 text-pink-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                          <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"></path>
                          <circle cx="17.5" cy="6.5" r="1.5"></circle>
                        </svg>
                      )}
                      <span className="truncate leading-5 font-[450] text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        @{expandedDetails.social_media_handle}
                      </span>
                    </a>
                  )}
                </div>
              )}

              {/* Events section */}
              {(eventsMap[contact.id] || []).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Important Dates</span>
                  </div>
                  <div className="px-3 py-2">
                    <div className="flex flex-wrap gap-3 text-sm min-w-0">
                      {sortEventsByType(eventsMap[contact.id] || []).map((event: ImportantEvent, idx: number) => (
                        <span key={idx} className="inline-flex items-center flex-wrap">
                          {event.type === 'birthday' ? (
                            <CakeIcon className="h-4 w-4 mr-1.5 text-pink-500 flex-shrink-0" />
                          ) : event.type === 'anniversary' ? (
                            <HeartIcon className="h-4 w-4 mr-1.5 text-rose-500 flex-shrink-0" />
                          ) : (
                            <StarIcon className="h-4 w-4 mr-1.5 text-purple-500 flex-shrink-0" />
                          )}
                          <span className="text-gray-700 dark:text-gray-200 font-medium break-words">{event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}:&nbsp;</span>
                          <span className="text-gray-600 dark:text-gray-400 break-words">{formatEventDate(event.date)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Contact status section */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Contacted</span>
                    </div>
                    <div className="px-3 py-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{contact.last_contacted ? dayjs(contact.last_contacted).fromNow() : 'Never'}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Next Contact Due</span>
                    </div>
                    <div className="px-3 py-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{contactsService.formatDueDate(contact.next_contact_due)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Categories/Hashtags section */}
              {expandedDetails.notes && extractHashtags(expandedDetails.notes).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categories</span>
                  </div>
                  <div className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {extractHashtags(expandedDetails.notes).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-800"
                        >
                          {formatHashtagForDisplay(tag)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Notes section */}
              {expandedDetails.notes && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Personal Notes</span>
                  </div>
                  <div className="px-3 py-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{expandedDetails.notes}</span>
                  </div>
                </div>
              )}

              {/* AI Suggestions section */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Suggestions</span>
                </div>
                <div className="px-3 py-2">
                  {!expandedDetails.ai_last_suggestion ? (
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-sm text-gray-600/90 dark:text-gray-400">
                        No suggestions available
                      </span>
                    </div>
                  ) : expandedDetails.ai_last_suggestion === 'Upgrade to Premium to get personalised suggestions!' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">Upgrade to Premium</Link> to get personalised suggestions!
                      </span>
                    </div>
                  ) : (
                    <div className="group flex items-start gap-2">
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                        {expandedDetails.ai_last_suggestion.split('\n').slice(0, 5).join('\n')}
                      </span>
                      {expandedDetails.ai_last_suggestion && (
                        <button
                          onClick={() => {
                            if (!isDeleting) {
                              handleReportContent(expandedDetails.ai_last_suggestion!)
                            }
                          }}
                          className={`flex-shrink-0 p-1 ${isDeleting ? 'text-gray-300 cursor-not-allowed' : 'text-gray-300 hover:text-red-400'} transition-colors`}
                          title={isDeleting ? "Cannot report while deleting" : "Report inappropriate suggestion"}
                        >
                          <FlagIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div
        className="p-4 border-t border-gray-100/50 dark:border-gray-800/50 bg-white/30 dark:bg-gray-900/30"
        onClick={(e) => {
          if (isSelectionMode && !isBulkDeleting && e.button === 0) {
            e.stopPropagation();
            onToggleSelect?.(contact.id);
          }
        }}
      >
        <div className={`flex flex-wrap items-center justify-start gap-2 w-full bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm ${isSelectionMode ? 'cursor-pointer' : ''}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isSelectionMode && !isDeleting) {
                onToggleSelect?.(contact.id);
              } else if (!isDeleting) {
                onQuickInteraction({
                  contactId: contact.id,
                  type: contact.preferred_contact_method || 'message',
                  contactName: contact.name
                });
              }
            }}
            className={`inline-flex items-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] rounded-lg shadow-sm transition-all duration-200
              ${isSelectionMode || isDeleting || isBulkDeleting ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer pointer-events-none' : 'text-white bg-primary-500 dark:bg-primary-600 hover:bg-primary-600 dark:hover:bg-primary-700 active:scale-[0.98] hover:shadow-md dark:hover:shadow-lg'}`}
            title={isDeleting ? "Deleting contact..." : isSelectionMode ? "Click to select/deselect" : "Log an interaction"}
          >
            Log Interaction
          </button>
          <div
            onClick={(e) => {
              if (isSelectionMode) {
                e.stopPropagation();
                onToggleSelect?.(contact.id);
              }
            }}
            className={`inline-flex items-center justify-center ${isSelectionMode || isDeleting || isBulkDeleting ? 'cursor-pointer pointer-events-none' : ''}`}
          >
            {(isPremium || isOnTrial) ? (
              <Link
                to={isSelectionMode ? "#" : `/contacts/${contact.id}/interactions`}
                state={isContactsPage ? { fromContact: true, contactHash: contact.id } : undefined}
                className={`inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] rounded-lg shadow-sm transition-all duration-200
                  ${isSelectionMode || isDeleting || isBulkDeleting
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 pointer-events-none cursor-pointer'
                    : 'text-primary-600 dark:text-primary-400 bg-primary-50/90 dark:bg-primary-900/30 hover:bg-primary-100/90 dark:hover:bg-primary-900/50 active:scale-[0.98] hover:shadow-md dark:hover:shadow-lg'}`}
                title={isDeleting ? "Deleting contact..." : isSelectionMode ? "Click to select/deselect" : "View interaction history"}
                onClick={e => (isSelectionMode || isDeleting) && e.preventDefault()}
              >
                View History
              </Link>
            ) : (
              <Link
                to={isSelectionMode ? "#" : `/contacts/${contact.id}/interactions`}
                state={isContactsPage ? { fromContact: true, contactHash: contact.id } : undefined}
                className={`inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] rounded-lg shadow-soft dark:shadow-soft-dark transition-all duration-200
              ${isSelectionMode
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 pointer-events-none'
                : 'text-gray-600 dark:text-gray-400 bg-gray-100/90 dark:bg-gray-800/60 hover:bg-gray-200/90 dark:hover:bg-gray-700/60 active:scale-[0.98] hover:shadow-md'}`}
            title={isSelectionMode ? "Click to select/deselect" : "Upgrade to view interaction history"}
                onClick={e => isSelectionMode && e.preventDefault()}
              >
                View History
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

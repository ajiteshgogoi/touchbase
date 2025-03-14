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
  CheckCircleIcon
} from '@heroicons/react/24/outline/esm/index.js';
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
  onStartSelectionMode
}: ContactCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout>();
  const pressStartTime = useRef<number>();
  const mouseButton = useRef<number>();
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Only handle long press when not in selection mode
    if (!isSelectionMode) {
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
        pressTimer.current = undefined;
      }
      pressStartTime.current = undefined;

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
      clearTimeout(pressTimer.current);
      pressTimer.current = undefined;
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isSelectionMode) {
        onToggleSelect?.(contact.id);
      } else {
        onExpandChange(!isExpanded);
      }
    }
  };

  // Handle right click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSelectionMode) {
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
      className={`contact-card bg-white/60 backdrop-blur-xl rounded-xl border ${
        isSelected ? 'border-primary-400 shadow-md' : 'border-gray-100/50 shadow-soft hover:shadow-md'
      } transition-all duration-200 scroll-mt-6`}
    >
      {/* Compact Header */}
      <div
        onClick={(e) => {
          // Only handle click for touch events and expand/collapse
          if (!('button' in e) && isSelectionMode) {
            onToggleSelect?.(contact.id);
          } else if (e.button === 0 && !e.ctrlKey && !e.metaKey && !isSelectionMode) {
            onExpandChange(!isExpanded);
          }
        }}
        onMouseDown={handlePressStart}
        onMouseUp={(e) => {
          // Handle selection on mouse up in selection mode
          if (isSelectionMode && e.button === 0) {
            onToggleSelect?.(contact.id);
          }
          handlePressEnd(e);
        }}
        onMouseMove={handlePressMove}
        onMouseLeave={handlePressEnd}
        onTouchStart={(e) => {
          if (!isSelectionMode) {
            handlePressStart(e);
          }
        }}
        onTouchEnd={(e) => {
          if (!isSelectionMode) {
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
          {isSelectionMode && (
            <div
              className={`flex-shrink-0 rounded-lg p-1 -m-1 transition-colors ${
                isSelected ? 'text-primary-500' : 'text-gray-400 hover:text-primary-500'
              }`}
              aria-label={isSelected ? "Unselect contact" : "Select contact"}
            >
              <CheckCircleIcon
                className={`h-6 w-6 ${isSelected ? 'fill-primary-50' : ''}`}
              />
            </div>
          )}
          <div className="py-1">
            <div className={`flex items-center space-y-1 ${!isSelectionMode ? '-ml-2' : ''}`}>
              {!isSelectionMode && (
                <div className="text-gray-500">
                  {isExpanded ? (
                    <ChevronDownIcon className="h-5 w-5 text-primary-500" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5" />
                  )}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-semibold text-primary-500 hover:text-primary-600 transition-colors tracking-[-0.01em]">
                  {contact.name}
                </h3>
                <div className="flex items-center text-sm text-gray-500">
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
        {!isSelectionMode && (
          <div className="flex ml-4 space-x-2">
            <Link
              to={`/contacts/${contact.id}/edit`}
              state={{ from: '/contacts' }}
              className="inline-flex items-center p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
              title="Edit contact"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </Link>
            <button
              onClick={handleDeleteContact}
              disabled={isDeleting}
              className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${
                isDeleting
                  ? 'text-gray-400 bg-gray-100'
                  : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
              }`}
              title={isDeleting ? 'Deleting contact...' : 'Delete contact'}
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
        )}
      </div>

      {/* Collapsible Details Section */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-4 border-t border-gray-100 bg-white/60 backdrop-blur-sm">
          {isLoading ? (
            <div className="py-8 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : expandedDetails && (
            <div className="mt-4 space-y-4">
              {(expandedDetails.phone || expandedDetails.social_media_handle) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-gray-600/90">
                  {expandedDetails.phone && (
                    <a
                      href={`tel:${expandedDetails.phone}`}
                      className="flex items-center px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                    >
                      <PhoneIcon className="h-4 w-4 mr-2 text-green-500/90 flex-shrink-0 group-hover:text-green-600/90 transition-colors" />
                      <span className="truncate leading-5 font-[450] group-hover:text-primary-600 transition-colors">
                        {expandedDetails.phone}
                      </span>
                    </a>
                  )}
                  {expandedDetails.social_media_handle && expandedDetails.social_media_platform && (
                    <a
                      href={formatSocialMediaUrl(expandedDetails.social_media_handle, expandedDetails.social_media_platform)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
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
                      <span className="truncate leading-5 font-[450] group-hover:text-primary-600 transition-colors">
                        @{expandedDetails.social_media_handle}
                      </span>
                    </a>
                  )}
                </div>
              )}

              {/* Events section */}
              {(eventsMap[contact.id] || []).length > 0 && (
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Important Dates</span>
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
                          <span className="text-gray-700 font-medium break-words">{event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}:&nbsp;</span>
                          <span className="text-gray-600 break-words">{formatEventDate(event.date)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Contact status section */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Contacted</span>
                    </div>
                    <div className="px-3 py-2">
                      <span className="text-sm text-gray-700">{contact.last_contacted ? dayjs(contact.last_contacted).fromNow() : 'Never'}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Contact Due</span>
                    </div>
                    <div className="px-3 py-2">
                      <span className="text-sm text-gray-700">{contactsService.formatDueDate(contact.next_contact_due)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Categories/Hashtags section */}
              {expandedDetails.notes && extractHashtags(expandedDetails.notes).length > 0 && (
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Categories</span>
                  </div>
                  <div className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {extractHashtags(expandedDetails.notes).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm bg-primary-50 text-primary-700 border border-primary-100"
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
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Personal Notes</span>
                  </div>
                  <div className="px-3 py-2">
                    <span className="text-sm text-gray-700 whitespace-pre-line">{expandedDetails.notes}</span>
                  </div>
                </div>
              )}

              {/* AI Suggestions section */}
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-100">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Suggestions</span>
                </div>
                <div className="px-3 py-2">
                  {!expandedDetails.ai_last_suggestion ? (
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-sm text-gray-600/90">
                        No suggestions available
                      </span>
                    </div>
                  ) : expandedDetails.ai_last_suggestion === 'Upgrade to Premium to get personalised suggestions!' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get personalised suggestions!
                      </span>
                    </div>
                  ) : (
                    <div className="group flex items-start gap-2">
                      <span className="flex-1 text-sm text-gray-700 whitespace-pre-line">
                        {expandedDetails.ai_last_suggestion.split('\n').slice(0, 5).join('\n')}
                      </span>
                      {expandedDetails.ai_last_suggestion && (
                        <button
                          onClick={() => handleReportContent(expandedDetails.ai_last_suggestion!)}
                          className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
                          title="Report inappropriate suggestion"
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
      <div className="p-4 border-t border-gray-100/50 bg-white/30">
        <div className="flex flex-wrap items-center justify-start gap-2 w-full bg-white/60 backdrop-blur-sm">
          <button
            onClick={() => onQuickInteraction({ contactId: contact.id, type: 'call', contactName: contact.name })}
            className={`inline-flex items-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] rounded-lg shadow-sm transition-all duration-200
              ${isSelectionMode ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-white bg-primary-500 hover:bg-primary-600 active:scale-[0.98] hover:shadow-md'}`}
            title={isSelectionMode ? "Not available in selection mode" : "Log an interaction"}
            disabled={isSelectionMode}
          >
            Log Interaction
          </button>
          {(isPremium || isOnTrial) ? (
            <Link
              to={isSelectionMode ? "#" : `/contacts/${contact.id}/interactions`}
              state={isContactsPage ? { fromContact: true, contactHash: contact.id } : undefined}
              className={`inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] rounded-lg shadow-sm transition-all duration-200
                ${isSelectionMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-primary-600 bg-primary-50/90 hover:bg-primary-100/90 active:scale-[0.98] hover:shadow-md'}`}
              title={isSelectionMode ? "Not available in selection mode" : "View interaction history"}
              onClick={e => isSelectionMode && e.preventDefault()}
            >
              View History
            </Link>
          ) : (
            <Link
              to={isSelectionMode ? "#" : `/contacts/${contact.id}/interactions`}
              state={isContactsPage ? { fromContact: true, contactHash: contact.id } : undefined}
              className={`inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] rounded-lg shadow-soft transition-all duration-200
                ${isSelectionMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'text-gray-600 bg-gray-100/90 hover:bg-gray-200/90 active:scale-[0.98] hover:shadow-md'}`}
              title={isSelectionMode ? "Not available in selection mode" : "Upgrade to view interaction history"}
              onClick={e => isSelectionMode && e.preventDefault()}
            >
              View History
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BasicContact, Contact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { contactsPaginationService } from '../../services/pagination';
import { contactsService } from '../../services/contacts';
import { contentReportsService } from '../../services/content-reports';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import {
  PhoneIcon,
  TrashIcon,
  PencilSquareIcon,
  FlagIcon,
  AtSymbolIcon,
  CakeIcon,
  HeartIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline/esm/index.js';
import {
  getEventTypeDisplay,
  formatEventDate,
  sortEventsByType,
  extractHashtags,
  formatHashtagForDisplay
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
  onLoadingChange
}: ContactCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Contact | null>(null);

  // Notify parent about loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  useEffect(() => {
    async function loadExpandedDetails() {
      if (isExpanded && !expandedDetails) {
        setIsLoading(true);
        try {
          const details = await contactsPaginationService.getExpandedContactDetails(contact.id);
          setExpandedDetails(details);
        } catch (error) {
          console.error('Error loading expanded contact details:', error);
        } finally {
          setIsLoading(false);
        }
      }
    }

    loadExpandedDetails();
  }, [isExpanded, contact.id, expandedDetails]);


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
      className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft hover:shadow-md transition-all duration-200 scroll-mt-6"
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between p-4">
        {/* Left side: Status indicator and name */}
        <div
          onClick={() => onExpandChange(!isExpanded)}
          className="flex items-center flex-1 min-w-0 cursor-pointer rounded-lg p-1 -m-1"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onExpandChange(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse contact details" : "Expand contact details"}
        >
          <div className="flex items-center py-1 -ml-2 text-gray-500">
            {isExpanded ? (
              <ChevronDownIcon className="h-5 w-5 text-primary-500" />
            ) : (
              <ChevronRightIcon className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-semibold text-primary-500 hover:text-primary-600 transition-colors tracking-[-0.01em]">{contact.name}</h3>
              <div className="flex items-center text-sm text-gray-500">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  contact.missed_interactions > 3 ? 'bg-red-400' :
                  contact.missed_interactions > 2 ? 'bg-orange-400' :
                  contact.missed_interactions > 1 ? 'bg-yellow-400' :
                  contact.missed_interactions > 0 ? 'bg-lime-400' :
                  'bg-green-400'
                }`} title={`${contact.missed_interactions} missed interactions`}></div>
                {contact.contact_frequency && (
                  <span>
                    {contact.contact_frequency === 'every_three_days'
                      ? 'Bi-weekly contact'
                      : contact.contact_frequency.charAt(0).toUpperCase() + contact.contact_frequency.slice(1).replace(/_/g, ' ') + ' contact'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Action buttons */}
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
                    <div className="flex items-center px-3 py-2.5 bg-gray-50 rounded-lg">
                      <PhoneIcon className="h-4 w-4 mr-2 text-green-500/90 flex-shrink-0" />
                      <span className="truncate leading-5 font-[450]">{expandedDetails.phone}</span>
                    </div>
                  )}
                  {expandedDetails.social_media_handle && (
                    <div className="flex items-center px-3 py-2.5 bg-gray-50 rounded-lg">
                      <AtSymbolIcon className="h-4 w-4 mr-2 text-pink-500/90 flex-shrink-0" />
                      <span className="truncate leading-5 font-[450]">{expandedDetails.social_media_handle}</span>
                    </div>
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

      {/* Action Buttons - Always Visible */}
      <div className="p-4 border-t border-gray-100/50 bg-white/30">
        <div className="flex flex-wrap items-center justify-start gap-2 w-full bg-white/60 backdrop-blur-sm">
          <button
            onClick={() => onQuickInteraction({ contactId: contact.id, type: 'call', contactName: contact.name })}
            className="inline-flex items-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-white bg-primary-500 hover:bg-primary-600 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
            title="Log an interaction"
          >
            Log Interaction
          </button>
          {(isPremium || isOnTrial) ? (
            <Link
              to={`/contacts/${contact.id}/interactions`}
              className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-primary-600 bg-primary-50/90 hover:bg-primary-100/90 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
              title="View interaction history"
            >
              View History
            </Link>
          ) : (
            <Link
              to={`/contacts/${contact.id}/interactions`}
              className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-gray-600 bg-gray-100/90 hover:bg-gray-200/90 active:scale-[0.98] rounded-lg shadow-soft hover:shadow-md transition-all duration-200"
              title="Upgrade to view interaction history"
            >
              View History
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
import { useCallback, useRef, useEffect } from 'react';
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Link } from 'react-router-dom';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  TrashIcon,
  PhoneIcon,
  AtSymbolIcon,
  CakeIcon,
  HeartIcon,
  StarIcon,
  FlagIcon
} from '@heroicons/react/24/outline';
import type { Contact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { contactsService } from '../../services/contacts';
import {
  getEventTypeDisplay,
  formatEventDate,
  sortEventsByType,
  extractHashtags,
  formatHashtagForDisplay
} from '../contacts/utils';
import dayjs from 'dayjs';

interface VirtualizedContactsListProps {
  contacts: Contact[];
  expandedContacts: Record<string, boolean>;
  eventsMap: Record<string, ImportantEvent[]>;
  onToggleExpand: (contactId: string) => void;
  onDelete: (contactId: string) => void;
  deletingContactId: string | null;
  onQuickInteraction: (params: { isOpen: boolean; contactId: string; type: Interaction['type']; contactName: string }) => void;
  isPremium: boolean;
  isOnTrial: boolean;
  onReportContent: (contactId: string, content: string) => void;
}

export const VirtualizedContactsList = ({
  contacts,
  expandedContacts,
  eventsMap,
  onToggleExpand,
  onDelete,
  deletingContactId,
  onQuickInteraction,
  isPremium,
  isOnTrial,
  onReportContent
}: VirtualizedContactsListProps) => {
  // Reference to the List component
  const listRef = useRef<VariableSizeList>(null);
  
  // Cache of row heights
  const rowHeights = useRef<{ [key: number]: number }>({});
  
  // Function to get the height of a row
  const getRowHeight = useCallback(
    (index: number) => {
      const contact = contacts[index];
      if (!contact) return 0;
      
      // Base height for the compact header with 16px padding top/bottom
      let height = 96; // Header height (48px content + 32px padding)
      
      // Additional height for expanded state
      if (expandedContacts[contact.id]) {
        // Base expanded content height
        height += 56; // Padding and spacing (32px padding + 24px spacing)
        
        // Add height for contact details
        if (contact.phone || contact.social_media_handle) {
          height += 72; // Increased from 64px to account for consistent spacing
        }
        
        // Add height for events section
        const events = eventsMap[contact.id] || [];
        if (events.length > 0) {
          height += 96; // Increased from 88px to account for consistent padding
        }
        
        // Add height for status section
        height += 96; // Increased from 88px to account for consistent padding
        
        // Add height for Categories/Hashtags section if notes have hashtags
        if (contact.notes && extractHashtags(contact.notes).length > 0) {
          height += 96; // Standard section height
        }

        // Add height for Personal Notes section if notes exist and don't only contain hashtags
        if (contact.notes && contact.notes.replace(/#[a-zA-Z0-9_]+/g, '').trim()) {
          height += Math.min(128, contact.notes.split('\n').length * 24 + 56); // Adjusted for consistent spacing
        }
        
        // Add height for AI suggestions
        height += 96; // Increased from 88px to account for consistent padding
        
        // Add height for action buttons
        height += 80; // Increased from 72px to account for consistent padding
      } else {
        // Add height for action buttons when collapsed
        height += 80; // Increased from 72px to account for consistent padding
      }
      
      return height;
    },
    [expandedContacts, eventsMap]
  );
  
  // Reset cache when data changes
  useEffect(() => {
    rowHeights.current = {};
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedContacts, contacts]);

  return (
    <div style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
      <AutoSizer>
        {({ height, width }: { height: number; width: number }) => (
          <VariableSizeList
            ref={listRef}
            height={height}
            width={width}
            itemCount={contacts.length}
            itemSize={getRowHeight}
            overscanCount={5}
          >
            {({ index, style }) => {
              const contact = contacts[index];
              if (!contact) return null;
              
              return (
                <div style={{...style, padding: '8px 16px'}}>
              <div
                className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-md"
                    id={contact.id}
                  >
                    {/* Compact Header */}
                    <div className="flex items-center justify-between p-4">
                      {/* Left side: Status indicator and name */}
                      <div
                        onClick={() => onToggleExpand(contact.id)}
                        className="flex items-center flex-1 min-w-0 cursor-pointer rounded-lg p-1 -m-1"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onToggleExpand(contact.id)}
                        aria-expanded={expandedContacts[contact.id]}
                        aria-label={expandedContacts[contact.id] ? "Collapse contact details" : "Expand contact details"}
                      >
                        <div className="flex items-center py-1 -ml-2 text-gray-500">
                          {expandedContacts[contact.id] ? (
                            <ChevronDownIcon className="h-5 w-5 text-primary-500" />
                          ) : (
                            <ChevronRightIcon className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="space-y-1">
                            <h3 className="text-xl sm:text-2xl font-semibold text-primary-500 tracking-[-0.01em]">{contact.name}</h3>
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
                          onClick={() => onDelete(contact.id)}
                          disabled={deletingContactId === contact.id}
                          className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${
                            deletingContactId === contact.id
                              ? 'text-gray-400 bg-gray-100'
                              : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={deletingContactId === contact.id ? 'Deleting contact...' : 'Delete contact'}
                        >
                          {deletingContactId === contact.id ? (
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

                    {/* Expanded Content */}
                    {expandedContacts[contact.id] && (
                      <div className="px-4 pb-3 space-y-4 border-t border-gray-100 bg-white/60 backdrop-blur-sm">
                        {/* Contact details section */}
                        <div className="mt-4 space-y-4">
                          {(contact.phone || contact.social_media_handle) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-gray-600/90">
                              {contact.phone && (
                                <div className="flex items-center px-3 py-2.5 bg-gray-50 rounded-lg">
                                  <PhoneIcon className="h-4 w-4 mr-2 text-green-500/90 flex-shrink-0" />
                                  <span className="truncate leading-5 font-[450]">{contact.phone}</span>
                                </div>
                              )}
                              {contact.social_media_handle && (
                                <div className="flex items-center px-3 py-2.5 bg-gray-50 rounded-lg">
                                  <AtSymbolIcon className="h-4 w-4 mr-2 text-pink-500/90 flex-shrink-0" />
                                  <span className="truncate leading-5 font-[450]">{contact.social_media_handle}</span>
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
                                      <span className="text-gray-700 font-medium break-words">
                                        {event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}:&nbsp;
                                      </span>
                                      <span className="text-gray-600 break-words">{formatEventDate(event.date)}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Contact status section */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="bg-gray-50 rounded-lg overflow-hidden">
                              <div className="px-3 py-2 bg-gray-100">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Contacted</span>
                              </div>
                              <div className="px-3 py-2">
                                <span className="text-sm text-gray-700">
                                  {contact.last_contacted ? dayjs(contact.last_contacted).fromNow() : 'Never'}
                                </span>
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg overflow-hidden">
                              <div className="px-3 py-2 bg-gray-100">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Contact Due</span>
                              </div>
                              <div className="px-3 py-2">
                                <span className="text-sm text-gray-700">
                                  {contactsService.formatDueDate(contact.next_contact_due)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Categories/Hashtags section */}
                          {contact.notes && extractHashtags(contact.notes).length > 0 && (
                            <div className="bg-gray-50 rounded-lg overflow-hidden">
                              <div className="px-3 py-2 bg-gray-100">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Categories</span>
                              </div>
                              <div className="px-3 py-2">
                                <div className="flex flex-wrap gap-2">
                                  {extractHashtags(contact.notes).map((tag, idx) => (
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
                          {contact.notes && (
                            <div className="bg-gray-50 rounded-lg overflow-hidden">
                              <div className="px-3 py-2 bg-gray-100">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Personal Notes</span>
                              </div>
                              <div className="px-3 py-2">
                                <span className="text-sm text-gray-700 whitespace-pre-line">{contact.notes}</span>
                              </div>
                            </div>
                          )}

                          {/* AI Suggestions section */}
                          <div className="bg-gray-50 rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-gray-100">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Suggestions</span>
                            </div>
                            <div className="px-3 py-2">
                              {!contact.ai_last_suggestion ? (
                                <div className="flex items-start gap-2">
                                  <span className="flex-1 text-sm text-gray-600/90">
                                    No suggestions available
                                  </span>
                                </div>
                              ) : contact.ai_last_suggestion === 'Upgrade to Premium to get personalised suggestions!' ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">
                                    ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get personalised suggestions!
                                  </span>
                                </div>
                              ) : (
                                <div className="group flex items-start gap-2">
                                  <span className="flex-1 text-sm text-gray-700 whitespace-pre-line">
                                    {contact.ai_last_suggestion.split('\n').slice(0, 5).join('\n')}
                                  </span>
                                  {contact.ai_last_suggestion && (
                                    <button
                                      onClick={() => onReportContent(contact.id, contact.ai_last_suggestion!)}
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
                      </div>
                    )}

                    {/* Action Buttons - Always Visible */}
                    <div className="p-4 border-t border-gray-100/50 bg-white/30">
                      <div className="flex flex-wrap items-center justify-start gap-2 w-full bg-white/60 backdrop-blur-sm">
                        <button
                          onClick={() => onQuickInteraction({ isOpen: true, contactId: contact.id, type: 'call', contactName: contact.name })}
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
                            className="inline-flex items-center justify-center text-center px-3.5 py-2 text-[13px] sm:text-sm font-[500] text-gray-600 bg-gray-100/90 hover:bg-gray-200/90 active:scale-[0.98] rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                            title="Upgrade to view interaction history"
                          >
                            View History
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          </VariableSizeList>
        )}
      </AutoSizer>
    </div>
  );
};

export default VirtualizedContactsList;
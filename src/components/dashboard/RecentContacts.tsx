import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PhoneIcon,
  AtSymbolIcon,
  PencilSquareIcon,
  TrashIcon,
  FlagIcon,
  CakeIcon,
  HeartIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline/esm/index.js';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { contactsService } from '../../services/contacts';
import { contentReportsService } from '../../services/content-reports';
import { useStore } from '../../stores/useStore';
import type { Contact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { getEventTypeDisplay, formatEventDate, sortEventsByType, extractHashtags, formatHashtagForDisplay } from '../../components/contacts/utils';
import dayjs from 'dayjs';
import { lazy, Suspense } from 'react';

const QuickInteraction = lazy(() => import('../contacts/QuickInteraction'));

export const RecentContacts = () => {
  const queryClient = useQueryClient();
  const { isPremium, isOnTrial } = useStore();
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: contactsService.getContacts,
    staleTime: 5 * 60 * 1000
  });

  const { data: importantEvents } = useQuery<ImportantEvent[]>({
    queryKey: ['important-events'],
    queryFn: () => contactsService.getImportantEvents(),
    staleTime: 5 * 60 * 1000
  });

  const [expandedContacts, setExpandedContacts] = useState<Record<string, boolean>>({});

  const toggleContactExpanded = (contactId: string) => {
    setExpandedContacts(prev => ({
      ...prev,
      [contactId]: !prev[contactId]
    }));
  };

  // Map of contact ID to their events
  const eventsMap = importantEvents?.reduce((acc, event) => {
    if (event) {
      const contactId = event.contact_id;
      if (!acc[contactId]) {
        acc[contactId] = [];
      }
      acc[contactId].push(event);
    }
    return acc;
  }, {} as Record<string, ImportantEvent[]>) || {};

  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);

  const handleDeleteContact = async (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        setDeletingContactId(contactId);
        await contactsService.deleteContact(contactId);
        
        // Directly invalidate queries to fetch fresh data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['contacts'],
            exact: true
          }),
          queryClient.invalidateQueries({
            queryKey: ['contactsCount'],
            exact: true
          }),
          queryClient.invalidateQueries({
            queryKey: ['reminders'],
            exact: true
          })
        ]);
      } catch (error) {
        console.error('Error deleting contact:', error);
      } finally {
        setDeletingContactId(null);
      }
    }
  };

  const handleReportContent = async (contactId: string, content: string) => {
    if (confirm('Report this AI suggestion as inappropriate?')) {
      try {
        await contentReportsService.reportContent(content, {
          contactId,
          contentType: 'suggestion'
        });
        alert('Thank you for reporting. We will review this suggestion.');
      } catch (error) {
        console.error('Error reporting content:', error);
        alert('Failed to report content. Please try again.');
      }
    }
  };

  const [quickInteraction, setQuickInteraction] = useState<{
    isOpen: boolean;
    contactId: string;
    contactName: string;
    type: Interaction['type'];
  } | null>(null);

  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Recent Contacts</h2>
          <p className="mt-1 text-sm text-gray-600">
            Your most recently added connections
          </p>
        </div>
        <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
          {!contacts?.length ? (
            <>
              <div className="p-12 text-center">
                <p className="text-[15px] text-gray-600/90">No contacts added yet</p>
              </div>
              <div className="p-6 border-t border-gray-100">
                <Link
                  to="/contacts"
                  className="inline-flex items-center text-primary-500 hover:text-primary-600 font-medium transition-colors"
                >
                  View all contacts
                  <svg className="w-5 h-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                {(contacts || [])
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, isPremium || isOnTrial ? Infinity : 15)
                  .slice(0, 3)
                  .map((contact: Contact) => (
                    <div
                      key={contact.id}
                      className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft hover:shadow-md transition-all duration-200"
                    >
                      {/* Compact Header */}
                      <div className="flex items-center justify-between p-4">
                        {/* Left side: Status indicator and name */}
                        <div
                          onClick={() => toggleContactExpanded(contact.id)}
                          className="flex items-center flex-1 min-w-0 cursor-pointer rounded-lg p-1 -m-1"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && toggleContactExpanded(contact.id)}
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
                            className="inline-flex items-center p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Edit contact"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
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

                      {/* Collapsible Details Section */}
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
                                        onClick={() => handleReportContent(contact.id, contact.ai_last_suggestion!)}
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
                            onClick={() => setQuickInteraction({
                              isOpen: true,
                              contactId: contact.id,
                              contactName: contact.name,
                              type: 'call'
                            })}
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
                  ))}
              </div>
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-gray-100/70">
                <Link
                  to="/contacts"
                  className="inline-flex items-center text-primary-500 hover:text-primary-600 font-[500] transition-colors"
                >
                  View all contacts
                  <svg
                    className="w-5 h-5 ml-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
      {quickInteraction && (
        <Suspense fallback={<div>Loading...</div>}>
          <QuickInteraction
            isOpen={quickInteraction.isOpen}
            onClose={() => setQuickInteraction(null)}
            contactId={quickInteraction.contactId}
            contactName={quickInteraction.contactName}
            defaultType={quickInteraction.type}
            onSuccess={() => queryClient.invalidateQueries({
              queryKey: ['contacts'],
              exact: true
            })}
          />
        </Suspense>
      )}
    </>
  );
};

export default RecentContacts;
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
  StarIcon
} from '@heroicons/react/24/outline/esm/index.js';
import { contactsService } from '../../services/contacts';
import { contentReportsService } from '../../services/content-reports';
import { useStore } from '../../stores/useStore';
import type { Contact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { getEventTypeDisplay, formatEventDate, sortEventsByType } from '../../components/contacts/utils';
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

  const handleDeleteContact = async (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await contactsService.deleteContact(contactId);
        
        // Optimistically update the contacts list
        queryClient.setQueryData(['contacts'], (old: Contact[] | undefined) =>
          old ? old.filter(contact => contact.id !== contactId) : []
        );
        
        // Optimistically update the total count for free users
        if (!isPremium && !isOnTrial) {
          queryClient.setQueryData(['contactsCount'], (old: number | undefined) =>
            old !== undefined ? old - 1 : undefined
          );
        }
        
        // Then trigger background refetch to ensure data consistency
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
        // Refetch on error to restore correct state
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['contacts'],
            exact: true
          }),
          queryClient.invalidateQueries({
            queryKey: ['contactsCount'],
            exact: true
          })
        ]);
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
      } catch (error) {
        console.error('Error reporting content:', error);
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
        <div className="bg-white rounded-xl shadow-soft">
          <div className="p-4 space-y-4">
            {(contacts || [])
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, isPremium || isOnTrial ? Infinity : 15)
              .slice(0, 3)
              .map((contact: Contact) => (
              <div key={contact.id} className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-4 divide-y divide-gray-100">
                  <div className="min-w-0 pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-primary-500">{contact.name}</h3>
                        {/* Inline status indicator */}
                        <div className="flex items-center text-sm text-gray-500">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            contact.relationship_level === 1 ? 'bg-red-400' :
                            contact.relationship_level === 2 ? 'bg-orange-400' :
                            contact.relationship_level === 3 ? 'bg-yellow-400' :
                            contact.relationship_level === 4 ? 'bg-lime-400' :
                            'bg-green-400'
                          }`}></div>
                          {contact.contact_frequency && (
                            <span>{contact.contact_frequency.charAt(0).toUpperCase() + contact.contact_frequency.slice(1)} contact</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Link
                          to={`/contacts/${contact.id}/edit`}
                          className="inline-flex items-center p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit contact"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="inline-flex items-center p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete contact"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      {/* Contact details section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600 mb-4">
                        {contact.phone && (
                          <div className="flex items-center px-3 py-2 bg-gray-50 rounded-lg">
                            <PhoneIcon className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                            <span className="truncate leading-5">{contact.phone}</span>
                          </div>
                        )}
                        {contact.social_media_handle && (
                          <div className="flex items-center px-3 py-2 bg-gray-50 rounded-lg">
                            <AtSymbolIcon className="h-4 w-4 mr-2 text-pink-500 flex-shrink-0" />
                            <span className="truncate leading-5">{contact.social_media_handle}</span>
                          </div>
                        )}
                      </div>

                      {/* Events section */}
                      {(eventsMap[contact.id] || []).length > 0 && (
                        <div className="mb-4 bg-gray-50 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-gray-100">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Important Dates</span>
                          </div>
                          <div className="px-3 py-2">
                            <div className="flex flex-wrap gap-3 text-sm">
                              {sortEventsByType(eventsMap[contact.id] || []).map((event: ImportantEvent, idx: number) => (
                                <span key={idx} className="inline-flex items-center">
                                  {event.type === 'birthday' ? (
                                    <CakeIcon className="h-4 w-4 mr-1.5 text-pink-500 flex-shrink-0" />
                                  ) : event.type === 'anniversary' ? (
                                    <HeartIcon className="h-4 w-4 mr-1.5 text-rose-500 flex-shrink-0" />
                                  ) : (
                                    <StarIcon className="h-4 w-4 mr-1.5 text-purple-500 flex-shrink-0" />
                                  )}
                                  <span className="text-gray-700 font-medium">{event.type === 'custom' ? event.name : getEventTypeDisplay(event.type)}:&nbsp;</span>
                                  <span className="text-gray-600">{formatEventDate(event.date)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Contact status section */}
                      <div className="mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                      {/* AI Suggestions section */}
                      {contact.ai_last_suggestion && (
                        <div className="bg-gray-50 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-gray-100">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Suggestions</span>
                          </div>
                          <div className="px-3 py-2">
                            {contact.ai_last_suggestion === 'Upgrade to premium to get advanced AI suggestions!' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">
                                  ✨ <Link to="/settings" className="text-primary-600 hover:text-primary-500">Upgrade to Premium</Link> to get AI-powered suggestions!
                                </span>
                              </div>
                            ) : (
                              <div className="group flex items-start gap-2">
                                <span className="flex-1 text-sm text-gray-700 whitespace-pre-line">
                                  {contact.ai_last_suggestion.split('\n').slice(0, 5).join('\n')}
                                </span>
                                <button
                                  onClick={() => handleReportContent(contact.id, contact.ai_last_suggestion || '')}
                                  className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
                                  title="Report inappropriate suggestion"
                                >
                                  <FlagIcon className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-3">
                    <div className="flex items-center justify-start gap-2 w-full">
                      <button
                        onClick={() => setQuickInteraction({
                          isOpen: true,
                          contactId: contact.id,
                          contactName: contact.name,
                          type: 'call'
                        })}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg shadow-sm hover:shadow transition-all"
                        title="Log an interaction"
                      >
                        Log Interaction
                      </button>
                      {(isPremium || isOnTrial) ? (
                        <Link
                          to={`/contacts/${contact.id}/interactions`}
                          className="inline-flex items-center justify-center text-center px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg shadow-sm hover:shadow transition-all"
                          title="View interaction history"
                        >
                          View History
                        </Link>
                      ) : (
                        <Link
                          to={`/contacts/${contact.id}/interactions`}
                          className="inline-flex items-center justify-center text-center px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm hover:shadow transition-all"
                          title="Upgrade to view interaction history"
                        >
                          View History
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
          />
        </Suspense>
      )}
    </>
  );
};

export default RecentContacts;
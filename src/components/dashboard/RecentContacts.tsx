import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '../../services/contacts';
import { useStore } from '../../stores/useStore';
import type { Contact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { ContactCard } from '../../components/contacts/ContactCard';

const QuickInteraction = lazy(() => import('../contacts/QuickInteraction'));

export const RecentContacts = () => {
  const queryClient = useQueryClient();
  const { isPremium, isOnTrial } = useStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['recent-contacts'],
    queryFn: contactsService.getRecentContacts,
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
    try {
      await contactsService.deleteContact(contactId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contacts'], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['total-contacts'], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['contactsCount'], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['reminders'], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['total-reminders'], exact: true })
      ]);
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Contacts</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Your most recently added connections
          </p>
        </div>
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark">
          {!contacts?.length ? (
            <>
              <div className="p-12 text-center">
                <p className="text-[15px] text-gray-600/90 dark:text-gray-400">No contacts added yet</p>
              </div>
              <div className="p-6 border-t border-gray-100 dark:border-gray-800">
                <Link
                  to="/contacts"
                  className="inline-flex items-center text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors"
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
                   .map((contact: Contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      eventsMap={eventsMap}
                      isPremium={isPremium}
                      isOnTrial={isOnTrial}
                      onDelete={handleDeleteContact}
                      isExpanded={expandedIds.has(contact.id)}
                      onExpandChange={(expanded) => {
                        setExpandedIds(prev => {
                          const next = new Set(prev);
                          if (expanded) {
                            next.add(contact.id);
                          } else {
                            next.delete(contact.id);
                          }
                          return next;
                        });
                      }}
                      onQuickInteraction={({ contactId, type, contactName }) =>
                        setQuickInteraction({
                          isOpen: true,
                          contactId,
                          type,
                          contactName
                        })}
                    />
                  ))}
              </div>
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-gray-100/70 dark:border-gray-800/70">
                <Link
                  to="/contacts"
                  className="inline-flex items-center text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-[500] transition-colors"
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
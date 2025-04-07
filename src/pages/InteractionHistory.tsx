import { useState, lazy, Suspense, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { SparklesIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { contactsService } from '../services/contacts';
import { ClockIcon, TrashIcon, PencilSquareIcon, ChevronUpDownIcon, ArrowLeftIcon } from '@heroicons/react/24/outline/esm/index.js';
import dayjs from 'dayjs';
import type { Interaction } from '../lib/supabase/types';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

// Lazy load QuickInteraction //
const QuickInteraction = lazy(() => import('../components/contacts/QuickInteraction'));

type SortField = 'date' | 'type' | 'sentiment';
type SortOrder = 'asc' | 'desc';

export const InteractionHistory = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPremium, isOnTrial } = useStore();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingInteraction, setEditingInteraction] = useState<{
    interaction: Interaction;
    isOpen: boolean;
  } | null>(null);
  const [deletingInteractionId, setDeletingInteractionId] = useState<string | null>(null);

  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => contactsService.getContact(contactId!),
    staleTime: 5 * 60 * 1000
  });

  const { data: interactions, isLoading: isLoadingInteractions } = useQuery({
    queryKey: ['interactions', contactId],
    queryFn: () => contactsService.getInteractions(contactId!),
    staleTime: 5 * 60 * 1000
  });

  const handleDeleteInteraction = async (interaction: Interaction) => {
    if (!confirm('Are you sure you want to delete this interaction?')) {
      return;
    }

    try {
      setDeletingInteractionId(interaction.id);
      // Update the contact's last_contacted if we're deleting their most recent interaction
      const allInteractions = interactions || [];
      const isLatestInteraction = !allInteractions.find(
        i => new Date(i.date) > new Date(interaction.date)
      );

      if (isLatestInteraction) {
        const nextLatestInteraction = allInteractions
          .filter(i => i.id !== interaction.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        await contactsService.updateContact(interaction.contact_id, {
          last_contacted: nextLatestInteraction?.date || null
        });
      }

      await contactsService.deleteInteraction(interaction.id);

      // Refetch interactions and contact
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['interactions', contactId],
          exact: true
        }),
        queryClient.invalidateQueries({
          queryKey: ['contact', contactId],
          exact: true
        })
      ]);
    } catch (error) {
      console.error('Error deleting interaction:', error);
    } finally {
      setDeletingInteractionId(null);
    }
  };

  const sortedInteractions = useMemo(() => {
    return [...(interactions || [])].sort((a, b) => {
      if (sortField === 'date') {
        return sortOrder === 'asc'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortField === 'type') {
        return sortOrder === 'asc'
          ? a.type.localeCompare(b.type)
          : b.type.localeCompare(a.type);
      }
      // sentiment
      const sentimentOrder = { positive: 3, neutral: 2, negative: 1, null: 0 };
      const aValue = sentimentOrder[a.sentiment || 'null'];
      const bValue = sentimentOrder[b.sentiment || 'null'];
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [interactions, sortField, sortOrder]);

  const getSentimentColor = useMemo(() => {
    const colorMap = {
      positive: 'bg-green-100 text-green-800',
      negative: 'bg-red-100 text-red-800',
      neutral: 'bg-gray-100 text-gray-800',
      default: 'bg-gray-100 text-gray-600'
    };
    
    return (sentiment: Interaction['sentiment']) => {
      return colorMap[sentiment || 'default'];
    };
  }, []);

  if (isLoadingContact || isLoadingInteractions) {
    return (
      <div className="p-12 text-center">
        <div className="flex flex-col items-center justify-center gap-3 text-primary-500/90">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-base font-medium text-gray-600">Loading interactions...</span>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
        <div className="p-12 text-center">
          <p className="text-[15px] text-gray-600/90">Contact not found</p>
        </div>
      </div>
    );
  }

  if (!isPremium && !isOnTrial) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            Interaction History
          </h1>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="p-3 bg-primary-50/90 rounded-xl mb-4">
              <SparklesIcon className="w-12 h-12 text-primary-500/90" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-2">
              Upgrade to Access Interaction History
            </h2>
            <p className="text-[15px] text-gray-600/90 mb-6 max-w-lg">
              View complete interaction history for each contact to track your relationship progress.
            </p>
            <Link
              to="/settings"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              Upgrade Now
              <ChevronRightIcon className="w-5 h-5 ml-1.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -m-2 text-gray-400 hover:text-gray-500"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
              Interaction History
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-600/90">
              Manage your interactions with <span className="text-primary-500 font-[500]">{contact.name}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditingInteraction({
            isOpen: true,
            interaction: {
              id: '',
              user_id: '',
              contact_id: contactId!,
              type: 'call',
              date: new Date().toISOString(),
              notes: null,
              sentiment: 'neutral',
              created_at: new Date().toISOString()
            }
          })}
          className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200"
        >
          Log New Interaction
        </button>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 hover:border-gray-300 transition-colors appearance-none bg-white text-sm"
                aria-label="Sort interactions by"
              >
                <option value="date">Sort by Date</option>
                <option value="type">Sort by Type</option>
                <option value="sentiment">Sort by Sentiment</option>
              </select>
            </div>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex-shrink-0 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
            >
              <ChevronUpDownIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {sortedInteractions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No interactions recorded yet
            </div>
          ) : (
            sortedInteractions.map((interaction) => (
              <div key={interaction.id} className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-3 sm:p-4 hover:bg-white/70 hover:shadow-md transition-all duration-200">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center capitalize px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {interaction.type}
                      </span>
                      {interaction.sentiment && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getSentimentColor(interaction.sentiment)}`}>
                          {interaction.sentiment}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setEditingInteraction({ interaction, isOpen: true })}
                          className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${
                            deletingInteractionId === interaction.id ? 'invisible' : 'text-gray-500 hover:text-primary-500 hover:bg-primary-50'
                          }`}
                          title={deletingInteractionId === interaction.id ? "Cannot edit while deleting" : "Edit interaction"}
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteInteraction(interaction)}
                          className={`inline-flex items-center p-1.5 rounded-lg transition-colors ${
                            deletingInteractionId === interaction.id ? 'text-gray-400 cursor-pointer pointer-events-none' : 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={deletingInteractionId === interaction.id ? "Deleting interaction..." : "Delete interaction"}
                        >
                          {deletingInteractionId === interaction.id ? (
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
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <ClockIcon className="h-4 w-4 text-gray-400" />
                        {dayjs(interaction.date).format('MMM D, YYYY [at] h:mm A')}
                      </div>
                      {interaction.notes && (
                        <p className="text-sm text-gray-600 whitespace-pre-line">
                          {interaction.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editingInteraction && (
        <Suspense fallback={<div className="fixed inset-0 bg-gray-500/30 flex items-center justify-center">
          <div className="animate-pulse bg-white rounded-lg p-6">Loading...</div>
        </div>}>
          <QuickInteraction
            isOpen={editingInteraction.isOpen}
            onClose={() => setEditingInteraction(null)}
            contactId={contactId!}
            contactName={contact.name}
            defaultType={editingInteraction.interaction.type}
            defaultDate={editingInteraction.interaction.date}
            defaultNotes={editingInteraction.interaction.notes}
            defaultSentiment={editingInteraction.interaction.sentiment}
            interactionId={editingInteraction.interaction.id}
            onSuccess={() => {
              setEditingInteraction(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default InteractionHistory;
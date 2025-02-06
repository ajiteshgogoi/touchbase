import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { SparklesIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { contactsService } from '../services/contacts';
import { ClockIcon, TrashIcon, PencilSquareIcon, ChevronUpDownIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import type { Interaction } from '../lib/supabase/types';
import { QuickInteraction } from '../components/contacts/QuickInteraction';

type SortField = 'date' | 'type' | 'sentiment';
type SortOrder = 'asc' | 'desc';

export const InteractionHistory = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isPremium } = useStore();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [editingInteraction, setEditingInteraction] = useState<{
    interaction: Interaction;
    isOpen: boolean;
  } | null>(null);

  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => contactsService.getContact(contactId!)
  });

  const { data: interactions, isLoading: isLoadingInteractions } = useQuery({
    queryKey: ['interactions', contactId],
    queryFn: () => contactsService.getInteractions(contactId!)
  });

  const handleDeleteInteraction = async (interaction: Interaction) => {
    if (!confirm('Are you sure you want to delete this interaction?')) {
      return;
    }

    try {
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
    }
  };

  const sortedInteractions = [...(interactions || [])].sort((a, b) => {
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

  const getSentimentColor = (sentiment: Interaction['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      case 'neutral':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (isLoadingContact || isLoadingInteractions) {
    return (
      <div className="p-12 text-center text-gray-500">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-12 text-center text-gray-500">
        Contact not found
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/contacts')}
            className="p-2 -m-2 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Interaction History
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center p-8 text-center">
          <SparklesIcon className="w-16 h-16 text-primary-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Upgrade to Access Interaction History
          </h2>
          <p className="text-gray-600 mb-6 max-w-lg">
            View complete interaction history for each contact to track your relationship progress.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-400 transition-colors"
          >
            Upgrade Now
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/contacts')}
            className="p-2 -m-2 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Interaction History
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your interactions with {contact.name}
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
          className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 shadow-soft hover:shadow-lg transition-all"
        >
          Log New Interaction
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-soft">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-wrap gap-3">
            <div className="w-full min-w-[160px] max-w-[180px]">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-200 focus:border-primary-400 focus:ring-primary-400 transition-colors appearance-none bg-white"
              >
                <option value="date">Sort by Date</option>
                <option value="type">Sort by Type</option>
                <option value="sentiment">Sort by Sentiment</option>
              </select>
            </div>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="flex-shrink-0 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
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
              <div key={interaction.id} className="bg-white rounded-lg shadow-soft p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center capitalize px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {interaction.type}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setEditingInteraction({ interaction, isOpen: true })}
                          className="inline-flex items-center p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit interaction"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteInteraction(interaction)}
                          className="inline-flex items-center p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete interaction"
                        >
                          <TrashIcon className="h-4 w-4" />
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
                  {interaction.sentiment && (
                    <div className="sm:text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getSentimentColor(interaction.sentiment)}`}>
                        {interaction.sentiment}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editingInteraction && (
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
            void queryClient.invalidateQueries({
              queryKey: ['interactions', contactId],
              exact: true
            });
          }}
        />
      )}
    </div>
  );
};

export default InteractionHistory;
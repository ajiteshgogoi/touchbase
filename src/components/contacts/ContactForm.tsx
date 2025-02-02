import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsService } from '../../services/contacts';
import { useStore } from '../../stores/useStore';
import type { Contact } from '../../lib/supabase/types';

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  preferred_contact_method: 'email' | 'phone' | 'social' | null;
  notes: string;
  relationship_level: number;
  user_id: string;
  last_contacted: string | null;
  next_contact_due: string | null;
}

const initialFormData: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  preferred_contact_method: null,
  notes: '',
  relationship_level: 1,
  user_id: '',
  last_contacted: null,
  next_contact_due: null,
};

export const ContactForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useStore();
  const [formData, setFormData] = useState<ContactFormData>({
    ...initialFormData,
    user_id: user?.id || '',
  });
  const isEditMode = Boolean(id);

  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactsService.getContact(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone || '',
        preferred_contact_method: contact.preferred_contact_method,
        notes: contact.notes || '',
        relationship_level: contact.relationship_level,
        user_id: contact.user_id,
        last_contacted: contact.last_contacted,
        next_contact_due: contact.next_contact_due,
      });
    }
  }, [contact]);

  useEffect(() => {
    if (user) {
      setFormData(current => ({
        ...current,
        user_id: user.id,
      }));
    }
  }, [user]);

  const createMutation = useMutation({
    mutationFn: (data: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) => 
      contactsService.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate('/contacts');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Contact> }) =>
      contactsService.updateContact(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate('/contacts');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      console.error('No user ID available');
      return;
    }

    try {
      if (isEditMode && id) {
        await updateMutation.mutateAsync({ id, updates: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  if (isEditMode && isLoadingContact) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-gray-500 dark:text-gray-400">Loading contact...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Name *
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Phone
        </label>
        <input
          type="tel"
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
        />
      </div>

      <div>
        <label htmlFor="preferred_contact_method" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Preferred Contact Method
        </label>
        <select
          id="preferred_contact_method"
          value={formData.preferred_contact_method || ''}
          onChange={(e) => setFormData({
            ...formData,
            preferred_contact_method: e.target.value as ContactFormData['preferred_contact_method']
          })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">No preference</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="social">Social Media</option>
        </select>
      </div>

      <div>
        <label htmlFor="relationship_level" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Relationship Level
        </label>
        <input
          type="range"
          id="relationship_level"
          min="1"
          max="5"
          value={formData.relationship_level}
          onChange={(e) => setFormData({ ...formData, relationship_level: parseInt(e.target.value) })}
          className="mt-1 block w-full"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Acquaintance</span>
          <span>Close Friend</span>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          id="notes"
          rows={4}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
        />
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={() => navigate('/contacts')}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

export default ContactForm;
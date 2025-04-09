import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  requiresConfirmation?: boolean;
  actionDetails?: any;
  isError?: boolean;
  timestamp: number;
}

interface ChatContext {
  conversationHistory: Message[];
  currentContactId?: string;
  lastInteractionTime?: number;
}

interface ChatStore {
  contexts: Record<string, ChatContext>;
  currentContext: string;
  setCurrentContext: (contextId: string) => void;
  addMessage: (contextId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  getMessages: (contextId: string) => Message[];
  setCurrentContactId: (contextId: string, contactId: string) => void;
  clearContext: (contextId: string) => void;
  clearAllContexts: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      contexts: {},
      // Debug log for store updates
      _logStoreUpdate: (action: string, data: any) => {
        console.log(`[ChatStore] ${action}:`, data);
        return data;
      },
      currentContext: 'default',
      
      setCurrentContext: (contextId) => {
        set({ currentContext: contextId });
      },

      addMessage: (contextId, message) => {
        set((state) => {
          const existingContext = state.contexts[contextId] || {
            conversationHistory: [],
            lastInteractionTime: undefined,
            currentContactId: undefined,
          };
          
          const newMessage = {
            ...message,
            id: Date.now().toString(),
            timestamp: Date.now(),
          };

          const newState = {
            ...state,
            contexts: {
              ...state.contexts,
              [contextId]: {
                ...existingContext,
                conversationHistory: [...existingContext.conversationHistory, newMessage],
                lastInteractionTime: Date.now(),
              },
            },
          };

          return newState;
        });
      },

      getMessages: (contextId) => {
        return get().contexts[contextId]?.conversationHistory || [];
      },

      setCurrentContactId: (contextId, contactId) => {
        set((state) => {
          const existingContext = state.contexts[contextId] || {
            conversationHistory: [],
            lastInteractionTime: undefined,
            currentContactId: undefined,
          };

          return {
            ...state,
            contexts: {
              ...state.contexts,
              [contextId]: {
                ...existingContext,
                currentContactId: contactId,
              },
            },
          };
        });
      },

      clearContext: (contextId) => {
        set((state) => {
          const { [contextId]: _, ...remainingContexts } = state.contexts;
          return {
            ...state,
            contexts: remainingContexts,
            currentContext: contextId === state.currentContext ? 'default' : state.currentContext,
          };
        });
      },

      clearAllContexts: () => {
        set({ contexts: {}, currentContext: 'default' });
      },
    }),
    {
      name: 'chat-store',
      version: 1,
    }
  )
);
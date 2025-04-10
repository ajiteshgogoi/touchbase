import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Custom middleware to handle user-specific storage
const userStorage = (userId: string) => {
  const prefix = `chat-store-${userId}`;
  return {
    getItem: (name: string) => {
      const value = localStorage.getItem(`${prefix}-${name}`);
      return value ? JSON.parse(value) : null;
    },
    setItem: (name: string, value: any) => {
      localStorage.setItem(`${prefix}-${name}`, JSON.stringify(value));
    },
    removeItem: (name: string) => {
      localStorage.removeItem(`${prefix}-${name}`);
    },
  };
};

export interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  requiresConfirmation?: boolean;
  actionDetails?: any;
  isError?: boolean;
  timestamp: number;
  confirmed?: boolean;
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
  _cleanMessages: (messages: Message[], limit?: number) => Message[];
  _cleanTimeBasedContext: (contextId: string) => boolean;
}

// Helper to get current user ID synchronously from localStorage
const getCurrentUserId = () => {
  const session = localStorage.getItem('sb-session');
  if (!session) return 'anonymous';
  try {
    const { user } = JSON.parse(session);
    return user?.id || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      contexts: {},
      
      // Helper function to clean old messages
      _cleanMessages: (messages: Message[], limit: number = 10) => {
        return messages.slice(-Math.min(messages.length, limit));
      },

      // Helper function to check and clean time-based context
      _cleanTimeBasedContext: (contextId: string) => {
        const state = get();
        const context = state.contexts[contextId];
        if (context?.lastInteractionTime) {
          // Clear context if last interaction was > 30 minutes ago
          if (Date.now() - context.lastInteractionTime > 30 * 60 * 1000) {
            set((state) => {
              const { [contextId]: _, ...remainingContexts } = state.contexts;
              return {
                ...state,
                contexts: remainingContexts,
                currentContext: contextId === state.currentContext ? 'default' : state.currentContext,
              };
            });
            return true;
          }
        }
        return false;
      },
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
        const store = get();
        
        // Check and clean time-based context first
        if (store._cleanTimeBasedContext(contextId)) {
          // If context was cleaned, create new one
          const newMessage = {
            ...message,
            id: Date.now().toString(),
            timestamp: Date.now(),
          };
          
          set({
            contexts: {
              [contextId]: {
                conversationHistory: [newMessage],
                lastInteractionTime: Date.now(),
                currentContactId: undefined,
              }
            }
          });
          return;
        }

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

          // Limit to last 10 messages
          const updatedHistory = store._cleanMessages([...existingContext.conversationHistory, newMessage]);

          return {
            ...state,
            contexts: {
              ...state.contexts,
              [contextId]: {
                ...existingContext,
                conversationHistory: updatedHistory,
                lastInteractionTime: Date.now(),
              },
            },
          };
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
          const context = state.contexts[contextId];
          if (!context) return state;

          // Keep only last 4 messages after clearing
          const lastMessages = get()._cleanMessages(context.conversationHistory, 4);
          
          return {
            ...state,
            contexts: {
              ...state.contexts,
              [contextId]: {
                ...context,
                conversationHistory: lastMessages,
                lastInteractionTime: Date.now(),
              },
            },
          };
        });
      },

      clearAllContexts: () => {
        set({ contexts: {}, currentContext: 'default' });
      },
    }),
    {
      name: 'state',
      version: 1,
      storage: createJSONStorage(() => userStorage(getCurrentUserId()))
    }
  )
);
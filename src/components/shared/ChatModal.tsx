import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useStore } from '../../stores/useStore';
import { useChatStore, type Message } from '../../stores/chatStore';
import { supabase } from '../../lib/supabase/client';
import { PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { Dialog, Transition } from '@headlessui/react';

// Define API response type (matching backend)
interface ChatResponse {
  reply?: string;
  confirmation_required?: boolean;
  message?: string;
  action_details?: any;
  error?: string;
}

// Define API request type (matching backend)
interface ChatRequest {
  message?: string; // Optional for confirmation requests
  context?: {
    contactId?: string;
    previousMessages?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
  };
  confirmation?: {
    confirm: boolean;
    action_details: any;
  };
}

// API function to call the backend Edge Function
const callChatHandler = async (payload: ChatRequest): Promise<ChatResponse> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('llm-chat-handler', {
    body: payload,
    headers: {
      'Authorization': `Bearer ${sessionData.session.access_token}`
    }
  });

  if (response.error) {
    // Try to parse Supabase Edge Function error response
    let errorMessage = response.error.message;
    try {
        const errorJson = JSON.parse(response.error.context || '{}');
        if (errorJson.error) {
            errorMessage = errorJson.error;
        }
    } catch (e) { /* Ignore parsing error */ }
    throw new Error(errorMessage || 'Failed to call chat handler');
  }

  return response.data as ChatResponse;
};
export const ChatModal: React.FC = () => {
  const { isChatOpen, closeChat } = useStore();
  const { currentContext, getMessages, addMessage: addStoreMessage } = useChatStore();
  const [input, setInput] = useState('');
  const [confirmedAction, setConfirmedAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const greetingSentRef = useRef(false);

  // React Query Mutation for sending messages/confirmations
  const mutation = useMutation<ChatResponse, Error, ChatRequest>({
    mutationFn: callChatHandler,
    onSuccess: (data) => {
      // Add AI response or confirmation message to chat
      if (data.error) {
         addMessage('system', `Error: ${data.error}`, true);
      } else if (data.confirmation_required && data.message && data.action_details) {
        addMessage('ai', data.message, false, true, data.action_details); // Mark as requiring confirmation
      } else if (data.reply) {
        addMessage('ai', data.reply);
      }
    },
    onError: (error) => {
      addMessage('system', `Error: ${error.message}`, true);
    },
  });

  // Helper to add messages
  const addMessage = (
      sender: 'user' | 'ai' | 'system',
      text: string,
      isError: boolean = false,
      requiresConfirmation: boolean = false,
      actionDetails?: any
    ) => {
    addStoreMessage(currentContext, {
      sender,
      text,
      isError,
      requiresConfirmation,
      actionDetails
    });
  };
// Handle scroll locking when modal opens
useLayoutEffect(() => {
  if (isChatOpen) {
    // Calculate scrollbar width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
    
    // Add modal-open class to body
    document.body.classList.add('modal-open');
  } else {
    // Remove modal-open class and reset scrollbar width
    document.body.classList.remove('modal-open');
    document.documentElement.style.setProperty('--scrollbar-width', '0px');
  }

  return () => {
    // Cleanup
    document.body.classList.remove('modal-open');
    document.documentElement.style.setProperty('--scrollbar-width', '0px');
  };
}, [isChatOpen]);

// Scroll to bottom when messages change or modal opens
useEffect(() => {
  if (messagesContainerRef.current) {
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }
}, [getMessages(currentContext), isChatOpen]);


  // Focus input and set initial scroll position when modal opens
  useEffect(() => {
    if (isChatOpen && messagesContainerRef.current) {
      // Add a small delay to ensure elements are rendered
      setTimeout(() => {
        inputRef.current?.focus();
        // Set initial scroll position to bottom
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
      
      // Check if we need to send a greeting
      const messages = getMessages(currentContext);
      console.log('Initial messages:', messages);
      
      if (messages.length === 0 && !greetingSentRef.current) {
        console.log('Sending initial greeting');
        greetingSentRef.current = true;
        // Store initial context message
        addMessage('system', 'Chat session started');
        addMessage('ai', "Hi! How can I help you manage your contacts today?");
      }
    } else {
      console.log('Resetting chat input');
      setInput('');
      greetingSentRef.current = false; // Reset for next open
      setConfirmedAction(null); // Reset confirmed action when chat closes
    }
  }, [isChatOpen, currentContext]); // Only depend on isChatOpen and currentContext

  const handleSend = () => {
    if (input.trim() === '' || mutation.isPending) return;
    const userMessage = input;
    addMessage('user', userMessage);
    setInput('');

    const currentMessages = getMessages(currentContext);
    console.log('Current context:', currentContext);
    console.log('Current messages:', currentMessages);
    
    // Ensure we have the context in a format the LLM expects
    // Properly map message roles for the LLM
    const previousMessages = currentMessages.map((m: Message) => {
      let role: 'user' | 'assistant' | 'system';
      if (m.sender === 'ai') {
        role = 'assistant';
      } else if (m.sender === 'user') {
        role = 'user';
      } else {
        role = 'system';
      }
      return {
        role,
        content: m.text
      };
    });
    console.log('Formatted messages:', previousMessages);
    
    const currentContactId = useChatStore.getState().contexts[currentContext]?.currentContactId;
    console.log('Current contact ID:', currentContactId);
    
    const payload: ChatRequest = {
      message: userMessage,
      context: {
        previousMessages: previousMessages,
        contactId: currentContactId
      }
    };
    console.log('Sending payload:', payload);
    mutation.mutate(payload);
  };

  const handleConfirm = (actionDetails: any, confirm: boolean) => {
    if (mutation.isPending || confirmedAction === actionDetails) return;
    
    setConfirmedAction(actionDetails);

    const payload: ChatRequest = {
      confirmation: {
        confirm: confirm,
        action_details: actionDetails
      }
    };

    if (confirm) {
      // For confirmed actions, clear context (keeps last 4 messages)
      useChatStore.getState().clearContext(currentContext);
    } else {
      // For cancelled actions, just remove the confirmation prompt
      const currentMessages = getMessages(currentContext);
      const filteredMessages = currentMessages.filter((msg: Message) => msg.actionDetails !== actionDetails);
      useChatStore.setState(state => ({
        ...state,
        contexts: {
          ...state.contexts,
          [currentContext]: {
            ...state.contexts[currentContext],
            conversationHistory: filteredMessages
          }
        }
      }));
    }

    // Add status message and send confirmation
    addMessage('system', confirm ? 'Processing action...' : 'Action cancelled');
    mutation.mutate(payload);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent newline
      handleSend();
    }
  };

  return (
    <Transition show={isChatOpen} as={React.Fragment}>
      <Dialog onClose={closeChat} className="fixed inset-0 z-[60]">
        <div className="min-h-full flex items-end justify-center p-4 sm:items-center sm:p-0">
        {/* Background overlay */}
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500/50 dark:bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeChat}></div>
        </Transition.Child>

        {/* Modal panel */}
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          enterTo="opacity-100 translate-y-0 sm:scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 translate-y-0 sm:scale-100"
          leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        >
          <div className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-gray-200 dark:border-gray-700 flex flex-col h-[70vh] max-h-[600px]">
             {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100/75 dark:border-gray-800/75">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white inline-flex items-center">
                 <img src="/icon.svg" alt="heart" className="h-8 w-8 mr-2 text-primary-500" loading="eager" />
                 TouchBase Assistant
              </h3>
              <button
                onClick={closeChat}
                className="p-2 -m-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Message List */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50">
              {getMessages(currentContext).map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                     {/* Bubble */}
                     <div className={`px-4 py-2 rounded-2xl ${
                        msg.sender === 'user' ? 'bg-primary-500 text-white rounded-br-none' :
                        msg.sender === 'ai' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-600' :
                        msg.isError ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-bl-none border border-red-200 dark:border-red-700' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-bl-none border border-gray-200 dark:border-gray-600'
                     }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        {/* Confirmation Buttons */}
                        {msg.requiresConfirmation && msg.actionDetails && confirmedAction !== msg.actionDetails && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleConfirm(msg.actionDetails, true)}
                              disabled={mutation.isPending}
                              className="px-3 py-1 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleConfirm(msg.actionDetails, false)}
                              disabled={mutation.isPending}
                              className="px-3 py-1 text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              ))}
              {/* Loading Indicator */}
              {mutation.isPending && (
                 <div className="flex justify-start">
                    <div className="flex items-start max-w-[80%]">
                       <div className="px-4 py-2 rounded-2xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-600">
                          <div className="flex space-x-1 items-center">
                             <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                             <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                             <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
                          </div>
                       </div>
                    </div>
                 </div>
              )}
              <div ref={messagesEndRef} /> {/* Anchor for scrolling */}
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100/75 dark:border-gray-800/75 bg-gray-50/80 dark:bg-gray-800/80 rounded-b-2xl">
              <div className="flex items-center space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me to log interactions, set reminders..."
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  disabled={mutation.isPending}
                />
                <button
                  onClick={handleSend}
                  disabled={input.trim() === '' || mutation.isPending}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-primary-500 dark:bg-primary-600 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-700 disabled:opacity-50 transition-all duration-200 shadow-sm dark:shadow-soft-dark"
                >
                  <div className="flex items-center">
                    <PaperAirplaneIcon className="h-5 w-5" />
                    <span className="sr-only">Send</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};
// src/components/shared/ChatFAB.tsx
import { ChatBubbleOvalLeftEllipsisIcon } from '@heroicons/react/24/solid'; // Using solid icon for FAB
import { useStore } from '../../stores/useStore';

export const ChatFAB = () => {
  const { openChat, isPremium, isOnTrial } = useStore();

  // Only show the FAB for premium or trial users
  if (!isPremium && !isOnTrial) {
    return null;
  }

  return (
    <button
      onClick={openChat}
      className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full shadow-lg hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-100"
      aria-label="Open Assistant"
      title="Open TouchBase Assistant"
    >
      <ChatBubbleOvalLeftEllipsisIcon className="h-7 w-7" />
    </button>
  );
};
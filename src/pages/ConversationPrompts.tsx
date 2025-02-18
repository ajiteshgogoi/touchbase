import React, { useState } from 'react';
import { useStore } from '../stores/useStore';
import { ConversationPromptGenerator } from '../services/conversation-prompt-generator';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const ConversationPrompts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFirstQuestion, setIsFirstQuestion] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [questionReceived, setQuestionReceived] = useState(false);
  const { user } = useStore();

  const generateQuestion = async () => {
    if (!user) {
      setError('Please sign in to generate conversation prompts.');
      return;
    }

    setError(null);
    setQuestionReceived(false);
    setIsAnimating(true);
    setLoading(true);

    // Fade out current question with slight delay
    await new Promise(resolve => setTimeout(resolve, 150));
    setQuestion(null);

    try {
      if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      const promptGenerator = new ConversationPromptGenerator(
        import.meta.env.VITE_SUPABASE_URL!,
        import.meta.env.VITE_SUPABASE_ANON_KEY!,
        import.meta.env.VITE_GROQ_API_KEY!
      );

      const result = await promptGenerator.generatePrompt(user.id);
      
      // Set question immediately but keep loading state
      setQuestion(result.question);
      setIsFirstQuestion(false);
      setQuestionReceived(true);

      // Keep loading state with slight overlap
      await new Promise(resolve => setTimeout(resolve, 150));
      setLoading(false);

      // Allow animation to complete before removing animating state
      await new Promise(resolve => setTimeout(resolve, 200));
      setIsAnimating(false);
    } catch (err: any) {
      console.error('Error generating question:', err);
      setIsAnimating(false);
      setLoading(false);
      setQuestionReceived(false);
      setError(err.message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center space-y-6 w-full max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent pb-2">
            💭 Conversation Prompts
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Meaningful prompts for heartfelt conversations.
          </p>
        </div>

        <div className="w-full">
          <div className="relative bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg w-full min-h-[200px] flex items-center justify-center">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30 blur opacity-40"></div>
            <div className="absolute inset-[2px] rounded-lg bg-white dark:bg-gray-800"></div>
            <div className="relative z-10 -mt-2 h-full w-full overflow-y-auto flex items-center justify-center">
              {loading && !questionReceived ? (
                <div className="flex flex-col items-center space-y-2">
                  <LoadingSpinner />
                  <p className="text-sky-600 dark:text-sky-400">
                    Generating question...
                  </p>
                </div>
              ) : error ? (
                <p className="text-red-500 dark:text-red-400">{error}</p>
              ) : (
                <p className={`text-xl font-medium text-gray-800 dark:text-gray-200 transition-opacity duration-200 ${
                  isAnimating ? 'opacity-0' : 'opacity-100'
                }`}>
                  {isFirstQuestion ? "Click 'Generate a Question' to get a prompt..." : question}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="w-full text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            <span className="underline">Note:</span> You're limited to 5 question generations every 10 minutes.
          </p>
        </div>

        <div className="flex flex-col items-center">
          <button
            onClick={generateQuestion}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-300 dark:focus:ring-sky-700 text-xl hover:-translate-y-0.5 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            Generate a Question
          </button>
        </div>

        <div className="w-full border-t border-gray-200 dark:border-gray-700 mt-8 pt-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            How to Use
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p>
              These conversation prompts are designed to spark meaningful discussions and help you:
            </p>
            <ul>
              <li>Deepen your relationships with friends and family</li>
              <li>Learn new things about the people in your life</li>
              <li>Have more engaging and memorable conversations</li>
              <li>Share stories and experiences that matter</li>
            </ul>
            <p>
              Click the "Generate a Question" button to get a thoughtful conversation starter. Each prompt is carefully crafted to encourage sharing and meaningful dialogue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationPrompts;
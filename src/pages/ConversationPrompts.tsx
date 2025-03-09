import React, { useState, useEffect } from 'react';
import { ChatBubbleOvalLeftEllipsisIcon, FlagIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/useStore';
import { ConversationPromptGenerator } from '../services/conversation-prompt-generator';
import { contentReportsService } from '../services/content-reports';

const ConversationPrompts: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFirstQuestion, setIsFirstQuestion] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [questionReceived, setQuestionReceived] = useState(false);
  const { user } = useStore();

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const handleReportContent = async (question: string) => {
    if (confirm('Report this AI generated question as inappropriate?')) {
      try {
        await contentReportsService.reportContent(question, {
          contentType: 'conversation-prompt'
        });
        alert('Thank you for reporting. We will review this question.');
      } catch (error) {
        console.error('Error reporting content:', error);
        alert('Failed to report content. Please try again.');
      }
    }
  };

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
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center justify-center w-full mb-8 relative">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200 absolute left-0"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent py-3 leading-tight flex flex-col sm:flex-row items-center">
              <ChatBubbleOvalLeftEllipsisIcon className="h-11 w-11 mb-3 sm:mb-0 sm:mr-2 text-primary-500" style={{ marginTop: '0.1em' }} />
              Conversation Prompts
            </h1>
            <p className="mt-1.5 text-[15px] text-gray-600/90">
              Meaningful prompts for heartfelt conversations.
            </p>
          </div>
        </div>

        <div className="w-full mb-8">
          <div className="relative">
            <div className="bg-white/60 backdrop-blur-xl rounded-xl shadow-soft border border-gray-100/50 hover:bg-white/70 p-8 w-full min-h-[200px] flex items-center justify-center transition-all duration-200">
              <div className="relative z-10 w-full sm:w-[32rem] flex items-center justify-center px-4">
                {loading && !questionReceived ? (
                  <div className="flex items-center justify-center max-w-xl mx-auto">
                    <p className="text-sky-600 text-center animate-pulse text-sm sm:text-base">
                      Generating question...
                    </p>
                  </div>
                ) : error ? (
                  <div className="max-w-xl mx-auto w-full text-center">
                    <p className="text-red-500 text-sm sm:text-base text-center">{error}</p>
                  </div>
                ) : (
                  <div className="max-w-xl mx-auto w-full">
                    <p className={`text-base sm:text-lg font-medium text-primary-700 text-center transition-opacity duration-200 leading-relaxed ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
                      {isFirstQuestion ? "Click 'Generate a Question' to get a prompt..." : question}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {!isFirstQuestion && question && (
              <button
                onClick={() => handleReportContent(question)}
                className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-400 transition-colors"
                title="Report inappropriate question"
              >
                <FlagIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="w-full text-center text-xs text-gray-500 mb-8">
          <p>
            <span className="underline">Note:</span> You're limited to 5 question generations every 10 minutes.
          </p>
        </div>

        <div className="flex flex-col items-center">
          <button
            onClick={generateQuestion}
            className="w-full px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            disabled={loading}
          >
            Generate a Question
          </button>
        </div>

        <div className="w-full border-t border-gray-200 mt-12">
          <div className="max-w-2xl mx-auto pt-8">
            <h2 className="text-2xl font-[600] text-gray-900/90 mb-6">How to Use</h2>
            <div className="space-y-8">
              <div>
                <p className="text-[15px] leading-relaxed text-gray-600/90 mb-4">
                  These conversation prompts are designed to spark meaningful discussions and help you:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start text-[15px] text-gray-700/90">
                    <span className="inline-block w-2 h-2 bg-primary-500/90 rounded-full mt-2 mr-3 shrink-0"></span>
                    <span>Deepen your relationships with friends and family</span>
                  </li>
                  <li className="flex items-start text-[15px] text-gray-700/90">
                    <span className="inline-block w-2 h-2 bg-primary-500/90 rounded-full mt-2 mr-3 shrink-0"></span>
                    <span>Learn new things about the people in your life</span>
                  </li>
                  <li className="flex items-start text-[15px] text-gray-700/90">
                    <span className="inline-block w-2 h-2 bg-primary-500/90 rounded-full mt-2 mr-3 shrink-0"></span>
                    <span>Have more engaging and memorable conversations</span>
                  </li>
                  <li className="flex items-start text-[15px] text-gray-700/90">
                    <span className="inline-block w-2 h-2 bg-primary-500/90 rounded-full mt-2 mr-3 shrink-0"></span>
                    <span>Share stories and experiences that matter</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4 text-[15px] leading-relaxed text-gray-600/90">
                <p>
                  Click the <span className="text-primary-600 font-[500]">Generate a Question</span> button to get a thoughtful conversation starter.
                </p>
                <p>
                  Each prompt is carefully crafted to encourage sharing and meaningful dialogue.
                </p>
                <div className="bg-primary-50/90 backdrop-blur-sm p-4 rounded-xl border border-primary-100/50 shadow-sm text-gray-600">
                  <p className="text-[15px] leading-relaxed">
                    <strong className="text-primary-700">Note:</strong> Conversation prompts are generated independently and do not use your contacts' information or interaction history. They are designed to be universal conversation starters that can be used with anyone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationPrompts;
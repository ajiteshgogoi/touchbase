import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics';
import { useStore } from '../stores/useStore';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs/esm';
import relativeTime from 'dayjs/esm/plugin/relativeTime';
// Import only needed icons
import ChartPieIcon from '@heroicons/react/24/outline/ChartPieIcon';
import ChevronRightIcon from '@heroicons/react/24/outline/ChevronRightIcon';
import SparklesIcon from '@heroicons/react/24/outline/SparklesIcon';
import ArrowPathIcon from '@heroicons/react/24/outline/ArrowPathIcon';
import ArrowLeftIcon from '@heroicons/react/24/outline/ArrowLeftIcon';
import ChartBarIcon from '@heroicons/react/24/outline/ChartBarIcon';

dayjs.extend(relativeTime);

// Import optimized components
import { HeatmapChart } from '../components/analytics/HeatmapChart';
import { ProgressMetric } from '../components/analytics/ProgressMetric';

export const Analytics = () => {
  const navigate = useNavigate();
  const { isPremium, isOnTrial, isLoading } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: analyticsService.getLastAnalytics,
    enabled: !isLoading, // Only run query after initialization
  });

  const handleGenerateAnalytics = useCallback(async () => {
    if (!isPremium && !isOnTrial) return;
    setIsGenerating(true);
    try {
      await analyticsService.generateAnalytics();
      await refetchAnalytics();
    } catch (error) {
      console.error('Error generating analytics:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [isPremium, isOnTrial, refetchAnalytics]);

  const canGenerate = useMemo(() => {
    if (!analytics) return true;
    return dayjs().isAfter(dayjs(analytics.nextGenerationAllowed));
  }, [analytics]);

  const formatAnalysis = (text: string): { title: string; content: string }[] => {
    if (!text) return [];

    // Remove the introductory line
    const cleanedText = text.replace(/^Here's an analysis of .+\n/, '');

    // Split into sections and format each
    const sections = cleanedText.split(/\d+\.\s+\*\*([^:]+):\*\*/);
    sections.shift(); // Remove empty first element
    
    const formattedSections = [];
    for (let i = 0; i < sections.length; i += 2) {
      const sectionTitle = sections[i];
      const sectionContent = sections[i + 1];
      
      if (sectionTitle && sectionContent) {
        formattedSections.push({
          title: sectionTitle.trim(),
          content: sectionContent
            .trim()
            // Format bullet points
            .replace(/^\s*\*\s+\*\*([^:]+):\*\*/gm, '• $1:')
            .replace(/^\s*\*\s+/gm, '• ')
            // Clean up remaining markdown
            .replace(/\*\*/g, '')
        });
      }
    }
    
    return formattedSections;
  };

  const renderContactTopics = useCallback(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {analytics?.contactTopics.map(contact => (
        <div
          key={contact.contactId}
          className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft p-4 hover:bg-white/70 hover:shadow-md transition-all duration-200"
        >
          <div className="flex flex-col">
            <Link
              to={`/contacts#${contact.contactId}`}
              className="block text-xl font-semibold text-primary-500 tracking-[-0.01em] mb-3 hover:text-primary-600 transition-colors"
            >
              {contact.contactName}
            </Link>
            {contact.aiAnalysis ? (
              <div className="space-y-4">
                {formatAnalysis(contact.aiAnalysis).map((section, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100">
                      <span className="text-xs font-[500] text-gray-500/90 uppercase tracking-wider">
                        {section.title}
                      </span>
                    </div>
                    <div className="px-3 py-2">
                      <div className="text-[15px] text-gray-700/90 leading-relaxed">
                        {section.content.split('\n').map((line, i) => (
                          <div key={i} className="py-0.5">{line}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="px-3 py-2">
                  <div className="text-[15px] text-gray-600/90">
                    Analysis not available
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  ), [analytics?.contactTopics]);

  if (!isPremium && !isOnTrial) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            Relationship Analytics (beta)
          </h1>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="p-3 bg-primary-50/90 rounded-xl mb-4">
              <SparklesIcon className="w-12 h-12 text-primary-500/90" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-2">
              Upgrade to Access Analytics
            </h2>
            <p className="text-[15px] text-gray-600/90 mb-6 max-w-lg">
            Discover the story behind your relationships. See who you've been missing, 
            and get thoughtful suggestions to nurture the bonds that matter most.
            </p>
            <Link
              to="/settings"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-[15px] font-[500] text-white bg-primary-500 hover:bg-primary-600 shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200 min-w-[140px]"
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                Relationship Analytics (beta)
              </h1>
              <p className="mt-1.5 text-[15px] text-gray-600/90">
                Deeper understanding of your connections and interaction patterns
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={handleGenerateAnalytics}
            disabled={!canGenerate || isGenerating}
            className={`inline-flex items-center justify-center w-full sm:w-auto px-5 py-3 rounded-xl text-[15px] font-[500] text-white shadow-soft hover:shadow-lg active:scale-[0.98] transition-all duration-200 min-w-[225px] ${
              canGenerate && !isGenerating
                ? 'bg-primary-500 hover:bg-primary-600'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="inline-flex items-center justify-center">
              {isGenerating ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ChartBarIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                  Generate New Analysis
                </>
              )}
            </span>
          </button>
          {analytics && !canGenerate && (
            <p className="text-[15px] text-primary-500 font-[500] text-center sm:text-right">
              Next analysis available {dayjs(analytics.nextGenerationAllowed).fromNow()}
            </p>
          )}
        </div>
      </div>

      {!analytics?.hasEnoughData ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="p-3 bg-gray-50/90 rounded-xl mb-4">
              <ChartPieIcon className="w-12 h-12 text-gray-400/90" />
            </div>
            <h3 className="text-xl font-[600] text-gray-900 mb-2">
              Not Enough Data Yet
            </h3>
            <p className="text-[15px] text-gray-600/90">
              Add more contacts and log your interactions regularly to generate detailed analysis.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
            <div className="p-6">
              <h3 className="text-xl font-[600] text-gray-900 mb-4">
                Interaction History
              </h3>
              {analytics?.interactionHeatmap && (
                <HeatmapChart data={analytics.interactionHeatmap} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
              <div className="p-6">
                <h3 className="text-xl font-[600] text-gray-900 mb-4">
                  Top Engaged Contacts
                </h3>
                <div className="space-y-4">
                  {analytics?.topEngaged.map(contact => (
                    <div key={contact.contactId} className="flex items-center justify-between">
                      <div>
                        <Link
                          to={`/contacts#${contact.contactId}`}
                          className="font-[600] text-primary-500 hover:text-primary-600 transition-colors"
                        >
                          {contact.contactName}
                        </Link>
                        <p className="text-[15px] text-gray-600/90">
                          {contact.interactionCount} interactions
                          {contact.lastInteraction && ` • Last: ${dayjs(contact.lastInteraction).fromNow()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] text-gray-600/90">
                          Avg. every{' '}
                          <span className="font-[600] text-gray-900">
                            {contact.averageFrequency}
                          </span>{' '}
                          days
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft">
              <div className="p-6">
                <h3 className="text-xl font-[600] text-gray-900 mb-4">
                  Recent Progress ({analytics?.recentProgress.period})
                </h3>
                <div className="space-y-4">
                  {analytics?.recentProgress && (
                    <>
                      <ProgressMetric
                        label="Engaged Contacts"
                        value={analytics.recentProgress.engagedContacts}
                        total={analytics.recentProgress.engagedContacts + analytics.recentProgress.neglectedContacts}
                      />
                      <div className="flex justify-between text-[15px] text-gray-600/90">
                        <span>Total Interactions: {analytics.recentProgress.totalInteractions}</span>
                        <span>{analytics.recentProgress.neglectedContacts} contacts need attention</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-xl border border-gray-100/50 shadow-soft md:col-span-2">
              <div className="p-6">
                <h3 className="text-xl font-[600] text-gray-900 mb-4">
                  Relationship Insights
                </h3>
                {renderContactTopics()}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};
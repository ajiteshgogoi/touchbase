import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics';
import { contentReportsService } from '../services/content-reports';
import { useStore } from '../stores/useStore';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs/esm';
import relativeTime from 'dayjs/esm/plugin/relativeTime';
// Import components
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

// Import only needed icons
import ChartPieIcon from '@heroicons/react/24/outline/ChartPieIcon';
import ChevronRightIcon from '@heroicons/react/24/outline/ChevronRightIcon';
import SparklesIcon from '@heroicons/react/24/outline/SparklesIcon';
import ArrowLeftIcon from '@heroicons/react/24/outline/ArrowLeftIcon';
import ChartBarIcon from '@heroicons/react/24/outline/ChartBarIcon';
import FlagIcon from '@heroicons/react/24/outline/FlagIcon';

dayjs.extend(relativeTime);

// Import optimized components
import { HeatmapChart } from '../components/analytics/HeatmapChart';
import { ProgressMetric } from '../components/analytics/ProgressMetric';
import { NeglectedContactsList } from '../components/analytics/NeglectedContactsList';

export const Analytics = () => {
  const navigate = useNavigate();
  const { isPremium, isOnTrial, isLoading } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get existing analytics if any
  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: analyticsService.getLastAnalytics,
    enabled: !isLoading, // Only run query after initialization
  });

  // Always check if we have enough data for analysis
  const { data: hasEnoughDataForAnalysis } = useQuery({
    queryKey: ['hasEnoughDataForAnalysis'],
    queryFn: analyticsService.checkHasEnoughData,
    enabled: !isLoading,
    // Don't cache this query so we always get fresh data
    gcTime: 0,
    staleTime: 0
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
    // Wait for both queries to complete before enabling
    if (hasEnoughDataForAnalysis === undefined) return false;
    
    // Must have enough data as base requirement
    if (!hasEnoughDataForAnalysis) return false;

    // If analytics is still loading, keep disabled
    if (analytics === undefined) return false;
    
    // If no previous analytics, allow generation
    if (!analytics) return true;

    // Check if enough time has passed since last generation
    return dayjs().isAfter(dayjs(analytics.nextGenerationAllowed));
  }, [analytics, hasEnoughDataForAnalysis]);

  const handleReportContent = async (contactId: string, content: string) => {
    if (confirm('Report this AI insight as inappropriate?')) {
      try {
        await contentReportsService.reportContent(content, {
          contactId,
          contentType: 'suggestion'
        });
        alert('Thank you for reporting. We will review this insight.');
      } catch (error) {
        console.error('Error reporting content:', error);
        alert('Failed to report content. Please try again.');
      }
    }
  };

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
              to={`/contacts?search=${encodeURIComponent(contact.contactName)}`}
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
                      <div className="group flex items-start gap-2">
                        <div className="flex-1 text-[15px] text-gray-700/90 leading-relaxed">
                          {section.content.split('\n').map((line, i) => (
                            <div key={i} className="py-0.5">{line}</div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleReportContent(contact.contactId, section.content)}
                          className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
                          title="Report inappropriate insight"
                        >
                          <FlagIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <div className="px-3 py-2">
                  <div className="text-[15px] text-gray-600/90">
                    Insights not available
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
            className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/10 rounded-xl transition-all duration-200"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent leading-tight pb-1">
            Relationship Insights
          </h1>
        </div>

        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark">
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="p-3 bg-primary-50/90 dark:bg-primary-900/30 rounded-xl mb-4">
              <SparklesIcon className="w-12 h-12 text-primary-500/90 dark:text-primary-400/90" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent mb-2">
              Upgrade to Access Insights
            </h2>
            <p className="text-[15px] text-gray-600/90 dark:text-gray-400 mb-6 max-w-lg">
            Discover the story behind your relationships. See who you've been missing, 
            and get helpful insights to nurture the bonds that matter most.
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
    <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2.5 -m-2.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50/70 rounded-xl transition-all duration-200"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent leading-tight pb-1">
                Relationship Insights
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
                  <div className="h-4 w-4 mr-2 flex items-center justify-center">
                    <div className="transform scale-50 -m-2">
                      <LoadingSpinner />
                    </div>
                  </div>
                  Generating...
                </>
              ) : (
                <>
                  <ChartBarIcon className="h-5 w-5 mr-2 flex-shrink-0" />
                  Generate New Insights
                </>
              )}
            </span>
          </button>
          {analytics && !canGenerate && (
            <p className="text-[15px] text-primary-500 font-[500] text-center sm:text-right">
              New insights available {dayjs(analytics.nextGenerationAllowed).fromNow()}
            </p>
          )}
        </div>
      </div>

      {!analytics?.hasEnoughData ? (
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark">
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="p-3 bg-gray-50/90 dark:bg-gray-800/50 rounded-xl mb-4">
              <ChartPieIcon className="w-12 h-12 text-gray-400/90 dark:text-gray-500/90" />
            </div>
            {hasEnoughDataForAnalysis === true ? (
              <>
                <h3 className="text-xl font-[600] text-gray-900 dark:text-white mb-2">
                  Ready for Analysis
                </h3>
                <p className="text-[15px] text-gray-600/90 dark:text-gray-400 mb-4">
                  You have sufficient data to generate relationship insights. Click the 'Generate New Insights' button above to begin.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-[600] text-gray-900 dark:text-white mb-2">
                  Not Enough Data Yet
                </h3>
                <p className="text-[15px] text-gray-600/90 dark:text-gray-400">
                  Log your interactions regularly to generate detailed insights.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {analytics?.interactionHeatmap && (
            <HeatmapChart data={analytics.interactionHeatmap} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark">
              <div className="p-6">
                <h3 className="text-xl font-[600] text-gray-900 dark:text-white tracking-[-0.01em] mb-4">
                  Top Engaged Contacts
                </h3>
                <div className="space-y-3.5">
                  {analytics?.topEngaged.map(contact => (
                    <div
                      key={contact.contactId}
                      className="bg-gray-50/90 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-all duration-200 shadow-sm"
                    >
                      <div className="px-4 py-4">
                        <div className="flex flex-col gap-3.5">
                          <Link
                            to={`/contacts?search=${encodeURIComponent(contact.contactName)}`}
                            className="block text-[15px] font-semibold text-primary-500 hover:text-primary-600 transition-colors tracking-[-0.01em]"
                          >
                            {contact.contactName}
                          </Link>
                          <div className="grid gap-2.5">
                            <div className="flex flex-wrap items-center gap-2 text-[14px] text-gray-600/90">
                              <span className="inline-flex items-center px-2.5 py-1 bg-white/90 dark:bg-gray-900/50 backdrop-blur-sm rounded-md shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                                <span className="font-[450]">{contact.interactionCount} interactions</span>
                              </span>
                              {contact.lastInteraction && (
                                <span className="inline-flex items-center px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-md shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                                  Last: {dayjs(contact.lastInteraction).fromNow()}
                                </span>
                              )}
                            </div>
                            <div className="inline-flex items-center px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-md shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
                              <span className="text-[14px] text-gray-600/90 dark:text-gray-400">
                                Every{' '}
                                <span className="font-[500] text-gray-800 dark:text-gray-200">
                                  {contact.averageFrequency}
                                </span>{' '}
                                days avg.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark">
              <div className="p-6">
                <h3 className="text-xl font-[600] text-gray-900 dark:text-white tracking-[-0.01em] mb-4">
                  Relationship Health
                </h3>
                <div className="space-y-4">
                  {analytics && (
                    <>
                      <div className="bg-gray-50 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-gray-100">
                          <span className="text-xs font-[500] text-gray-500/90 uppercase tracking-wider">Overall Status</span>
                        </div>
                        <div className="p-3">
                          <ProgressMetric
                            label="On Track"
                            value={analytics.topEngaged.length}
                            total={analytics.topEngaged.length + analytics.neglectedContacts.length}
                          />
                          <div className="mt-2 flex justify-between text-[13px] sm:text-sm font-[450] text-gray-600/90">
                            <span>Active Contacts: {analytics.topEngaged.length + analytics.neglectedContacts.length}</span>
                            <span>{analytics.neglectedContacts.length} need attention</span>
                          </div>
                        </div>
                      </div>
                      
                      {analytics.neglectedContacts.length > 0 && (
                        <div className="bg-gray-50 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-gray-100">
                            <span className="text-xs font-[500] text-gray-500/90 uppercase tracking-wider">Needs Attention</span>
                          </div>
                          <div className="px-3 py-2 space-y-2">
                            <NeglectedContactsList contacts={analytics.neglectedContacts} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-xl border border-gray-100/50 dark:border-gray-800/50 shadow-soft dark:shadow-soft-dark md:col-span-2">
              <div className="p-6">
                <h3 className="text-xl font-[600] text-gray-900 dark:text-white mb-4">
                  Detailed Insights
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

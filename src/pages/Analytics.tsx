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
  const { isPremium, isOnTrial } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: analyticsService.getLastAnalytics,
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

  if (!isPremium && !isOnTrial) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 -m-2 text-gray-400 hover:text-gray-500"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Relationship Analytics (beta)
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center p-8 text-center">
          <SparklesIcon className="w-16 h-16 text-primary-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Upgrade to access detailed analytics
          </h2>
          <p className="text-gray-600 mb-6 max-w-lg">
            Get deep insights into your relationships, including interaction patterns,
            contact trends and AI-powered relationship analysis.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Upgrade Now
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    );
  }

  const renderContactTopics = useCallback(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {analytics?.contactTopics.map(contact => (
        <div key={contact.contactId} className="space-y-2">
          <h4 className="font-medium text-gray-900">{contact.contactName}</h4>
          {contact.aiAnalysis ? (
            <div className="text-sm text-gray-600 whitespace-pre-line">
              {contact.aiAnalysis}
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              Common topics: {contact.topics.join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  ), [analytics?.contactTopics]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 -m-2 text-gray-400 hover:text-gray-500"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Relationship Analytics (beta)</h1>
              <p className="mt-1 text-sm text-gray-600">
                Deep insights into your connections and interaction patterns
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleGenerateAnalytics}
          disabled={!canGenerate || isGenerating}
          className={`inline-flex items-center justify-center w-full px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors shadow-soft hover:shadow-lg ${
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
      </div>

      {!analytics?.hasEnoughData ? (
        <div className="text-center p-8 bg-white rounded-xl shadow-soft">
          <ChartPieIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Not Enough Data Yet
          </h3>
          <p className="text-gray-600">
            Add more contacts and log your interactions to generate detailed analysis.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-soft">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Interaction History
              </h3>
              {analytics?.interactionHeatmap && (
                <HeatmapChart data={analytics.interactionHeatmap} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-soft">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Top Engaged Contacts
                </h3>
                <div className="space-y-4">
                  {analytics?.topEngaged.map(contact => (
                    <div key={contact.contactId} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{contact.contactName}</p>
                        <p className="text-sm text-gray-600">
                          {contact.interactionCount} interactions
                          {contact.lastInteraction && ` • Last: ${dayjs(contact.lastInteraction).fromNow()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          Avg. every{' '}
                          <span className="font-medium text-gray-900">
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

            <div className="bg-white rounded-xl shadow-soft">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Total Interactions: {analytics.recentProgress.totalInteractions}</span>
                        <span>{analytics.recentProgress.neglectedContacts} contacts need attention</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-soft md:col-span-2">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Relationship Insights
                </h3>
                {renderContactTopics()}
              </div>
            </div>
          </div>
        </>
      )}

      {analytics && !canGenerate && (
        <p className="text-sm text-gray-600 text-center">
          Next analysis available {dayjs(analytics.nextGenerationAllowed).fromNow()}
        </p>
      )}
    </div>
  );
};
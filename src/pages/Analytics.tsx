import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics';
import { useStore } from '../stores/useStore';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  ChartPieIcon,
  ChevronRightIcon,
  SparklesIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const HeatmapChart = ({ data }: { data: { date: string; count: number }[] }) => {
  // Group by month for labels
  const months = useMemo(() => {
    const monthGroups = new Map<string, { total: number; days: number }>();
    data.forEach(({ date, count }) => {
      const month = date.substring(0, 7); // YYYY-MM
      const curr = monthGroups.get(month) || { total: 0, days: 0 };
      monthGroups.set(month, {
        total: curr.total + count,
        days: curr.days + 1
      });
    });
    return Array.from(monthGroups.entries()).map(([month, stats]) => ({
      month,
      average: stats.total / stats.days
    }));
  }, [data]);

  // Calculate color intensity based on count
  const maxCount = Math.max(...data.map(d => d.count));
  const getColor = (count: number) => {
    if (count === 0) return 'bg-gray-100';
    const intensity = Math.min(0.9, (count / maxCount) * 0.9);
    return `bg-primary-${Math.round(intensity * 500)}`;
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[600px]">
        <div className="flex justify-between mb-2">
          {months.map(({ month }) => (
            <div key={month} className="text-xs text-gray-500">
              {dayjs(month).format('MMM')}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(180,1fr)] gap-1">
          {data.map(({ date, count }) => (
            <div
              key={date}
              className={`w-3 h-3 rounded-sm ${getColor(count)}`}
              title={`${date}: ${count} interactions`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const ProgressMetric = ({ label, value, total }: { label: string; value: number; total: number }) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-medium text-gray-900">{percentage}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const Analytics = () => {
  const navigate = useNavigate();
  const { isPremium, isOnTrial } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, []);

  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['analytics'],
    queryFn: analyticsService.getLastAnalytics,
  });

  const handleGenerateAnalytics = async () => {
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
  };

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
            className="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-400 transition-colors"
          >
            Upgrade Now
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 -m-2 text-gray-400 hover:text-gray-500"
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
              ? 'bg-primary-500 hover:bg-primary-400'
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
            Add more contacts and log your interactions to generate detailed analytics.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-soft">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Interaction History
              </h3>
              <HeatmapChart data={analytics.interactionHeatmap} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-soft">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Top Engaged Contacts
                </h3>
                <div className="space-y-4">
                  {analytics.topEngaged.map(contact => (
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
                  Recent Progress ({analytics.recentProgress.period})
                </h3>
                <div className="space-y-4">
                  <ProgressMetric
                    label="Engaged Contacts"
                    value={analytics.recentProgress.engagedContacts}
                    total={analytics.recentProgress.engagedContacts + analytics.recentProgress.neglectedContacts}
                  />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Total Interactions: {analytics.recentProgress.totalInteractions}</span>
                    <span>{analytics.recentProgress.neglectedContacts} contacts need attention</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-soft md:col-span-2">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Relationship Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {analytics.contactTopics.map(contact => (
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
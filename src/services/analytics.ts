import { supabase } from '../lib/supabase/client';
import type { Contact as BaseContact, Interaction } from '../lib/supabase/types';
import dayjs from 'dayjs';
import axios from 'axios';

// Extend Contact type to include interactions
interface Contact extends BaseContact {
  interactions?: Interaction[];
}

interface ContactEngagement {
  contactId: string;
  contactName: string;
  interactionCount: number;
  lastInteraction: string | null;
  averageFrequency: number; // days between interactions
}

interface ContactTopics {
  contactId: string;
  contactName: string;
  topics: string[];
  aiAnalysis: string | null;
}

interface WeeklyMonthlyProgress {
  period: 'week' | 'month';
  engagedContacts: number;
  neglectedContacts: number;
  totalInteractions: number;
}

export interface AnalyticsData {
  generated: string;
  nextGenerationAllowed: string;
  topEngaged: ContactEngagement[];
  neglectedContacts: Contact[];
  interactionHeatmap: { date: string; count: number }[];
  contactTopics: ContactTopics[];
  recentProgress: WeeklyMonthlyProgress;
  hasEnoughData: boolean;
}

const GENERATION_COOLDOWN_DAYS = 7;
const MIN_INTERACTIONS_FOR_ANALYSIS = 5;
const GROQ_API_URL = 'https://openrouter.ai/api/v1/chat/completions'; // Set LLM API URL here //

export const analyticsService = {
  async getLastAnalytics(): Promise<AnalyticsData | null> {
  const { data, error } = await supabase
    .from('contact_analytics')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No analytics found
    throw error;
  }

  // Return the data field which contains the actual analytics
  return data?.data as AnalyticsData || null;
  },

  async generateAnalytics(): Promise<AnalyticsData> {
    // Clear existing analytics for the current user
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error('No authenticated user');

    const { error: deleteError } = await supabase
      .from('contact_analytics')
      .delete()
      .eq('user_id', user.user.id);
    
    if (deleteError) throw deleteError;

    // Get all contacts and their interactions
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        *,
        interactions (
          type,
          date,
          notes,
          sentiment
        )
      `);
    if (contactsError) throw contactsError;

    const typedContacts = contacts as Contact[] | null;
    // Check if we have any contacts with minimum required interactions
    if (!typedContacts || typedContacts.length === 0 || !typedContacts.some(c => (c.interactions || []).length >= MIN_INTERACTIONS_FOR_ANALYSIS)) {
      return {
        generated: new Date().toISOString(),
        nextGenerationAllowed: dayjs().add(GENERATION_COOLDOWN_DAYS, 'days').toISOString(),
        topEngaged: [],
        neglectedContacts: [],
        interactionHeatmap: [],
        contactTopics: [],
        recentProgress: {
          period: 'week',
          engagedContacts: 0,
          neglectedContacts: 0,
          totalInteractions: 0
        },
        hasEnoughData: false
      };
    }

    // Calculate base analytics
    const heatmap = this.generateHeatmap(typedContacts.flatMap(c => c.interactions || []));
    const engagement = this.calculateEngagement(typedContacts);
    const neglected = this.findNeglectedContacts(typedContacts);
    const progress = this.calculateProgress(typedContacts);
    
    // Get AI analysis for top engaged contacts
    const topics = await this.analyzeContactsWithAI(
      typedContacts.filter(c => (c.interactions || []).length >= MIN_INTERACTIONS_FOR_ANALYSIS)
    );

    const analytics: AnalyticsData = {
      generated: new Date().toISOString(),
      nextGenerationAllowed: dayjs().add(GENERATION_COOLDOWN_DAYS, 'days').toISOString(),
      topEngaged: engagement,
      neglectedContacts: neglected,
      interactionHeatmap: heatmap,
      contactTopics: topics,
      recentProgress: progress,
      // Only set hasEnoughData true if we have at least one contact with minimum required interactions
      hasEnoughData: typedContacts.some(c => (c.interactions || []).length >= MIN_INTERACTIONS_FOR_ANALYSIS)
    };

    // Store the analytics
    // Ensure we have the right data structure and that hasEnoughData is properly set
    const hasEnoughData = typedContacts.some(c => (c.interactions || []).length >= MIN_INTERACTIONS_FOR_ANALYSIS);
    const finalAnalytics = {
      ...analytics,
      hasEnoughData,
    };

    const { error: saveError } = await supabase
      .from('contact_analytics')
      .insert({
        data: finalAnalytics,
        generated_at: analytics.generated,
        user_id: user.user.id
      });
    if (saveError) throw saveError;

    return analytics;
  },

  async analyzeContactsWithAI(contacts: Contact[]): Promise<ContactTopics[]> {
    const topics: ContactTopics[] = [];

    for (const contact of contacts) {
      const interactions = contact.interactions || [];
      if (interactions.length < MIN_INTERACTIONS_FOR_ANALYSIS) continue;

      const timeSinceLastContact = contact.last_contacted
        ? Math.floor(dayjs().diff(dayjs(contact.last_contacted), 'days'))
        : null;

      const userMessage = [
        "Analyze this contact's interaction history and provide insights about the relationship:",
        "",
        "Contact Details:",
        `- Name: ${contact.name}`,
        `- Last contacted: ${timeSinceLastContact ? timeSinceLastContact + " days ago" : "Never"}`,
        `- Preferred method: ${contact.preferred_contact_method || "Not specified"}`,
        `- Missed interactions: ${contact.missed_interactions}`,
        "",
        "Recent Activity (chronological):",
        `${interactions
          .sort((a: Interaction, b: Interaction) => dayjs(a.date).diff(dayjs(b.date)))
          .map((i: Interaction) => `- ${dayjs(i.date).format('YYYY-MM-DD')}: ${i.type} (${i.sentiment || "neutral"})${i.notes ? `\n  Notes: ${i.notes}` : ''}`).join('\n')}`,
        "",
        "Provide insights in this format:",
        "1. Most discussed topics (bullet points)",
        "2. Communication patterns",
        "3. Relationship dynamics",
        "Keep responses concise and focused on clear patterns.",
      ].join('\n');

      try {
        const response = await axios.post(
          GROQ_API_URL,
          {
            model: 'google/gemini-2.0-flash-001', // Set LLM model here //
            messages: [
              {
                role: 'system',
                content: 'You are an expert relationship analyst helping users understand their social connections and interaction patterns.'
              },
              {
                role: 'user',
                content: userMessage
              }
            ],
            temperature: 0.7,
            max_tokens: 1000
          },
          {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Extract topics from AI response
        const aiResponse = response.data.choices[0].message.content;
        const topicsSection = aiResponse.split('1. Most discussed topics')[1]?.split('2. Communication patterns')[0] || '';
        const aiTopics = topicsSection
          .split('\n')
          .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•'))
          .map((line: string) => line.trim().replace(/^[-•]\s*/, ''));

        topics.push({
          contactId: contact.id,
          contactName: contact.name,
          topics: aiTopics,
          aiAnalysis: aiResponse
        });
      } catch (error) {
        console.error('Error analyzing contact:', error);
        // If AI analysis fails, include contact without topics
        topics.push({
          contactId: contact.id,
          contactName: contact.name,
          topics: [],
          aiAnalysis: null
        });
      }
    }

    return topics;
  },

  generateHeatmap(interactions: Interaction[]) {
    const heatmap: { date: string; count: number }[] = [];
    const counts = new Map<string, number>();

    // Get last 12 months of data (similar to GitHub's contribution graph)
    const startDate = dayjs().subtract(12, 'month');
    const endDate = dayjs();

    interactions
      .filter(i => dayjs(i.date).isAfter(startDate))
      .forEach(interaction => {
        const date = dayjs(interaction.date).format('YYYY-MM-DD');
        counts.set(date, (counts.get(date) || 0) + 1);
      });

    let current = startDate;
    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      const date = current.format('YYYY-MM-DD');
      heatmap.push({
        date,
        count: counts.get(date) || 0
      });
      current = current.add(1, 'day');
    }

    return heatmap;
  },

  calculateEngagement(contacts: Contact[]): ContactEngagement[] {
    const engagement = new Map<string, ContactEngagement>();

    contacts.forEach(contact => {
      const interactions = contact.interactions || [];
      const sortedInteractions = [...interactions].sort((a: Interaction, b: Interaction) => 
        dayjs(b.date).diff(dayjs(a.date))
      );
      const lastInteraction = sortedInteractions[0]?.date || null;

      let averageFrequency = 0;
      if (interactions.length > 1) {
        const sortedDates = interactions
          .map((i: Interaction) => dayjs(i.date))
          .sort((a, b) => a.diff(b));
        
        const totalDays = sortedDates.reduce((sum: number, date: dayjs.Dayjs, idx: number) => {
          if (idx === 0) return 0;
          return sum + date.diff(sortedDates[idx - 1], 'day');
        }, 0);

        averageFrequency = Math.round(totalDays / (interactions.length - 1));
      }

      engagement.set(contact.id, {
        contactId: contact.id,
        contactName: contact.name,
        interactionCount: interactions.length,
        lastInteraction,
        averageFrequency
      });
    });

    return Array.from(engagement.values())
      .sort((a, b) => b.interactionCount - a.interactionCount)
      .slice(0, 5);
  },

  findNeglectedContacts(contacts: Contact[]): Contact[] {
    return contacts.filter(contact => {
      if (!contact.contact_frequency) return false;

      const interactions = contact.interactions || [];
      const lastInteraction = interactions[0]?.date;
      if (!lastInteraction) return true;

      const daysSinceLastContact = dayjs().diff(dayjs(lastInteraction), 'day');
      const frequencyDays = {
        every_three_days: 6,  // 2x the frequency period like other values
        weekly: 14,
        fortnightly: 30,
        monthly: 45,
        quarterly: 100
      }[contact.contact_frequency];

      return daysSinceLastContact > frequencyDays;
    });
  },

  calculateProgress(contacts: Contact[]): WeeklyMonthlyProgress {
    const now = dayjs();
    const weekStart = now.subtract(7, 'day');
    const monthStart = now.subtract(30, 'day');

    const recentInteractionsByContact = contacts.map(contact => ({
      contactId: contact.id,
      weeklyInteractions: (contact.interactions || []).filter((i: Interaction) => 
        dayjs(i.date).isAfter(weekStart)
      ),
      monthlyInteractions: (contact.interactions || []).filter((i: Interaction) => 
        dayjs(i.date).isAfter(monthStart)
      )
    }));

    const weeklyEngaged = recentInteractionsByContact.filter(c => c.weeklyInteractions.length > 0).length;
    const monthlyEngaged = recentInteractionsByContact.filter(c => c.monthlyInteractions.length > 0).length;

    return {
      period: weeklyEngaged > monthlyEngaged / 4 ? 'week' : 'month',
      engagedContacts: weeklyEngaged > monthlyEngaged / 4 ? weeklyEngaged : monthlyEngaged,
      neglectedContacts: contacts.length - (weeklyEngaged > monthlyEngaged / 4 ? weeklyEngaged : monthlyEngaged),
      totalInteractions: weeklyEngaged > monthlyEngaged / 4 
        ? recentInteractionsByContact.reduce((sum, c) => sum + c.weeklyInteractions.length, 0)
        : recentInteractionsByContact.reduce((sum, c) => sum + c.monthlyInteractions.length, 0)
    };
  }
};
import axios from 'axios';
import type { Contact, Interaction } from '../lib/supabase/types';

const groqApi = axios.create({
  baseURL: 'https://api.groq.com/openai/v1/chat/completions',
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

interface SuggestionResponse {
  suggestions: Array<{
    type: 'call' | 'message' | 'social';
    description: string;
    urgency: 'low' | 'medium' | 'high';
  }>;
}

export const aiService = {
  async generateInteractionSuggestions(
    contact: Contact,
    recentInteractions: Interaction[]
  ): Promise<SuggestionResponse> {
    try {
      // Only generate suggestions if the contact is due tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextContactDue = contact.next_contact_due ? new Date(contact.next_contact_due) : null;
      if (!nextContactDue || nextContactDue.getTime() !== tomorrow.getTime()) {
        return { suggestions: [] };
      }

      const prompt = `Analyze this contact's profile and recent interactions to identify the SINGLE most impactful way to strengthen the relationship right now. Only provide a suggestion if you identify a clear opportunity based on:

${contact.notes ? `Personal Context: ${contact.notes}` : ''}
Last Contact: ${contact.last_contacted ? new Date(contact.last_contacted).toLocaleDateString() : 'Never'}
Preferred: ${contact.preferred_contact_method || 'Not specified'}
Frequency: ${contact.contact_frequency || 'Not specified'}
Social: ${contact.social_media_handle || 'Not specified'}
Connection: ${contact.relationship_level}/5

Recent Activity:
${recentInteractions.map(interaction =>
  `- ${interaction.date}: ${interaction.type} (${interaction.sentiment || 'neutral'})`
).join('\n')}

Rules:
1. Only suggest an action if you're highly confident it will strengthen the relationship
2. Must be specific to this person's context - no generic advice
3. Must be actionable within the next 24-48 hours
4. Avoid restating obvious relationship principles
5. Avoid providing more than 2-3 concise, highly impactful suggestions
6. If no clear opportunity exists, return an empty suggestion

Format suggestion as: "- [type: call/message/social] Specific action"`;

      const response = await groqApi.post('/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a proficient relationship manager assistant helping users maintain meaningful connections.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      // Parse and structure the AI response
      const suggestions = response.data.choices[0].message.content
        .split('\n')
        .filter((line: string) => line.trim())
        .map((suggestion: string) => {
          const type = suggestion.toLowerCase().includes('call') ? 'call'
            : suggestion.toLowerCase().includes('message') ? 'message'
            : 'social';
          
          const urgency = suggestion.toLowerCase().includes('soon') || suggestion.toLowerCase().includes('important')
            ? 'high'
            : suggestion.toLowerCase().includes('consider') || suggestion.toLowerCase().includes('might')
            ? 'low'
            : 'medium';

          return {
            type,
            description: suggestion,
            urgency
          };
        });

      return { suggestions };
    } catch (error) {
      console.error('Error generating suggestions:', error);
      throw new Error('Failed to generate interaction suggestions');
    }
  }
};
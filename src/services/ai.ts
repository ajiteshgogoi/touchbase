import axios from 'axios';
import type { Contact, Interaction } from '../lib/supabase/types';

const groqApi = axios.create({
  baseURL: 'https://api.groq.com/v1',
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

      const prompt = `Given the following contact and their recent interactions, suggest personalized ways to keep in touch that will strengthen the relationship:
      
Contact Information:
- Name: ${contact.name}
- Last contacted: ${contact.last_contacted ? new Date(contact.last_contacted).toLocaleDateString() : 'Never'}
- Preferred method: ${contact.preferred_contact_method || 'Not specified'}
- Ideal frequency: ${contact.contact_frequency || 'Not specified'}
- Social media: ${contact.social_media_handle || 'Not specified'}
- Relationship level: ${contact.relationship_level}/5
- Notes: ${contact.notes || 'None'}

Recent interactions:
${recentInteractions.map(interaction =>
  `- ${interaction.date}: ${interaction.type} (${interaction.sentiment || 'neutral'})`
).join('\n')}

Consider these relationship-strengthening principles:
1. Phone calls create stronger bonds than texts or social media
2. Regular 'pebbling' (small interactions like sharing memes) helps maintain connection
3. Match contact method to relationship level (closer relationships benefit from more intimate communication)
4. Use information from notes to personalize suggestions
5. Vary contact methods to keep engagement fresh

Provide 2-3 natural, context-aware suggestions for maintaining and strengthening this relationship. Each suggestion should be on its own line starting with a bullet point (-). Keep suggestions clear and concise. Consider both the preferred contact method and opportunities for deeper connection.`;

      const response = await groqApi.post('/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a relationship manager assistant helping users maintain meaningful connections.'
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
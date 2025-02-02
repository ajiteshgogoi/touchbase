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
    type: 'call' | 'message' | 'social' | 'meeting';
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
      const prompt = `Given the following contact and their recent interactions, suggest personalized ways to keep in touch:
      
Contact:
- Name: ${contact.name}
- Last contacted: ${contact.last_contacted || 'Never'}
- Preferred method: ${contact.preferred_contact_method || 'Not specified'}
- Relationship level: ${contact.relationship_level}/5

Recent interactions:
${recentInteractions.map(interaction => 
  `- ${interaction.date}: ${interaction.type} (${interaction.sentiment || 'neutral'})`
).join('\n')}

Provide natural, context-aware suggestions for maintaining this relationship.`;

      const response = await groqApi.post('/chat/completions', {
        model: 'mixtral-8x7b-32768',
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
            : suggestion.toLowerCase().includes('meet') ? 'meeting'
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
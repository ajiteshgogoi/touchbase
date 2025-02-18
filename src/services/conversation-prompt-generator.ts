import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const GROQ_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Types
interface Theme {
  main: string;
  subthemes: string[];
}

interface GeneratedPrompt {
  question: string;
  metadata: {
    theme: string;
    subtheme: string;
    perspective: string;
    modifier: string;
  };
}

// Constants from CozyConnect
const themes: Theme[] = [
  { main: 'trust', subthemes: ['betrayal', 'vulnerability', 'building trust', 'rebuilding after betrayal', 'trusting yourself'] },
  { main: 'friendship', subthemes: ['loyalty', 'support', 'childhood friends', 'forgiveness in friendship', 'long-distance friendships'] },
  { main: 'family', subthemes: ['traditions', 'conflict resolution', 'unconditional love', 'family dynamics', 'parent-child relationships'] },
  { main: 'love', subthemes: ['romantic love', 'self-love', 'unrequited love', 'first love', 'sustaining love over time'] },
  { main: 'change', subthemes: ['adaptation', 'growth', 'resistance to change', 'embracing uncertainty', 'transformative experiences'] },
  // ... other themes from CozyConnect
];

const perspectives: string[] = [
  'childhood',
  'the past',
  'the present moment',
  'future aspirations',
  'through the eyes of a mentor',
  'from the perspective of a learner',
  'cultural lens',
  'through the lens of gratitude',
  'through the lens of an outsider',
  'through the eyes of a loved one',
  'generational perspective',
  'milestones in life',
  'a turning point',
  'the perspective of hindsight'
];

const questionStarters: Record<string, string[]> = {
  trust: ['how did', 'what experience', 'can you describe', 'why do', 'what led to', 'in what way'],
  friendship: ['what moment', 'how did', 'what does', 'can you recall', 'why is', 'what taught you about'],
  // ... other starters from CozyConnect
};

const emotionalModifiers: string[] = [
  'joyful',
  'challenging',
  'life-changing',
  'unexpected',
  'empowering',
  'heart-warming',
  // ... other modifiers from CozyConnect
];

const defaultStarters = ['how did', 'what'];

export class ConversationPromptGenerator {
  private supabase;
  private groqApiKey: string;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    groqApiKey: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.groqApiKey = groqApiKey;
  }

  private getRandomElement<T>(arr: NonNullable<T[]>): NonNullable<T> {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error('Cannot get random element from empty or invalid array');
    }
    const element = arr[Math.floor(Math.random() * arr.length)];
    if (element === undefined || element === null) {
      throw new Error('Selected element is undefined or null');
    }
    return element;
  }

  async generatePrompt(userId: string): Promise<GeneratedPrompt> {
    // Check rate limit first
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const { data: promptLogs, error: logsError } = await this.supabase
      .from('prompt_generation_logs')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', tenMinutesAgo.toISOString());

    if (logsError) throw logsError;

    if ((promptLogs?.length || 0) >= 5) {
      throw new Error('Rate limit exceeded. Please try again in a few minutes.');
    }

    // Select random elements
    const selectedTheme = this.getRandomElement(themes);
    const selectedSubtheme = this.getRandomElement(selectedTheme.subthemes);
    const randomPerspective = this.getRandomElement(perspectives);
    const startersList = questionStarters[selectedTheme.main] || defaultStarters;
    const randomStarter = this.getRandomElement(startersList);
    const emotionalModifier = this.getRandomElement(emotionalModifiers);

    // Random word limit between 20-30
    const wordLimit = Math.floor(Math.random() * 11) + 20;

    const prompt = `Generate a ${emotionalModifier} and thought-provoking open-ended question about the theme: "${selectedTheme.main}" (subtheme: "${selectedSubtheme}"), from the perspective of "${randomPerspective}". Start the question with "${randomStarter}".

MUST BE:
- Personal and conversational (like a question from a friend)
- Under ${wordLimit} words
- Encourage sharing of a story, experience, insight or opinion
AVOID:
- Trivial or overly simple questions
- Abstract or overly philosophical phrasing
- Close-ended questions
- Interview-style questions
- Incorrect grammar
- Addressing to self using words like 'I' and 'My'
- Questions that are too broad

Example of a good question:
- What moment from your childhood taught you about trust?`;

    // Generate question using OpenRouter API
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'system',
            content: 'You help people have meaningful conversations by generating thoughtful, personal questions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from AI service');
    }

    // Get the generated question
    const question = response.data.choices[0].message.content.trim();

    // Log the generation
    const { error: logError } = await this.supabase
      .from('prompt_generation_logs')
      .insert({
        user_id: userId,
        prompt_text: question,
        theme: selectedTheme.main,
        subtheme: selectedSubtheme,
        perspective: randomPerspective,
        emotional_modifier: emotionalModifier
      });

    if (logError) throw logError;

    return {
      question,
      metadata: {
        theme: selectedTheme.main,
        subtheme: selectedSubtheme,
        perspective: randomPerspective,
        modifier: emotionalModifier
      }
    };
  }
}
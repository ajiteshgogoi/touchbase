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
  { main: 'overcoming_challenges', subthemes: ['resilience', 'problem-solving', 'mental toughness', 'seeking help', 'personal breakthroughs'] },
  { main: 'learning', subthemes: ['lifelong learning', 'learning from failure', 'curiosity', 'mentorship', 'self-directed learning'] },
  { main: 'strengths', subthemes: ['discovering strengths', 'using strengths in adversity', 'building confidence', 'acknowledging weaknesses', 'inner resilience'] },
  { main: 'decisions', subthemes: ['making tough choices', 'regret and hindsight', 'weighing risks', 'intuition in decision-making', 'decisions that changed your life'] },
  { main: 'purpose', subthemes: ['finding meaning', 'career purpose', 'life goals', 'serving others', 'purpose in adversity'] },
  { main: 'success', subthemes: ['defining success', 'achieving goals', 'celebrating milestones', 'sacrifices for success', 'learning from success'] },
  { main: 'beliefs', subthemes: ['challenging beliefs', 'cultural influences', 'core values', 'beliefs about yourself', 'evolving beliefs'] },
  { main: 'passion', subthemes: ['discovering passions', 'pursuing passions', 'balancing passion and responsibility', 'turning passion into purpose', 'reigniting passion'] },
  { main: 'helping_others', subthemes: ['acts of kindness', 'mentorship', 'volunteering', 'making a difference', 'helping in unexpected ways'] },
  { main: 'health_and_well-being', subthemes: ['mental health', 'physical fitness', 'self-care', 'work-life balance', 'recovering from setbacks'] },
  { main: 'creativity', subthemes: ['inspiration', 'creative processes', 'overcoming creative blocks', 'collaborative creativity', 'expressing yourself'] },
  { main: 'cultural_experiences', subthemes: ['travel', 'traditions', 'cross-cultural understanding', 'cultural heritage', 'adapting to new cultures'] },
  { main: 'adventures', subthemes: ['unexpected journeys', 'outdoor exploration', 'adrenaline experiences', 'travel stories', 'overcoming fear in adventures'] },
  { main: 'achievements', subthemes: ['pride in accomplishments', 'overcoming odds', 'team achievements', 'recognition', 'setting new goals'] },
  { main: 'mistakes', subthemes: ['lessons from mistakes', 'forgiving yourself', 'apologising', 'mistakes that shaped you', 'moving forward'] },
  { main: 'transition', subthemes: ['life changes', 'new beginnings', 'endings', 'navigating uncertainty', 'adapting to new roles'] },
  { main: 'hobbies', subthemes: ['pursuing hobbies', 'learning new skills', 'hobbies that bring joy', 'sharing hobbies', 'childhood hobbies'] },
  { main: 'curiosity', subthemes: ['exploring the unknown', 'asking questions', 'curiosity in learning', 'curiosity and creativity', 'childlike wonder'] }
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
  family: ['how has', 'what role', 'how do', 'what is your view on', 'why do you think', 'what example comes to mind'],
  love: ['what taught', 'how did', 'what does', 'in what way', 'why is', 'how can'],
  change: ['how has', 'what inspired', 'can you describe', 'why do you think', 'what made', 'how did it feel when'],
  overcoming_challenges: ['how did', 'what helped', 'what lesson', 'can you describe', 'why was', 'what enabled you to'],
  learning: ['what did', 'how has', 'what moment', 'why do you value', 'can you share', 'how can one'],
  strengths: ['how do', 'what strength', 'in what way', 'can you describe', 'why is', 'what moment revealed'],
  decisions: ['how did', 'what led to', 'why did', 'can you explain', 'what influenced', 'how do you view'],
  purpose: ['what gives', 'how has', 'in what way', 'why do', 'what taught you about', 'can you describe'],
  success: ['what does', 'how has', 'why is', 'what example illustrates', 'can you recall', 'how did it feel'],
  beliefs: ['how have', 'what shaped', 'why do', 'can you explain', 'what moment challenged', 'in what way'],
  passion: ['what inspires', 'how do', 'in what way', 'why do you think', 'what taught you about', 'how has'],
  helping_others: ['how did', 'what motivated', 'why is', 'what example comes to mind', 'in what way', 'how has'],
  health_and_well_being: ['what practice', 'how has', 'why do', 'in what way', 'what role does', 'how did'],
  creativity: ['what inspires', 'how do', 'why is', 'in what way', 'what example', 'how has'],
  cultural_experiences: ['what did', 'how has', 'in what way', 'why do you value', 'what taught', 'can you describe'],
  adventures: ['what was', 'how did', 'why is', 'can you recall', 'what inspired', 'how do you feel about'],
  achievements: ['what does', 'how did', 'why is', 'what example', 'can you recall', 'in what way'],
  mistakes: ['what lesson', 'how did', 'why do', 'can you explain', 'what taught you about', 'in what way'],
  transition: ['how did', 'what led to', 'in what way', 'why do you think', 'what example', 'how do you view'],
  hobbies: ['what hobby', 'how do', 'why do', 'in what way', 'what example', 'how has'],
  curiosity: ['can you share', 'why is', 'how has', 'why do', 'in what way', 'what taught', 'how do you view']
};

const emotionalModifiers: string[] = [
  'joyful',
  'challenging',
  'life-changing',
  'unexpected',
  'empowering',
  'heart-warming',
  'bittersweet',
  'reflective',
  'liberating',
  'uplifting',
  'poignant',
  'intense',
  'resilient',
  'grateful',
  'content',
  'nostalgic',
  'hopeful',
  'compassionate',
  'vulnerable',
  'motivating',
  'cathartic',
  'peaceful',
  'euphoric',
  'fateful',
  'transformative',
  'healing',
  'enlightening',
  'melancholic',
  'surreal',
  'arduous',
  'tumultuous',
  'triumphant',
  'serene',
  'raw',
  'haunting',
  'grounding',
  'optimistic',
  'restorative',
  'thought-provoking',
  'inspiring'
];

const defaultStarters = ['how', 'what'];

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
      throw new Error('Unable to generate question. Please try again.');
    }
    const element = arr[Math.floor(Math.random() * arr.length)];
    if (element === undefined || element === null) {
      throw new Error('Unable to generate question. Please try again.');
    }
    return element;
  }

  async generatePrompt(userId: string): Promise<GeneratedPrompt> {
    // Check rate limit first
    const now = new Date();

    const { data: promptLogs, error: logsError } = await this.supabase
      .from('prompt_generation_logs')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (logsError) throw new Error('Unable to check generation limits. Please try again.');

if ((promptLogs?.length || 0) >= 5) {
  // Find the most recent prompt log
  const mostRecentLog = promptLogs[0];
  if (!mostRecentLog || !mostRecentLog.created_at) {
    throw new Error("Something went wrong. Please try again.");
  }
  
  // Check if the 5th most recent prompt was within the last 10 minutes
  const fifthRecentLog = promptLogs[4];
  if (!fifthRecentLog || !fifthRecentLog.created_at) {
    throw new Error("Something went wrong. Please try again.");
  }
  
  const fifthRecentTime = new Date(fifthRecentLog.created_at).getTime();
  const timeSinceFifth = now.getTime() - fifthRecentTime;
  
  if (timeSinceFifth < 10 * 60 * 1000) {
    const timeLeft = Math.ceil((10 * 60 * 1000 - timeSinceFifth) / 60000);
    throw new Error(`Generation limit exceeded. Please try again in ${timeLeft} minutes.`);
  }
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

    // Generate and refine question using OpenRouter API
    const maxRetries = 1;
    let lastError: Error | null = null;
    let validQuestionFound = false;
    let question = null;

    for (let attempt = 1; attempt <= maxRetries && !validQuestionFound; attempt++) {
      try {
        const response = await Promise.race<any>([
          axios.post<{
            data: {
              choices: Array<{
                message: {
                  content: string
                }
              }>
            }
          }>(
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
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Taking too long to generate a question. Please try again.')), 6000))
        ]);

        if (!response.data?.choices?.[0]?.message?.content) {
          throw new Error('Unable to generate question right now. Please try again in a moment.');
        }

        // Get the generated question
        question = response.data.choices[0].message.content.trim();

        if (question) {
          // Refinement step
          const refinementPrompt = `Refine this question to improve its quality and to meet all criteria:
          - Personal and conversational (like a question from a friend)
          - Contains only the question. No interjections like 'Hey' preceding the question.
          - Clear and easy to understand
          - At 8th grade reading level
          - Open-ended (cannot be answered with just 'Yes' or 'No')
          - Correct grammar and punctuation
          - Under ${wordLimit} words
          - Avoids trivial, vague, overly simple, or abstract questions
          - Encourages sharing of a story, experience, insight, or opinion
          - Uses "you/your" instead of "I/me/my"
          - Avoids compound questions (Asks only one question)
          - Avoids interview-style questions
          
          Original question: ${question}
          
          Return only the refined question:`;

          const refinementResponse = await axios.post(
            GROQ_API_URL,
            {
              model: 'google/gemini-2.0-flash-001',
              messages: [
                {
                  role: 'system',
                  content: 'You help refine conversation questions to be more engaging and personal.',
                },
                {
                  role: 'user',
                  content: refinementPrompt,
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

          if (refinementResponse.data?.choices?.[0]?.message?.content) {
            question = refinementResponse.data.choices[0].message.content.trim();
            validQuestionFound = true;
            break;
          }
        }
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    if (!question || !validQuestionFound) {
      throw lastError || new Error('Unable to generate a question. Please try again in a moment.');
    }

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

    if (logError) throw new Error('Something went wrong saving your question. Please try again.');

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

import OpenAI from 'openai';
import { StructuredInput } from './models/Post';
import { getPerformanceInsightsForAI } from './learning/platform-learning';
import { createChatCompletion } from './ai-client';

// Use Groq's OpenAI-compatible API (kept for compatibility, but prefer createChatCompletion)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Groq model - NOTE: The ai-client handles model rotation automatically
const AI_MODEL = 'llama-3.3-70b-versatile';

// Dynamic system prompt based on page type
function getLinkedInSystemPrompt(pageType: PageVoiceType = 'personal'): string {
  const isOrganization = pageType === 'organization';
  const we = isOrganization ? 'We' : 'I';
  const our = isOrganization ? 'Our' : 'My';
  const us = isOrganization ? 'our team' : 'me';
  
  return `You write LinkedIn posts that sound HUMAN, not AI. Your writing is conversational, direct, and authentic.

HOW REAL PEOPLE WRITE VS AI:

HUMAN WRITING:
- Uses simple, everyday words. "Use" not "leverage". "Help" not "facilitate"
- Starts sentences with "And" or "But" sometimes (breaking grammar rules)
- Has personality and natural rhythm
- Mixes sentence lengths: "Short. Then a longer one that flows naturally. Then short again."
- Shows genuine emotion and opinion, not neutral observations
- Sounds like someone thinking out loud, not presenting a report

AI RED FLAGS (NEVER DO THIS):
- Perfect grammar and formal structure
- "Moreover", "Furthermore", "Additionally", "Consequently"
- Emojis (NEVER use emojis - this is a professional platform)
- Numbered lists or bullet points in the post body
- "Here's why:", "The truth is:", "Let me explain:" (overused by AI)
- "Powerful", "Game-changing", "Transformative", "Unlock", "Leverage"
- Generic observations without personal stake

THE FORMULA FOR CONVERSION

1. HOOK (first line, under 210 characters)
   - Make a bold claim or share a surprising truth
   - Use specific details, not generic statements
   - Create curiosity gap: make them NEED to read more
   
   GOOD: "${we} deleted 15,000 lines of code. Performance went up 3x."
   BAD: "Code quality is important for performance." (generic, boring)

2. CONTEXT (2-4 short lines)
   - Set up the situation naturally
   - Write like you're explaining to a colleague
   - Use short sentences for emphasis
   
   "${we}'d been building fast for 2 years."
   "Every feature was a hack on top of a hack."
   "Then the new engineer couldn't ship anything."

3. THE INSIGHT (1-2 strong lines)
   - Share your actual learning or opinion
   - Be direct. Have a point of view.
   - This is where the value lives
   
   "Fast code isn't always fast shipping."
   "Sometimes you need to slow down to speed up."

4. THE LESSON (2-3 lines)
   - What you learned and why it matters
   - Make it actionable or thought-provoking
   - Keep it real and practical
   
   "Now ${we} refactor before adding features."
   "Boring wins. Clean wins."

5. ENGAGEMENT QUESTION
   - Ask about THEIR experience
   - Be specific, not generic
   - Make them want to share
   
   GOOD: "What's the biggest refactor you've done? Worth it?"
   BAD: "What are your thoughts on code quality?" (too generic)

WRITING THAT SOUNDS HUMAN

• Start sentences with And, But, Or, So (yes, it's okay)
• Use contractions: it's, don't, can't, we're, that's
• Show your thinking: "Here's what I learned." "The problem?" "Wait."
• Be direct: Cut unnecessary words. Get to the point.
• Use simple words: "use" not "utilize", "help" not "facilitate"
• Short paragraphs: 1-3 lines max. White space = readability
• Natural transitions: "So what happened?" "The result?" "Here's the thing."
• Incomplete sentences. For emphasis. (Yes, really.)

CRITICAL RULES

${isOrganization ? 'Use we/our/us consistently. Never I.' : 'Use I/my/me consistently. Never we unless talking about a team.'}
NO emojis. Ever. Zero. None.
NO bullet points with symbols (• - *) in the body
NO numbered lists in the post
NO markdown formatting - NO **bold**, NO __italic__, NO asterisks for emphasis
NO meta-commentary - Don't explain your post, character count, tone, or strategy
Return ONLY the post content itself, nothing else
Hook must be under 210 characters (shows before "see more")
Keep total under 1500 characters (including hashtags)
Write like you're texting, not presenting
Be conversational. Be human. Be real.

⛔ NEVER FABRICATE - THIS IS NON-NEGOTIABLE:
- NEVER invent client names, company names, or people (no "TechCorp", "Sarah from marketing")
- NEVER make up specific metrics you don't have (no "increased revenue 340%", "saved $2.3M")
- NEVER create fake scenarios with dates (no "Last March, a startup came to us...")
- NEVER fabricate dollar amounts, percentages, or time saved
- If you need examples, use HYPOTHETICAL framing: "imagine if..." or "say you had..."
- Or use GENERAL patterns: "teams often find..." "a common mistake is..."
- Share PRINCIPLES and LESSONS, not invented case studies
- When in doubt, teach the concept WITHOUT a fake story

IMPORTANT: LinkedIn is PLAIN TEXT. If you want emphasis, use CAPS for a word or two, not **asterisks**.

BANNED PHRASES - NEVER USE THESE (instant rejection if found):
⛔ Moreover, Furthermore, Additionally, However, Nevertheless, Consequently
⛔ Leverage, Utilize, Facilitate, Optimize, Streamline, Synergy  
⛔ Game-changer, Game-changing, Transformative, Revolutionary, Powerful, Unlock
⛔ Studies show, Research indicates, Data suggests
⛔ In today's world, It's no secret that, The fact is
⛔ Mindset change, Paradigm shift, Best practices

If you catch yourself writing ANY of these, STOP and rewrite with simpler words.

WEAK CLOSINGS (NEVER USE)
"What are your thoughts?" 
"Let me know in the comments!"
"Agree or disagree?"
Ask for their specific story or experience instead.

HASHTAGS (REQUIRED)
- Include 3-5 relevant hashtags at the END of your post
- Separate hashtags from content with a blank line
- Use industry-specific tags that attract your audience
- Mix broad (#SaaS #StartupLife) and niche (#TechDebt #MVPDevelopment) tags
- Research what's relevant - don't just use generic tags
- Total post INCLUDING hashtags must stay under 1500 characters

Example hashtag section:

#SaaS #StartupLife #ProductDevelopment #TechLeadership #SoftwareEngineering`;
}

// Default prompt for backward compatibility (personal voice)
const LINKEDIN_POST_SYSTEM_PROMPT = getLinkedInSystemPrompt('personal');

export interface GeneratePostOptions {
  mode: 'structured' | 'ai';
  structuredInput?: StructuredInput;
  aiPrompt?: string;
  tone?: 'professional' | 'casual' | 'inspirational' | 'educational';
  includeEmojis?: boolean;
  includeHashtags?: boolean;
  targetAudience?: string;
}

// Page type determines voice (I vs We)
export type PageVoiceType = 'personal' | 'organization' | 'manual';

// Page content strategy interface for multi-page support
export interface PageContentStrategy {
  persona: string;
  topics: string[];
  tone: string;
  targetAudience: string;
  postingFrequency: number;
  preferredAngles: string[];
  avoidTopics?: string[];
  customInstructions?: string;
  pageType?: PageVoiceType;  // Determines if content uses "I" or "We" voice
}

export interface GenerateWithStrategyOptions {
  strategy: PageContentStrategy;
  topic?: string; // Optional specific topic to write about
  angle?: string; // Optional specific angle to use
  inspiration?: string; // Optional content inspiration (e.g., from blog)
  pageId?: string; // Optional page ID for fetching learning insights
  platform?: 'linkedin' | 'facebook' | 'twitter' | 'instagram'; // Platform for insights
}

export async function generateLinkedInPost(options: GeneratePostOptions): Promise<string> {
  const { mode, structuredInput, aiPrompt, tone = 'professional', includeEmojis = true, includeHashtags = true, targetAudience } = options;

  let userPrompt = '';

  if (mode === 'structured' && structuredInput) {
    userPrompt = buildStructuredPrompt(structuredInput, { tone, includeEmojis, includeHashtags, targetAudience });
  } else if (mode === 'ai' && aiPrompt) {
    userPrompt = buildAIPrompt(aiPrompt, { tone, includeEmojis, includeHashtags, targetAudience });
  } else {
    throw new Error('Invalid options: provide structuredInput for structured mode or aiPrompt for ai mode');
  }

  // Use the AI client with automatic model rotation
  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: LINKEDIN_POST_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 1000,
  });

  const content = result.content;
  
  if (!content) {
    throw new Error('Failed to generate content');
  }

  return content.trim();
}

function buildStructuredPrompt(
  input: StructuredInput,
  options: { tone?: string; includeEmojis?: boolean; includeHashtags?: boolean; targetAudience?: string }
): string {
  const parts: string[] = [
    'Write a LinkedIn post based on the following information. Remember to write as a first-person builder sharing their work, NOT as a company announcement:',
    '',
  ];

  if (input.title) {
    parts.push(`**Project/Topic:** ${input.title}`);
  }
  if (input.problem) {
    parts.push(`**Problem being solved:** ${input.problem}`);
  }
  if (input.solution) {
    parts.push(`**Solution/Approach:** ${input.solution}`);
  }
  if (input.tech && input.tech.length > 0) {
    parts.push(`**Technologies used:** ${input.tech.join(', ')}`);
  }
  if (input.outcome) {
    parts.push(`**Outcome/Result:** ${input.outcome}`);
  }
  if (input.cta) {
    parts.push(`**Discussion topic:** ${input.cta}`);
  }

  // Handle custom fields
  if (input.customFields) {
    for (const [key, value] of Object.entries(input.customFields)) {
      parts.push(`**${key}:** ${value}`);
    }
  }

  parts.push('');
  parts.push(`**Tone:** ${options.tone || 'professional'}`);
  
  if (options.targetAudience) {
    parts.push(`**Target audience:** ${options.targetAudience}`);
  }

  parts.push('');
  parts.push('Requirements:');
  parts.push('- Keep under 1200 characters (aim for 900-1100)');
  parts.push('- Write as "I built/created/explored" NOT "We are excited to announce"');
  parts.push('- AVOID marketing words: empowering, revolutionizing, seamlessly, comprehensively');
  parts.push(`- ${options.includeEmojis ? 'Use 0-1 emoji only (trust-sensitive topic)' : 'Do not include emojis'}`);
  parts.push(`- ${options.includeHashtags ? 'End with 3-5 relevant hashtags' : 'Do not include hashtags'}`);
  parts.push('- End with a specific, thoughtful question (not "What do you think?")');
  parts.push('- Include honest disclaimer if this is a POC/early-stage - builds trust');
  parts.push('- Focus on what makes it INTERESTING, not a feature list');
  parts.push('- NEVER use em dashes (—). Use commas, periods, or the word "and" instead');
  parts.push('- NEVER use "not just X, but Y". Use simpler phrasing.');
  parts.push('- Use contractions naturally (don\'t, it\'s, that\'s)');
  parts.push('- Vary sentence length. Short sentences are good. Mix them with longer ones.');

  return parts.join('\n');
}

function buildAIPrompt(
  prompt: string,
  options: { tone?: string; includeEmojis?: boolean; includeHashtags?: boolean; targetAudience?: string }
): string {
  const parts: string[] = [
    'Write a LinkedIn post about the following topic/context. Write as a first-person professional sharing insights or work, NOT as a company:',
    '',
    prompt,
    '',
    `**Tone:** ${options.tone || 'professional'}`,
  ];

  if (options.targetAudience) {
    parts.push(`**Target audience:** ${options.targetAudience}`);
  }

  parts.push('');
  parts.push('Requirements:');
  parts.push('- Keep under 1200 characters (aim for 900-1100)');
  parts.push('- Start with a strong hook - a belief, observation, or problem statement');
  parts.push('- Write as "I" not "We" - sound like a real builder');
  parts.push('- AVOID: empowering, revolutionizing, seamlessly, game-changing, thrilled');
  parts.push(`- ${options.includeEmojis ? 'Use 0-1 emoji max (less is more for credibility)' : 'Do not include emojis'}`);
  parts.push(`- ${options.includeHashtags ? 'End with 3-5 relevant hashtags' : 'Do not include hashtags'}`);
  parts.push('- End with a specific question that invites thoughtful discussion');
  parts.push('- Be honest about limitations or early-stage nature if relevant');
  parts.push('- Focus on what makes it INTERESTING, not hype');
  parts.push('- NEVER use em dashes (—). Use commas, periods, or the word "and" instead');
  parts.push('- NEVER use "not just X, but Y". Use simpler phrasing.');
  parts.push('- Use contractions naturally (don\'t, it\'s, that\'s)');
  parts.push('- Vary sentence length. Short sentences are good. Mix them with longer ones.');

  return parts.join('\n');
}

export async function improvePost(content: string, instructions: string): Promise<string> {
  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: LINKEDIN_POST_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Improve the following LinkedIn post based on these instructions: "${instructions}"

Original post:
${content}

Please provide the improved version only, without any explanations.`,
      },
    ],
    temperature: 0.7,
    maxTokens: 1000,
  });

  const improvedContent = result.content;
  
  if (!improvedContent) {
    throw new Error('Failed to improve content');
  }

  return improvedContent.trim();
}

// ============================================
// Page Strategy-Based Content Generation
// ============================================

const POST_ANGLE_DESCRIPTIONS: Record<string, string> = {
  problem_recognition: 'Focus on identifying and articulating a problem your audience faces. Make them feel seen and understood.',
  war_story: 'Share a personal experience or lesson learned from building/working. Be specific and honest about what happened.',
  opinionated_take: 'Take a strong stance on something in your industry. Be specific and back it up with reasoning.',
  insight: 'Share a useful observation or tip that your audience might not have considered. Be educational.',
  how_to: 'Provide a step-by-step approach or framework for solving a problem. Be practical and actionable.',
  case_study: 'Share a specific example with real results. Include numbers or concrete outcomes where possible.',
};

// Get angle descriptions adjusted for page type - emphasizing STORIES
function getAngleDescription(angle: string, pageType: PageVoiceType = 'personal'): string {
  const isOrg = pageType === 'organization';
  const we = isOrg ? 'we' : 'I';
  const our = isOrg ? 'our' : 'my';
  const angleDescriptions: Record<string, string> = {
    problem_recognition: `Teach about a common problem in the industry. Explain the symptoms, why it happens, and what to watch for. Educational focus - no invented client examples.`,
    war_story: `Share educational insights and lessons. Focus on principles and takeaways, NOT invented stories with fake dates or scenarios. Teach what ${we} learned.`,
    opinionated_take: `Educate through a strong stance on an industry practice. "${isOrg ? 'We believe' : 'I believe'} X is wrong because..." Explain the reasoning with logic, not fabricated examples.`,
    insight: `Teach ONE non-obvious insight about the industry or craft. Lead with the counterintuitive part. "Everyone thinks X, but actually Y..." Pure education, no invented data.`,
    how_to: `Teach a specific approach or technique step-by-step. Be practical and actionable. Educational guide format. Only use real numbers if you have them.`,
    case_study: `Educational analysis of real-world patterns. NEVER invent client names, costs, or metrics. If you don't have real data, switch to insight or how_to instead.`,
  };
  return angleDescriptions[angle] || `Share educational knowledge and insights. Never fabricate. Teach real principles and methods.`;
}

/**
 * Generate a post using a page's content strategy
 * Now supports platform-specific character limits
 */
export async function generatePostWithStrategy(options: GenerateWithStrategyOptions): Promise<{
  content: string;
  angle: string;
  topic: string;
}> {
  const { strategy, topic, angle, inspiration, pageId, platform } = options;
  
  // Determine the voice type based on page type
  const pageType = strategy.pageType || 'personal';
  const isOrganization = pageType === 'organization';

  // Get platform config for character limits
  const targetPlatform = platform || 'linkedin';
  const platformConfig = PLATFORM_CONFIGS[targetPlatform];
  
  // Platform-specific character guidance
  const getCharacterGuidance = (platform: PlatformType): string => {
    switch (platform) {
      case 'twitter':
        return `CRITICAL TWITTER CONSTRAINT: ABSOLUTE MAXIMUM is 280 characters. That includes ALL text, hashtags, spaces, everything. TARGET LENGTH is 200 to 250 characters total. COUNT EVERY CHARACTER because this will be REJECTED if you go over 280. Make every single word count. Be CONCISE and PUNCHY. Use one to two hashtags max (they count toward the 280 limit). No long storytelling. Get to the point FAST.`;
      case 'linkedin':
        return 'Keep under 1500 characters (aim for 800-1200). Longer form is okay for storytelling.';
      case 'facebook':
        return 'Keep under 500 characters for optimal engagement. Short and shareable works best.';
      case 'instagram':
        return 'Caption can be up to 2200 chars, but front-load value in first 125 chars (before "more" cutoff).';
      default:
        return `Maximum ${platformConfig.maxCharacters} characters.`;
    }
  };

  // Get topics and angles with defaults for safety
  const topics = strategy.topics || [];
  
  // Use preferred angles from strategy, or defaults
  const preferredAngles = strategy.preferredAngles || ['war_story', 'insight', 'how_to', 'opinionated_take', 'case_study'];

  // Pick a random topic if not specified
  const selectedTopic = topic || (topics.length > 0 
    ? topics[Math.floor(Math.random() * topics.length)] 
    : 'general industry insights');

  // Pick a random angle if not specified
  const selectedAngle = angle && preferredAngles.includes(angle) 
    ? angle 
    : preferredAngles[Math.floor(Math.random() * preferredAngles.length)];

  const angleDescription = getAngleDescription(selectedAngle, pageType);

  const parts: string[] = [
    `## PLATFORM: ${platformConfig.name.toUpperCase()}`,
    `## CHARACTER LIMIT: ${getCharacterGuidance(targetPlatform)}`,
    '',
    '## WRITE A POST ABOUT:',
    selectedTopic,
    '',
    '## ANGLE TO USE:',
    `${selectedAngle}: ${angleDescription}`,
    '',
    '## BRAND VOICE:',
    strategy.persona || 'Professional, helpful, knowledgeable',
    '',
    '## TARGET AUDIENCE:',
    strategy.targetAudience || 'Professionals in the industry',
  ];

  // Fetch learning insights if pageId is provided
  if (pageId && platform) {
    try {
      const learningInsights = await getPerformanceInsightsForAI(pageId, platform, 30);
      if (learningInsights && learningInsights.trim()) {
        parts.push('');
        parts.push('## LEARN FROM PAST PERFORMANCE:');
        parts.push(learningInsights);
      }
    } catch (error) {
      console.warn('Could not fetch learning insights:', error);
      // Continue without learning insights - not critical
    }
  }

  if (inspiration) {
    parts.push('');
    parts.push('## USE THIS AS INSPIRATION (adapt, don\'t copy):');
    parts.push(inspiration);
  }

  if (strategy.avoidTopics && strategy.avoidTopics.length > 0) {
    parts.push('');
    parts.push('## DO NOT MENTION:');
    parts.push(strategy.avoidTopics.join(', '));
  }

  if (strategy.customInstructions) {
    parts.push('');
    parts.push('## SPECIAL INSTRUCTIONS:');
    parts.push(strategy.customInstructions);
  }

  parts.push('');
  parts.push('CRITICAL GUIDELINES:');
  parts.push('- Share insights, lessons, and frameworks based on real experience');
  parts.push('- If you reference work/projects, keep it general (e.g., "while building APIs" not "for Client X")');
  parts.push('- Focus on educational value: what you learned, what worked, what didn\'t');
  parts.push('- NO fabricated client names, companies, or specific metrics you didn\'t actually measure');
  parts.push('- Be authentic: share YOUR perspective, lessons, and opinions');
  parts.push('- It\'s better to say "in my experience" than invent a fake client story');

  const userPrompt = parts.join('\n');
  
  // Use the appropriate system prompt based on platform and page type
  const systemPrompt = targetPlatform === 'linkedin' 
    ? getLinkedInSystemPrompt(pageType)
    : PLATFORM_SYSTEM_PROMPTS[targetPlatform];

  // Retry logic for when models output only thinking tags or garbage
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8 + (attempt - 1) * 0.05, // Slightly increase temp on retries
        maxTokens: targetPlatform === 'twitter' ? 350 : 2000,
      });

      const content = result.content;

      if (!content) {
        throw new Error('Failed to generate content - empty response');
      }

      // Strip out <think> tags that some models output (internal reasoning)
      let cleanedContent = content.trim();
      cleanedContent = cleanedContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      
      // Also handle unclosed <think> tags
      cleanedContent = cleanedContent.replace(/<think>[\s\S]*/gi, '').trim();
      
      // Strip meta-commentary that AI sometimes adds (everything after --- or similar)
      cleanedContent = cleanedContent.split(/\n---+\n/)[0].trim();
      cleanedContent = cleanedContent.split(/\n={3,}\n/)[0].trim();
      
      // Remove introductory phrases AI adds (safety net only)
      cleanedContent = cleanedContent.replace(/^Here's (a|the|an|my) (LinkedIn|Facebook|Twitter|Instagram) (post|tweet|caption).*?:\s*\n*/i, '');
      cleanedContent = cleanedContent.replace(/^Based on (the|your) (provided )?(content|guidelines|instructions).*?:\s*\n*/i, '');
      cleanedContent = cleanedContent.replace(/^(Here is|Here's) (what I|a post|the post|my).*?:\s*\n*/i, '');
      cleanedContent = cleanedContent.replace(/^(I've created|I wrote|I generated|Here's my take).*?:\s*\n*/i, '');
      
      // Remove quotes around the entire post (some models do this)
      cleanedContent = cleanedContent.replace(/^[""][\s\S]*[""]$/g, (match) => {
        return match.slice(1, -1);
      }).trim();
      cleanedContent = cleanedContent.replace(/^"[\s\S]*"$/g, (match) => {
        return match.slice(1, -1);
      }).trim();
      
      // Remove markdown bold/italic formatting (platforms don't render it)
      cleanedContent = cleanedContent.replace(/\*\*([^*]+)\*\*/g, '$1');
      cleanedContent = cleanedContent.replace(/__([^_]+)__/g, '$1');
      cleanedContent = cleanedContent.replace(/\*([^*]+)\*/g, '$1');
      
      if (!cleanedContent || cleanedContent.length < 50) {
        throw new Error(`Content too short or empty after cleanup (${cleanedContent?.length || 0} chars) - likely only thinking tags`);
      }

      let trimmedContent = cleanedContent;
      
      // Critical validation for Twitter character limit
      if (targetPlatform === 'twitter' && trimmedContent.length > 280) {
        console.warn(`[Content Generation] Twitter post too long (${trimmedContent.length} chars), attempting smart truncation`);
        
        // First, try to find a good cut point
        let cutContent = trimmedContent;
        
        // Remove hashtags temporarily to see core content length
        const hashtagMatch = cutContent.match(/(\\s*#\\w+)+$/);
        const hashtags = hashtagMatch ? hashtagMatch[0] : '';
        const coreContent = hashtagMatch ? cutContent.slice(0, -hashtags.length).trim() : cutContent;
        
        // Target: 250 chars for content + ~25 for hashtags
        const targetLength = hashtags ? 250 : 277;
        
        if (coreContent.length > targetLength) {
          // Find last complete sentence before target
          const truncated = coreContent.substring(0, targetLength);
          const lastPeriod = truncated.lastIndexOf('.');
          const lastSpace = truncated.lastIndexOf(' ');
          
          if (lastPeriod > targetLength - 80) {
            // Good sentence break found
            cutContent = coreContent.substring(0, lastPeriod + 1).trim();
          } else if (lastSpace > targetLength - 50) {
            // Word break
            cutContent = coreContent.substring(0, lastSpace).trim() + '...';
          } else {
            // Hard cut
            cutContent = truncated.trim() + '...';
          }
        } else {
          cutContent = coreContent;
        }
        
        // Re-add hashtags if they fit
        if (hashtags && (cutContent.length + hashtags.length) <= 280) {
          cutContent = cutContent + hashtags;
        } else if (cutContent.length < 265) {
          // Add minimal hashtags
          cutContent = cutContent + ' #Tech';
        }
        
        trimmedContent = cutContent;
        
        // Final check - if still over, hard truncate
        if (trimmedContent.length > 280) {
          trimmedContent = trimmedContent.substring(0, 277).trim() + '...';
        }
        
        console.log(`[Content Generation] Twitter post truncated to ${trimmedContent.length} chars`);
      }

      return {
        content: trimmedContent,
        angle: selectedAngle,
        topic: selectedTopic,
      };
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Content Generation] Attempt ${attempt}/${MAX_RETRIES} failed for ${targetPlatform}: ${lastError.message}`);
      
      if (attempt < MAX_RETRIES) {
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  
  // All retries failed
  throw lastError || new Error('Failed to generate content after all retries');
}

// ============================================
// Engagement AI - Comment & Reply Generation
// ============================================

const ENGAGEMENT_SYSTEM_PROMPT = `You write authentic, engaging LinkedIn comments and replies. You sound like a thoughtful professional who genuinely engages with content.

Be authentic and specific. Reference specific points from the post or comment you're responding to. Add genuine value or perspective. Never use generic phrases like "Great post!" or "Love this!" Sound like a real person not a bot.

Keep it concise. Comments should be 50 to 150 characters ideal, max 280. Replies should be 30 to 100 characters ideal, max 200. One clear thought per comment.

Add value by sharing a related experience or insight. Ask a thoughtful follow up question. Offer a complementary perspective. Acknowledge a specific point that resonated.

Never use empty flattery like "Amazing!" or "So inspiring!". No self-promotion or links. Overusing emojis looks desperate. Zero to one max. No corporate speak or buzzwords. Don't start with "I" every time. Avoid phrases like "couldn't agree more" or "this resonates".

Match the tone. Professional posts get professional comments. Casual posts get more relaxed comments. Technical posts get technical engagement. Personal stories get empathetic responses.

Use contractions. That's, don't, it's. Vary your sentence structure. Write how you'd actually talk to a colleague. Don't overexplain.`;

export type EngagementStyle = 'professional' | 'casual' | 'friendly' | 'thoughtful';

export interface GenerateCommentOptions {
  postContent: string;
  postAuthor?: string;
  style?: EngagementStyle;
  context?: string; // Additional context about the user/relationship
}

export interface GenerateReplyOptions {
  originalPostContent: string;
  commentText: string;
  commenterName: string;
  style?: EngagementStyle;
  context?: string;
}

/**
 * Generate an authentic comment for a LinkedIn post
 */
export async function generateComment(options: GenerateCommentOptions): Promise<string> {
  const { postContent, postAuthor, style = 'professional', context } = options;

  const styleGuide = {
    professional: 'Write in a professional but warm tone. Focus on insights and substance.',
    casual: 'Write in a relaxed, conversational tone. Be friendly but still add value.',
    friendly: 'Write in a warm, supportive tone. Show genuine interest and encouragement.',
    thoughtful: 'Write in a reflective, thoughtful tone. Ask deeper questions or share nuanced perspectives.',
  };

  const userPrompt = `Write a LinkedIn comment for this post:

---
${postAuthor ? `Author: ${postAuthor}\n` : ''}Post:
${postContent}
---

${context ? `Context: ${context}\n` : ''}
Style: ${styleGuide[style]}

Keep it 50 to 150 characters. Short and punchy. Be specific and reference something from the post. Add value or a perspective don't just compliment. Use zero to one emoji max. Sound natural and human. Don't start with "Great post" or similar.

Return ONLY the comment text, nothing else.`;

  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: ENGAGEMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    maxTokens: 200,
    preferFast: true,  // Use faster models for short comments
  });

  const comment = result.content;

  if (!comment) {
    throw new Error('Failed to generate comment');
  }

  return comment.trim();
}

/**
 * Generate a reply to a comment on your LinkedIn post
 */
export async function generateReply(options: GenerateReplyOptions): Promise<string> {
  const { originalPostContent, commentText, commenterName, style = 'professional', context } = options;

  const styleGuide = {
    professional: 'Reply professionally but warmly. Acknowledge their point and add value.',
    casual: 'Reply in a relaxed, conversational way. Be friendly and approachable.',
    friendly: 'Reply warmly and supportively. Show appreciation for their engagement.',
    thoughtful: 'Reply thoughtfully. Address their specific point and expand on it.',
  };

  const userPrompt = `Write a reply to this comment on your LinkedIn post:

---
Your original post:
${originalPostContent}

Comment from ${commenterName}:
"${commentText}"
---

${context ? `Context: ${context}\n` : ''}
Style: ${styleGuide[style]}

Keep it 30 to 100 characters. Brief and personal. Address them naturally. You can use their first name. Acknowledge their specific point. Don't overdo the gratitude. Use zero to one emoji max. Sound like a real person responding.

Return ONLY the reply text, nothing else.`;

  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: ENGAGEMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    maxTokens: 150,
    preferFast: true,
  });

  const reply = result.content;

  if (!reply) {
    throw new Error('Failed to generate reply');
  }

  return reply.trim();
}

/**
 * Generate multiple comment variations for user to choose from
 */
export async function generateCommentVariations(
  options: GenerateCommentOptions,
  count: number = 3
): Promise<string[]> {
  const { postContent, postAuthor, style = 'professional', context } = options;

  const styleGuide = {
    professional: 'professional but warm',
    casual: 'relaxed and conversational',
    friendly: 'warm and supportive',
    thoughtful: 'reflective and insightful',
  };

  const userPrompt = `Generate ${count} different LinkedIn comment options for this post:

---
${postAuthor ? `Author: ${postAuthor}\n` : ''}Post:
${postContent}
---

${context ? `Context: ${context}\n` : ''}
Tone: ${styleGuide[style]}

Each comment should be 50 to 150 characters. Be specific to the post content. Add value don't just compliment. Zero to one emoji max. Sound natural and human.

Return ONLY the ${count} comments, each on its own line, numbered 1 to ${count}. No other text.`;

  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: ENGAGEMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.9,
    maxTokens: 500,
    preferFast: true,
  });

  const content = result.content;

  if (!content) {
    throw new Error('Failed to generate comments');
  }

  // Parse numbered list
  const comments = content
    .split('\n')
    .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(line => line.length > 0);

  return comments.slice(0, count);
}

// ============================================
// AI Analysis & Scoring System
// ============================================

import type { AIAnalysis, PostAngle, RiskLevel } from './models/Post';

// Re-export types for external use
export type { PostAngle, RiskLevel };

const ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing LinkedIn content for engagement potential and risk assessment. You provide structured analysis in JSON format.

Risk Levels:
- LOW: Proven themes, educational content, no controversy, safe insights
- MEDIUM: Opinion-based, links to external pages, personal stories
- HIGH: Strong opinions, controversial takes, new narratives, criticism

Post Angles:
- problem_recognition: Posts that highlight problems founders face
- war_story: Personal experiences, lessons learned, failures
- opinionated_take: Strong stance on industry topics
- insight: Educational insights, tips, observations
- how_to: Step-by-step guides, tutorials
- case_study: Specific examples with results`;

export interface PostAnalysis extends AIAnalysis {
  suggestedImprovements?: string[];
  alternativeAngles?: string[];
}

/**
 * Analyze a post for confidence, risk, and engagement potential
 */
export async function analyzePost(content: string, includesLink: boolean = false): Promise<PostAnalysis> {
  const userPrompt = `Analyze this LinkedIn post and return a JSON object:

Post:
"""
${content}
"""

Post includes external link: ${includesLink}

Return ONLY valid JSON with this structure:
{
  "confidence": <number 0-1, how likely this will perform well>,
  "riskLevel": "<low|medium|high>",
  "riskReasons": ["<reason1>", "<reason2>"],
  "angle": "<problem_recognition|war_story|opinionated_take|insight|how_to|case_study>",
  "estimatedEngagement": "<low|medium|high>",
  "suggestedTiming": "<best posting time suggestion>",
  "aiReasoning": "<one sentence explaining the confidence score>",
  "suggestedImprovements": ["<improvement1>", "<improvement2>"],
  "alternativeAngles": ["<angle1>", "<angle2>"]
}`;

  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 500,
    preferFast: true,
  });

  const responseContent = result.content;

  if (!responseContent) {
    throw new Error('Failed to analyze post');
  }

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]) as PostAnalysis;
  } catch {
    // Return default analysis if parsing fails
    return {
      confidence: 0.5,
      riskLevel: 'medium',
      riskReasons: ['Could not analyze'],
      angle: 'insight',
      estimatedEngagement: 'medium',
      aiReasoning: 'Analysis unavailable',
    };
  }
}

/**
 * Determine if a post requires human approval based on analysis
 */
export function requiresApproval(analysis: AIAnalysis, includesLink: boolean): boolean {
  // Always require approval for:
  // 1. High risk posts
  // 2. Posts with links (per system.md: only 1 in 3 should have links)
  // 3. Low confidence posts
  // 4. Opinionated takes
  
  if (analysis.riskLevel === 'high') return true;
  if (includesLink) return true;
  if (analysis.confidence < 0.7) return true;
  if (analysis.angle === 'opinionated_take') return true;
  
  return false;
}

// ============================================
// Blog Analyzer & Repurposing
// ============================================

const BLOG_ANALYZER_PROMPT = `You are an expert at extracting LinkedIn post angles from blog content. You identify key insights that can be repurposed into multiple engaging posts.

Your job is to:
1. Identify the core insights and takeaways
2. Generate multiple post angles (problem recognition, war stories, opinionated takes, how-tos)
3. Each angle should be a different perspective on the same content
4. Focus on what would resonate with founders and decision-makers`;

export interface BlogAnalysis {
  title: string;
  summary: string;
  keyInsights: string[];
  postAngles: {
    angle: PostAngle;
    hook: string;
    outline: string;
  }[];
  suggestedPostCount: number;
}

/**
 * Analyze a blog post and extract multiple LinkedIn post angles
 */
export async function analyzeBlog(blogContent: string, blogUrl?: string): Promise<BlogAnalysis> {
  const userPrompt = `Analyze this blog content and extract LinkedIn post opportunities:

${blogUrl ? `URL: ${blogUrl}\n` : ''}
Content:
"""
${blogContent.slice(0, 8000)} ${blogContent.length > 8000 ? '... [truncated]' : ''}
"""

Return ONLY valid JSON:
{
  "title": "<detected blog title>",
  "summary": "<2-3 sentence summary>",
  "keyInsights": ["<insight1>", "<insight2>", "<insight3>"],
  "postAngles": [
    {
      "angle": "<problem_recognition|war_story|opinionated_take|insight|how_to|case_study>",
      "hook": "<compelling opening line for this angle>",
      "outline": "<brief outline of what this post would cover>"
    }
  ],
  "suggestedPostCount": <recommended number of posts from this blog, usually 2-4>
}`;

  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: BLOG_ANALYZER_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    maxTokens: 1500,
  });

  const responseContent = result.content;

  if (!responseContent) {
    throw new Error('Failed to analyze blog');
  }

  try {
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]) as BlogAnalysis;
  } catch {
    throw new Error('Failed to parse blog analysis');
  }
}

/**
 * Generate a LinkedIn post from a specific blog angle
 */
export async function generatePostFromBlogAngle(
  blogContent: string,
  angle: PostAngle,
  hook: string,
  outline: string,
  options: {
    includeLink?: boolean;
    linkUrl?: string;
    tone?: 'professional' | 'casual' | 'inspirational' | 'educational';
  } = {}
): Promise<{ content: string; analysis: PostAnalysis }> {
  const { includeLink = false, linkUrl, tone = 'professional' } = options;

  const userPrompt = `Write a LinkedIn post based on this blog content, using the specified angle:

Blog content (for context):
"""
${blogContent.slice(0, 4000)}
"""

Post angle: ${angle}
Hook to use: "${hook}"
Outline: ${outline}
Tone: ${tone}
${includeLink && linkUrl ? `Include this link naturally: ${linkUrl}` : 'Do NOT include any links'}

Requirements:
- Start with or build from the provided hook
- Keep under 1200 characters (aim for 900-1100)
- Write as "I" - a builder sharing insights
- End with a specific question for discussion
- AVOID: empowering, revolutionizing, seamlessly, game-changing
- Use 0-1 emoji max
- Add 3-5 relevant hashtags at the end

Return ONLY the post content, nothing else.`;

  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: LINKEDIN_POST_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 1000,
  });

  const content = result.content;

  if (!content) {
    throw new Error('Failed to generate post from blog');
  }

  const postContent = content.trim();
  const analysis = await analyzePost(postContent, includeLink);

  return { content: postContent, analysis };
}

// ============================================
// Enhanced Post Generation with Analysis
// ============================================

export interface GeneratePostWithAnalysisOptions extends GeneratePostOptions {
  includeLink?: boolean;
  linkUrl?: string;
}

export interface GeneratedPostWithAnalysis {
  content: string;
  analysis: PostAnalysis;
  requiresApproval: boolean;
}

/**
 * Generate a LinkedIn post with automatic analysis and approval determination
 */
export async function generateLinkedInPostWithAnalysis(
  options: GeneratePostWithAnalysisOptions
): Promise<GeneratedPostWithAnalysis> {
  const { includeLink = false } = options;
  
  // Generate the post
  const content = await generateLinkedInPost(options);
  
  // Analyze it
  const analysis = await analyzePost(content, includeLink);
  
  // Determine if approval is needed
  const needsApproval = requiresApproval(analysis, includeLink);
  
  return {
    content,
    analysis,
    requiresApproval: needsApproval,
  };
}

// ============================================
// Multi-Platform Content Adaptation
// ============================================

import { PlatformType, PLATFORM_CONFIGS } from './platforms/types';

const PLATFORM_SYSTEM_PROMPTS: Record<PlatformType, string> = {
  linkedin: LINKEDIN_POST_SYSTEM_PROMPT,
  
  facebook: `You write Facebook posts that sound human and conversational.

⚠️ CRITICAL RULES - VIOLATION = INSTANT REJECTION:
1. NO emojis. Not one. Zero. None. 🚫❌ = REJECTED
2. NO hashtags. Facebook doesn't use them. #anything = REJECTED  
3. NO introductions like "Here's a post..." - just write the post
4. NO "What do you think?" or "Share your thoughts" - be specific
5. Return ONLY the post content itself
6. NEVER FABRICATE: No invented clients, fake metrics, made-up scenarios with dates, or fictional dollar amounts. Teach principles, not fake stories.

CHARACTER LIMIT: 300-500 characters ideal. Max 1000.

HOW TO SOUND HUMAN

Write like you're texting a friend. Casual but not sloppy.

GOOD OPENERS (specific, story-based):
"Just learned something the hard way."
"Deleted half our code today. Here's what happened:"
"Everyone said we needed X. We did Y instead."

BAD OPENERS (AI tells - NEVER USE):
"In today's fast-paced world..."
"We're excited to announce..."
"Did you know that..."
"Tired of X?" (clickbait)

STRUCTURE:
Line 1: Hook with something relatable or surprising
Line 2-4: Quick story or insight (2-3 short sentences)
Line 5: Specific question about THEIR experience

BANNED WORDS (never use):
Game-changer, Transformative, Revolutionary, Leverage, Utilize, Optimize
Mindset change, Paradigm shift, Best practices, Synergy, Unlock, Powerful

BANNED CLOSINGS (never use):
"What do you think?"
"Share your story below!"
"Let me know in the comments!"
Instead ask: "What's the biggest X you've dealt with?" (specific)

USE: Contractions (don't, it's, we're), simple words, short sentences
AVOID: Corporate speak, perfect grammar, fancy words, ANY emojis, ANY hashtags

Be specific: "Saved 40 hours last week" not "saved time"
Be direct: Cut fluff. Get to the point.
Be real: Share what actually happened.`,

  twitter: `You write tweets that sound like a smart human.

⚠️ CRITICAL RULES - VIOLATION = INSTANT REJECTION:
1. MAXIMUM 280 characters (including spaces, hashtags, EVERYTHING)
2. NO markdown (**bold**, __italic__) - Twitter is plain text
3. NO introductions - just write the tweet
4. MUST include 1-2 hashtags at the end
5. Return ONLY the tweet content itself
6. NEVER FABRICATE: No invented clients, fake metrics, or made-up scenarios. Share real lessons only.

CHARACTER COUNT: Aim for 220-260 characters total. NEVER exceed 280.

HOW TO WRITE HUMAN TWEETS

One idea. Sharp and specific. Start with a NUMBER or OUTCOME.

GOOD OPENERS (specific, punchy):
"Hired cheap devs. Spent 3x fixing broken code."
"Deleted 15k lines. Shipped 3x faster."
"3 years building. Still not profitable."
"Client wanted features. We fixed bugs first."

BAD OPENERS (AI tells - NEVER USE):
"Focusing on X often leads to Y"
"In today's fast-paced world..."
"Many startups make the mistake of..."
"It's important to remember that..."
"To ship faster, do X" (generic advice)

STRUCTURE:
Hook: Lead with NUMBER or SPECIFIC OUTCOME (1 line)
Context: What happened (1-2 SHORT lines)  
Hashtags: 1-2 at the end

BANNED WORDS:
Game-changer, Transformative, Revolutionary, Leverage, Utilize, Optimize
Prioritize, Mindset change, Paradigm shift, Best practices

BANNED PATTERNS:
"X often leads to Y. Focus on Z instead." (formulaic)
"Don't trade short-term X for long-term Y" (cliché)
"It's a mindset change" (vague)

WRITING RULES:
• Start with YOUR specific story or number, NOT generic advice
• Short sentences. Fragments work.
• Use real numbers: "6 weeks", "3x", "$40k"
• Contractions: don't, won't, it's
• Be opinionated. Mild takes get ignored.

HASHTAGS: Include 1-2 relevant hashtags at end. Example: #SaaS #TechDebt
They COUNT toward your 280 character limit.

NO emojis (or max 1). NO formatting. Plain text only.`,

  instagram: `You write Instagram captions that feel authentic and personal. Front-load value in first 125 characters (before "more").

INSTAGRAM HUMAN WRITING

First line hooks them. Rest tells the story. Close with engagement.

STRUCTURE:

Line 1 (under 125 chars): Stop the scroll
"Spent 6 months building the wrong thing."
"Here's what nobody tells you about MVPs."

Lines 2-10: The story or lesson (keep paragraphs short)
Use line breaks. Make it scannable.
Be personal. Show the behind-the-scenes.
Share what you learned.

Last line: Call to action or question
"Save this if you're building an MVP"
"What's the biggest lesson you learned building v1?"

VOICE:

- Conversational, like texting
- Personal but professional
- Simple words, clear ideas
- Short paragraphs (2-3 lines max)
- Natural rhythm

EMOJIS & HASHTAGS:
- Emojis: 2-4 max (don't overdo it)
- Hashtags: 5-10 REQUIRED at the end
- Mix popular and niche tags
- Research what's working in your industry
- Include them in the caption (not first comment)

Example hashtag section:

#SaaS #Startups #ProductDevelopment #TechFounders #EntrepreneurLife #StartupJourney #BuildInPublic #SoftwareEngineering #MVPDevelopment #TechLeadership

Total length: 150-500 characters ideal. Max 2200 (including hashtags).

BANNED WORDS (never use):
Game-changer, Transformative, Revolutionary, Leverage, Utilize, Optimize
Mindset change, Paradigm shift, Best practices, Synergy

⛔ NEVER FABRICATE:
- No invented client names or company names
- No made-up metrics ("increased X by 340%")
- No fake scenarios with specific dates
- No fictional dollar amounts
- Share principles and lessons, not fake case studies

Be real. Be specific. Be helpful. Don't sound like a brand.
Return ONLY the caption - no explanations or meta-commentary.`,
};

export interface AdaptedContent {
  platform: PlatformType;
  content: string;
  hashtags: string[];
  charCount: number;
  adaptedAt: Date;
}

export interface AdaptContentOptions {
  originalContent: string;
  targetPlatform: PlatformType;
  preserveHashtags?: boolean; // Keep original hashtags or adapt them
  customInstructions?: string;
}

/**
 * Adapt content from one platform format to another
 */
export async function adaptContentForPlatform(
  options: AdaptContentOptions
): Promise<AdaptedContent> {
  const { originalContent, targetPlatform, preserveHashtags = false, customInstructions } = options;
  
  const platformConfig = PLATFORM_CONFIGS[targetPlatform];
  const systemPrompt = PLATFORM_SYSTEM_PROMPTS[targetPlatform];
  
  // Platform-specific strict limits for the prompt
  const getStrictLimitWarning = (platform: PlatformType): string => {
    if (platform === 'twitter') {
      return '⚠️ CRITICAL: Twitter has a STRICT 280 character limit. Your response MUST be under 280 characters total including hashtags. Aim for 200-250 characters.';
    }
    return '';
  };
  
  const parts: string[] = [
    'Adapt the following content for ' + targetPlatform.charAt(0).toUpperCase() + targetPlatform.slice(1) + ':',
    '',
  ];
  
  const strictWarning = getStrictLimitWarning(targetPlatform);
  if (strictWarning) {
    parts.push(strictWarning);
    parts.push('');
  }
  
  parts.push('## Original Content:');
  parts.push(originalContent);
  parts.push('');
  parts.push('## Platform Requirements:');
  parts.push(`- Maximum ${platformConfig.maxCharacters} characters${targetPlatform === 'twitter' ? ' (STRICT - will be rejected if over)' : ''}`);
  parts.push(`- Hashtag strategy: ${platformConfig.hashtagStrategy} (${platformConfig.recommendedHashtags.min}-${platformConfig.recommendedHashtags.max} hashtags)`);
  parts.push(`- Tone: ${platformConfig.tonePreference}`);
  parts.push('');
  parts.push('## Instructions:');
  parts.push('- Maintain the core message and insights');
  parts.push('- Adapt the tone and style for ' + targetPlatform);
  parts.push('- Adjust length appropriately');
  parts.push(preserveHashtags ? '- Keep the same hashtags from the original' : '- Create platform-appropriate hashtags');
  parts.push('- Make it feel native to ' + targetPlatform + ', not cross-posted');
  
  if (customInstructions) {
    parts.push('');
    parts.push('## Additional Instructions:');
    parts.push(customInstructions);
  }
  
  parts.push('');
  parts.push('Return ONLY the adapted content, nothing else.');
  
  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: parts.join('\n') },
    ],
    temperature: 0.7,
    maxTokens: Math.min(platformConfig.maxCharacters * 2, 2000),
  });
  
  const content = result.content;
  
  if (!content) {
    throw new Error('Failed to adapt content for ' + targetPlatform);
  }
  
  const adaptedContent = content.trim();
  
  // Extract hashtags from the adapted content
  const hashtagRegex = /#[\w]+/g;
  const hashtags = adaptedContent.match(hashtagRegex) || [];
  
  return {
    platform: targetPlatform,
    content: adaptedContent,
    hashtags,
    charCount: adaptedContent.length,
    adaptedAt: new Date(),
  };
}

/**
 * Adapt content for multiple platforms at once
 */
export async function adaptContentForMultiplePlatforms(
  originalContent: string,
  targetPlatforms: PlatformType[],
  options?: {
    preserveHashtags?: boolean;
    customInstructions?: Record<PlatformType, string>;
  }
): Promise<AdaptedContent[]> {
  const results: AdaptedContent[] = [];
  
  // Process platforms in parallel for efficiency
  const adaptations = await Promise.all(
    targetPlatforms.map(platform =>
      adaptContentForPlatform({
        originalContent,
        targetPlatform: platform,
        preserveHashtags: options?.preserveHashtags,
        customInstructions: options?.customInstructions?.[platform],
      })
    )
  );
  
  return adaptations;
}

export interface GenerateMultiPlatformPostOptions extends GenerateWithStrategyOptions {
  targetPlatforms: PlatformType[];
  primaryPlatform?: PlatformType; // Which platform to optimize for initially
  adaptContent?: boolean; // Whether to adapt for other platforms
}

export interface MultiPlatformPostResult {
  primaryContent: string;
  angle: string;
  topic: string;
  platformVersions: AdaptedContent[];
}

/**
 * Generate a post optimized for one platform and adapted for others
 */
export async function generateMultiPlatformPost(
  options: GenerateMultiPlatformPostOptions
): Promise<MultiPlatformPostResult> {
  const { 
    strategy, 
    topic, 
    angle, 
    inspiration,
    targetPlatforms,
    primaryPlatform = 'linkedin',
    adaptContent = true,
    pageId,
    platform,
  } = options;
  
  // Generate the primary content (default to LinkedIn style)
  const primary = await generatePostWithStrategy({
    strategy,
    topic,
    angle,
    inspiration,
    pageId,
    platform: platform || primaryPlatform,
  });
  
  // If we only have one platform or don't want to adapt, return early
  if (!adaptContent || targetPlatforms.length <= 1) {
    return {
      primaryContent: primary.content,
      angle: primary.angle,
      topic: primary.topic,
      platformVersions: [{
        platform: primaryPlatform,
        content: primary.content,
        hashtags: (primary.content.match(/#[\w]+/g) || []),
        charCount: primary.content.length,
        adaptedAt: new Date(),
      }],
    };
  }
  
  // Adapt for other platforms
  const otherPlatforms = targetPlatforms.filter(p => p !== primaryPlatform);
  const adaptedVersions = await adaptContentForMultiplePlatforms(
    primary.content,
    otherPlatforms
  );
  
  // Add the primary platform version
  const allVersions: AdaptedContent[] = [
    {
      platform: primaryPlatform,
      content: primary.content,
      hashtags: (primary.content.match(/#[\w]+/g) || []),
      charCount: primary.content.length,
      adaptedAt: new Date(),
    },
    ...adaptedVersions,
  ];
  
  return {
    primaryContent: primary.content,
    angle: primary.angle,
    topic: primary.topic,
    platformVersions: allVersions,
  };
}


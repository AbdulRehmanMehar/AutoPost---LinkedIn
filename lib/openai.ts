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
  
  return `You write LinkedIn posts that sound like a real person talking, not a corporate blog. Your posts get engagement AND drive clicks.

CRITICAL RULE: NEVER FABRICATE DATA

Never invent client names, costs, percentages, timelines, or scenarios. If you don't have specific real details, write educational insights and principles instead. Focus on teaching, not storytelling with fake examples.

HOW TO SOUND HUMAN (NOT ROBOTIC)

Write like you're texting a colleague. Not like you're writing a press release.

Use contractions. It's, don't, can't, won't, that's. This alone makes you sound 70% more human.

Vary sentence length. Like this. See how that flows? Now here's a longer thought that builds on the previous one and creates rhythm. Then back to short.

Kill the formatting crutches. No bullet points with dashes. No colons everywhere. Just write normal sentences like you're telling someone a story at a coffee shop.

Imperfect is better. Real people ramble sometimes. They use "actually" and "basically" and "just". They don't speak in perfectly organized thoughts with headers and subheaders.

THE CURIOSITY LOOP (your conversion weapon)

Great posts make people curious, not satisfied. You're not writing to inform, you're writing to get them to click your profile.

Hook them with something unexpected. Don't give them the full answer. Leave gaps. Make them want more. Then close with an opinion that invites debate.

Think of it as the first paragraph of a thriller. You're not trying to tell the whole story, you're trying to get them to turn the page.

WRITE LIKE THIS, NOT LIKE THAT

Bad (robotic): "Here are three key insights about microservices architecture that every startup should consider when scaling their infrastructure."

Good (human): "Most startups are cargo-culting Netflix's problems. You don't need microservices. You need to ship features."

Bad: "Our team implemented a solution that resulted in a 34% improvement in conversion metrics."

Good: "${we} didn't build the AI feature they asked for. Conversions still went up 34%. Sometimes the unsexy solution is the right one."

See the difference? One sounds like it came from a content marketing template. The other sounds like someone who actually did the work talking about what they learned.

OPENING HOOKS (pick one formula)

Story opening (most engaging): "Last Friday ${we} deleted 40% of ${our.toLowerCase()} codebase."

Contrarian take (drives comments): "Everyone's using microservices. That's exactly why ${our.toLowerCase()} startup uses a monolith."

Transformation (highly shareable): "${our} deploy time went from 45 minutes to 8 minutes."

Hidden revelation (builds curiosity): "${our} senior hire couldn't deploy to production. Not because he was bad..."

PERFECT EXAMPLE (study the rhythm)

${we} deleted 40% of ${our.toLowerCase()} codebase last Friday.

14,000 lines. Gone.

${we}'d been moving fast for 18 months. Every feature was a hack on top of a hack. New engineers took 3 weeks to ship their first PR.

The fast code was actually slow code.

${we} stopped. Took 2 weeks. Rewrote the core from scratch.

Now new engineers ship on day 2.

What's the biggest codebase surgery you've done?

#engineering #techdebt #startups

Why this works: Hook has a number and unexpected action. Builds tension with specifics. One strong opinion. Shows transformation. Ends with a question that invites their story.

MORE EXAMPLES

A client asked ${us} to add AI to their app last month.

${we} looked at the data. Users were searching with 6 different filters, then giving up.

${we} didn't build AI. ${we} built better search. 3 dropdowns instead of 6. Took 2 days.

Conversions went up 34%.

Sometimes the unsexy solution is the right one.

What feature request turned out to need something completely different?

#product #engineering #startup

Another one:

${we} charged $8,000 to delete a client's microservices.

They had 12 services. For a 3-person team. Each service had its own deploy pipeline, its own database, its own bugs.

${we} merged them into 2 services. Deploy time went from 45 minutes to 8 minutes.

Microservices are great. If you're Netflix.

Most startups aren't Netflix.

What's the most overcomplicated architecture you've seen?

#microservices #architecture #startups

THE STRUCTURE

First line (under 210 characters). Surprising statement with a number or unexpected detail. This is what shows before someone clicks "see more" so make it count.

Next few lines. Tell what happened. Be specific. Use numbers. Keep sentences short. Vary the rhythm.

The insight. One strong opinion. Bold. Direct. No hedging.

The close. Question that invites their story. Not "what do you think?" Ask for their version of this specific problem.

Hashtags at the very end. 3 to 5.

CRITICAL RULES

${isOrganization ? 'Always use we, our, our team. Never I.' : 'Always use I, my, me. Never we unless talking about a team.'}

Zero emojis.

No em dashes. Use periods or commas.

Keep under 1200 characters total.

Hook under 210 characters.

NEVER START WITH

"We've seen 87% of startups" or any statistic without a story.

"Many companies" or "Most startups" without immediately getting specific.

"In today's world" or "It's no secret that" or any throat-clearing.

NEVER USE THESE WORDS

Strategic architecture, hidden liability, future-proof, game-changing, revolutionary, seamlessly, prioritize X over Y, balance X and Y, it's worth noting, this is where X comes in, moreover, furthermore, additionally, however, we've found that, studies show, research shows.

NEVER END WITH

"What are your thoughts?" or "How do you handle this?" or "What's your experience?"

These are lazy. Ask for a specific story instead.`;
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
  
  // FORCE EDUCATIONAL ANGLES ONLY - Override page configuration
  // Only use angles that don't require fabrication
  const EDUCATIONAL_ANGLES = ['insight', 'how_to', 'opinionated_take'];
  const preferredAngles = strategy.preferredAngles?.filter(a => EDUCATIONAL_ANGLES.includes(a)) || EDUCATIONAL_ANGLES;
  const safeAngles = preferredAngles.length > 0 ? preferredAngles : EDUCATIONAL_ANGLES;

  // Pick a random topic if not specified
  const selectedTopic = topic || (topics.length > 0 
    ? topics[Math.floor(Math.random() * topics.length)] 
    : 'general industry insights');

  // Pick a random educational angle if not specified
  const selectedAngle = angle && EDUCATIONAL_ANGLES.includes(angle) 
    ? angle 
    : safeAngles[Math.floor(Math.random() * safeAngles.length)];

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
  parts.push('CRITICAL REMINDER:');
  parts.push('- This is EDUCATIONAL content only');
  parts.push('- NEVER invent client names, costs, percentages, timelines, or scenarios');
  parts.push('- If you have real data from the context, use it. Otherwise write pure educational insights');
  parts.push('- Focus on teaching principles and methods, not telling fabricated stories');
  parts.push('- Be authentic and conversational, but stay 100% educational');

  const userPrompt = parts.join('\n');
  
  // Use the appropriate system prompt based on platform and page type
  const systemPrompt = targetPlatform === 'linkedin' 
    ? getLinkedInSystemPrompt(pageType)
    : PLATFORM_SYSTEM_PROMPTS[targetPlatform];

  const result = await createChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8, // Slightly higher for more variety
    maxTokens: targetPlatform === 'twitter' ? 150 : 1000, // Twitter needs fewer tokens
  });

  const content = result.content;

  if (!content) {
    throw new Error('Failed to generate content');
  }

  return {
    content: content.trim(),
    angle: selectedAngle,
    topic: selectedTopic,
  };
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
  
  facebook: `You write Facebook posts that feel like you're talking to a friend, not broadcasting to an audience.

Write warm and welcoming. Use "you" and "your". Be relatable. It's okay to be more casual here than LinkedIn. This isn't a press release.

Keep it tight. Aim for 100 to 500 characters for best engagement. You can go longer for storytelling (up to 1000 characters) but front-load the interesting part. Use line breaks so it's easy to scan.

Facebook is visual first. If there's an image or video, write to complement it. If there's no media, paint a picture with words. Emojis work better here than LinkedIn. Two to four emojis is fine.

Encourage interaction but make it effortless. Ask questions that are easy to answer. Use polls, reactions, simple choices. Example: "Coffee or tea while working? ☕🍵"

Hashtags work differently here. Use zero to three max. Unlike LinkedIn. Only use relevant, popular tags. Often it's better without hashtags on Facebook.

Match the vibe to the content. Fun, informative, inspiring, whatever fits. Behind the scenes content works great. Celebrate milestones and team moments. Share industry news with your take on it.`,

  twitter: `You write tweets that are punchy and get engagement. But here's the thing. You MUST stay under 280 characters TOTAL. That includes hashtags, spaces, everything. Aim for 200 to 250 characters. This is NON-NEGOTIABLE. If you go over 280 characters your tweet will FAIL.

One clear thought per tweet. Every word must earn its place. No fluff.

Hook immediately. No preamble. Get to the point. Strong opinions work. Counterintuitive takes get engagement. Questions work well.

Short sentences. Fragments okay. Use line breaks strategically. Contractions always. Don't, won't, it's. No corporate speak.

Hashtags minimal. One to two max, or none. Don't hashtag common words. Put hashtags at end not inline.

Ask for opinions. Make bold statements. Share quick tips. React to trending topics.

Never write threads in a single tweet. Too many emojis looks desperate. Don't ask for retweets explicitly. Don't over-explain.`,

  instagram: `You write Instagram captions that complement visual content and feel authentic.

The first line is crucial. Only about 125 characters show before "more". Hook them there. Tell a story or share context. You can go longer (up to 2200 characters) but front-load the value. End with a call to action or question.

Be authentic and personal. Behind the scenes content works great. Inspirational but not preachy. Match your brand voice.

Hashtags matter here. Use five to fifteen relevant ones. Mix popular and niche tags. Put them in the caption or first comment. Research what's working in your niche.

Ask questions in captions. Use CTAs like "Double tap if you agree". Encourage saves with "Save this for later". Reply to comments quickly.

Emojis work well on Instagram. Use them to break up text. Match your brand personality. Don't overdo it.

Different content needs different approaches. Educational carousels need clear captions. Reels need hook plus context. Stories can be more casual. Feed posts should be polished.`,
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


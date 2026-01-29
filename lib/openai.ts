import OpenAI from 'openai';
import { StructuredInput } from './models/Post';

// Use Groq's OpenAI-compatible API
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Groq model - fast and high quality
const AI_MODEL = 'llama-3.3-70b-versatile';

const LINKEDIN_POST_SYSTEM_PROMPT = `You are an expert LinkedIn content creator who writes posts that perform well and build credibility. You write as an individual builder/professional, NOT as a company or marketing team.

## Core Principles:

1. **Write like a builder, not a marketer**
   - Use first person ("I built", "I learned", "I noticed")
   - Be honest and authentic - acknowledge limitations openly
   - Share the WHY behind the work, not just the WHAT
   - Sound like a senior engineer/professional sharing insights
   - Use simple, direct language - write how you'd explain it to a colleague
   - AVOID buzzwords and marketing phrases:
     - "empowering", "revolutionizing", "game-changing", "compelling"
     - "holistic", "comprehensive", "seamlessly", "robust"
     - "confidently and comprehensively", "cutting-edge"
     - "excited to share", "thrilled to announce"
     - "join us in this journey", "leverage"

2. **Keep it concise and scannable**
   - Aim for 800-1200 characters (sweet spot for engagement)
   - Never exceed 1500 characters
   - Most readers won't get past the first 6-8 lines - make them count
   - Use short paragraphs (1-3 sentences max)
   - Break up dense sentences - if it's hard to read in one breath, split it
   - Use bullet points sparingly for key lists only

3. **Hook readers immediately**
   - Start with an insight, bold statement, or relatable problem
   - Great hooks: statements of belief, counterintuitive observations, clear problems
   - Example: "Creating a legacy plan shouldn't be a privilege."
   - NEVER start with emojis or "Exciting News" type phrases
   - The first line should make people want to read more

4. **Structure for LinkedIn:**
   - Hook (1-2 lines that stop the scroll)
   - Context/Problem (why this matters - be specific)
   - What you built/did (brief, focus on the interesting part)
   - What makes it interesting (1-2 insights, not a feature list)
   - Honest disclaimer if applicable (builds trust)
   - Thoughtful question (specific, invites real discussion)
   - 3-5 hashtags at the end

5. **Emoji usage - LESS IS MORE:**
   - Trust-sensitive topics (Legal, Finance, AI, Healthcare): 0-1 emoji ONLY
   - Technical/Engineering topics: 0-1 emoji
   - General business/career: 1-2 emojis max
   - Emojis reduce perceived seriousness - use sparingly
   - When in doubt, use zero emojis

6. **End with a SPECIFIC question**
   - Bad: "What are your thoughts? Let's discuss!"
   - Good: "Curious how others see AI shaping access to legal services in the coming years."
   - The question should invite thoughtful responses, not generic "nice post" replies

7. **Position the author as a credible builder**
   - Someone who ships real things
   - Aware of constraints, tradeoffs, and limitations
   - Sharing genuinely useful insights from experience
   - NOT selling, promoting, or seeking validation
   - Honest about early-stage/POC nature when applicable

8. **Write like a human, not an AI**
   - NEVER use em dashes (—). Use commas, periods, or "and" instead
   - NEVER use "not just X, but Y" structure. Say "X and Y" or use two sentences
   - AVOID these AI-sounding phrases:
     - "It's worth noting that..."
     - "This is where X comes in"
     - "At its core", "The reality is", "Here's the thing"
     - "In today's world", "In an era of"
     - "When it comes to"
     - "Moreover", "Furthermore", "Additionally" (use "And" or "Also" or nothing)
     - "It's important to note"
     - "That said"
   - Use contractions naturally (don't, won't, can't, it's, that's)
   - Vary sentence length. Mix short punchy sentences with longer ones.
   - It's okay to start sentences with "And" or "But"
   - Occasional sentence fragments are fine. Like this.
   - Don't over-explain. Trust the reader to get it.
   - Write like you're talking to a smart friend, not presenting to a board

9. **Avoid declarative transitions and filler adjectives**
   - AVOID "That's why I built..." - too declarative. Instead:
     - "So I built...", "I ended up building...", "I recently built..."
     - Or just state what you built without a transition
   - AVOID filler adjectives that add no information:
     - "truly", "really", "very", "actually", "incredibly"
     - "interesting" (show WHY it's interesting instead)
     - "amazing", "fantastic", "great"
   - Be factual, not promotional. Facts are more compelling than adjectives.
   - If a sentence is over 25 words, split it into two.`;

export interface GeneratePostOptions {
  mode: 'structured' | 'ai';
  structuredInput?: StructuredInput;
  aiPrompt?: string;
  tone?: 'professional' | 'casual' | 'inspirational' | 'educational';
  includeEmojis?: boolean;
  includeHashtags?: boolean;
  targetAudience?: string;
}

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
}

export interface GenerateWithStrategyOptions {
  strategy: PageContentStrategy;
  topic?: string; // Optional specific topic to write about
  angle?: string; // Optional specific angle to use
  inspiration?: string; // Optional content inspiration (e.g., from blog)
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

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: LINKEDIN_POST_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  
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
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
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
    max_tokens: 1000,
  });

  const improvedContent = response.choices[0]?.message?.content;
  
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

/**
 * Generate a LinkedIn post using a page's content strategy
 */
export async function generatePostWithStrategy(options: GenerateWithStrategyOptions): Promise<{
  content: string;
  angle: string;
  topic: string;
}> {
  const { strategy, topic, angle, inspiration } = options;

  // Pick a random topic if not specified
  const selectedTopic = topic || (strategy.topics.length > 0 
    ? strategy.topics[Math.floor(Math.random() * strategy.topics.length)] 
    : 'general industry insights');

  // Pick a random angle if not specified
  const selectedAngle = angle || (strategy.preferredAngles.length > 0
    ? strategy.preferredAngles[Math.floor(Math.random() * strategy.preferredAngles.length)]
    : 'insight');

  const angleDescription = POST_ANGLE_DESCRIPTIONS[selectedAngle] || 'Share valuable insights';

  const parts: string[] = [
    'Generate a LinkedIn post based on the following content strategy:',
    '',
    '## Your Voice & Persona:',
    strategy.persona,
    '',
    '## Target Audience:',
    strategy.targetAudience,
    '',
    '## Tone:',
    strategy.tone,
    '',
    '## Topic for this post:',
    selectedTopic,
    '',
    '## Post Angle:',
    `${selectedAngle}: ${angleDescription}`,
  ];

  if (inspiration) {
    parts.push('');
    parts.push('## Source Material/Inspiration:');
    parts.push(inspiration);
  }

  if (strategy.avoidTopics && strategy.avoidTopics.length > 0) {
    parts.push('');
    parts.push('## Topics to AVOID:');
    parts.push(strategy.avoidTopics.join(', '));
  }

  if (strategy.customInstructions) {
    parts.push('');
    parts.push('## Additional Instructions:');
    parts.push(strategy.customInstructions);
  }

  parts.push('');
  parts.push('## Requirements:');
  parts.push('- Keep under 1200 characters (aim for 900-1100)');
  parts.push('- Write authentically in the persona described above');
  parts.push('- Match the tone exactly');
  parts.push('- Use the specified angle to structure the post');
  parts.push('- End with a specific question that invites discussion');
  parts.push('- Include 3-5 relevant hashtags at the end');
  parts.push('- Use 0-1 emoji (less is more for credibility)');
  parts.push('- NEVER use em dashes (—). Use commas or periods instead');
  parts.push('- Use contractions naturally (don\'t, it\'s, that\'s)');
  parts.push('- Vary sentence length');

  const userPrompt = parts.join('\n');

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: LINKEDIN_POST_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8, // Slightly higher for more variety
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;

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

const ENGAGEMENT_SYSTEM_PROMPT = `You are an expert at writing authentic, engaging LinkedIn comments and replies. You write as a thoughtful professional who genuinely engages with content.

## Core Principles:

1. **Be authentic and specific**
   - Reference specific points from the post/comment you're responding to
   - Add genuine value or perspective
   - Never use generic phrases like "Great post!" or "Love this!"
   - Sound like a real person, not a bot

2. **Keep it concise**
   - Comments: 50-150 characters ideal, max 280
   - Replies: 30-100 characters ideal, max 200
   - One clear thought per comment

3. **Add value through:**
   - Sharing a related experience or insight
   - Asking a thoughtful follow-up question
   - Offering a complementary perspective
   - Acknowledging a specific point that resonated

4. **Avoid:**
   - Empty flattery ("Amazing!", "So inspiring!")
   - Self-promotion or links
   - Overusing emojis (0-1 max)
   - Corporate speak or buzzwords
   - Starting with "I" every time
   - Phrases like "couldn't agree more", "this resonates"

5. **Match the tone**
   - Professional posts → Professional comments
   - Casual posts → More relaxed comments
   - Technical posts → Technical engagement
   - Personal stories → Empathetic responses

6. **Natural language:**
   - Use contractions (that's, don't, it's)
   - Vary your sentence structure
   - Write how you'd actually talk to a colleague
   - Don't overexplain`;

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

Requirements:
- Keep it 50-150 characters (short and punchy)
- Be specific - reference something from the post
- Add value or a perspective, don't just compliment
- Use 0-1 emoji max
- Sound natural and human
- Don't start with "Great post" or similar

Return ONLY the comment text, nothing else.`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: ENGAGEMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 200,
  });

  const comment = response.choices[0]?.message?.content;

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

Requirements:
- Keep it 30-100 characters (brief and personal)
- Address them naturally (can use their first name)
- Acknowledge their specific point
- Don't overdo the gratitude
- Use 0-1 emoji max
- Sound like a real person responding

Return ONLY the reply text, nothing else.`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: ENGAGEMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 150,
  });

  const reply = response.choices[0]?.message?.content;

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

Requirements for EACH comment:
- 50-150 characters
- Be specific to the post content
- Add value, don't just compliment
- 0-1 emoji max
- Sound natural and human

Return ONLY the ${count} comments, each on its own line, numbered 1-${count}. No other text.`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: ENGAGEMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.9,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;

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

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const responseContent = response.choices[0]?.message?.content;

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

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: BLOG_ANALYZER_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 1500,
  });

  const responseContent = response.choices[0]?.message?.content;

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

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: LINKEDIN_POST_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;

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
  
  facebook: `You are an expert Facebook content creator who writes engaging posts for business pages. You write in a friendly, approachable tone while maintaining professionalism.

## Core Principles:

1. **Friendly and conversational**
   - Use a warm, welcoming tone
   - Speak directly to your audience ("you", "your")
   - Be relatable and human
   - Okay to be more casual than LinkedIn

2. **Keep it engaging**
   - Aim for 100-500 characters for best engagement
   - Can go longer for storytelling (up to 1000 characters)
   - Front-load the interesting part
   - Use line breaks for readability

3. **Visual-first mindset**
   - Facebook is highly visual - write to complement images/videos
   - If no media, paint a picture with words
   - Emojis work better here than LinkedIn (2-4 is fine)

4. **Encourage interaction**
   - Ask questions that are easy to answer
   - Use polls, reactions, or simple choices
   - Make commenting feel low-effort
   - Example: "Coffee or tea while working? ☕🍵"

5. **Hashtags - use sparingly**
   - 0-3 hashtags max (unlike LinkedIn)
   - Only use relevant, popular tags
   - Often better without hashtags on Facebook

6. **Tone flexibility**
   - Match the content type (fun, informative, inspiring)
   - Behind-the-scenes content works great
   - Celebrate milestones and team moments
   - Share industry news with your take`,

  twitter: `You are an expert Twitter/X content creator who writes punchy, engaging tweets that get engagement.

## Core Principles:

1. **Extreme brevity is key**
   - 280 characters max, aim for 200 or less
   - One clear thought per tweet
   - Every word must earn its place

2. **Hook immediately**
   - No preamble - get to the point
   - Strong opinions work
   - Counterintuitive takes get engagement
   - Questions work well

3. **Writing style**
   - Short sentences. Fragments okay.
   - Use line breaks strategically
   - Contractions always (don't, won't, it's)
   - No corporate speak

4. **Hashtags - minimal**
   - 1-2 hashtags max, or none
   - Don't hashtag common words
   - Put hashtags at end, not inline

5. **Engagement tactics**
   - Ask for opinions
   - Make bold statements
   - Share quick tips
   - React to trending topics

6. **Avoid**
   - Threads in a single tweet (save for thread format)
   - Too many emojis
   - Asking for retweets explicitly
   - Over-explaining`,

  instagram: `You are an expert Instagram content creator who writes compelling captions that complement visual content.

## Core Principles:

1. **Caption structure**
   - Strong first line (only ~125 chars show before "more")
   - Tell a story or share context
   - Can be longer (up to 2200 chars) but front-load value
   - End with a call-to-action or question

2. **Tone**
   - Authentic and personal
   - Behind-the-scenes feels work great
   - Inspirational but not preachy
   - Match your brand voice

3. **Hashtag strategy**
   - 5-15 relevant hashtags
   - Mix popular and niche tags
   - Put in caption or first comment
   - Research what's working in your niche

4. **Engagement**
   - Ask questions in captions
   - Use CTAs: "Double tap if you agree"
   - Encourage saves: "Save this for later"
   - Reply to comments quickly

5. **Emoji use**
   - Emojis work well on Instagram
   - Use to break up text
   - Match your brand personality
   - Don't overdo it

6. **Content types**
   - Educational carousels need clear captions
   - Reels need hook + context
   - Stories can be more casual
   - Feed posts should be polished`,
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
  
  const parts: string[] = [
    'Adapt the following content for ' + targetPlatform.charAt(0).toUpperCase() + targetPlatform.slice(1) + ':',
    '',
    '## Original Content:',
    originalContent,
    '',
    '## Platform Requirements:',
    `- Maximum ${platformConfig.maxCharacters} characters`,
    `- Hashtag strategy: ${platformConfig.hashtagStrategy} (${platformConfig.recommendedHashtags.min}-${platformConfig.recommendedHashtags.max} hashtags)`,
    `- Tone: ${platformConfig.tonePreference}`,
    '',
    '## Instructions:',
    '- Maintain the core message and insights',
    '- Adapt the tone and style for ' + targetPlatform,
    '- Adjust length appropriately',
    preserveHashtags ? '- Keep the same hashtags from the original' : '- Create platform-appropriate hashtags',
    '- Make it feel native to ' + targetPlatform + ', not cross-posted',
  ];
  
  if (customInstructions) {
    parts.push('');
    parts.push('## Additional Instructions:');
    parts.push(customInstructions);
  }
  
  parts.push('');
  parts.push('Return ONLY the adapted content, nothing else.');
  
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: parts.join('\n') },
    ],
    temperature: 0.7,
    max_tokens: Math.min(platformConfig.maxCharacters * 2, 2000),
  });
  
  const content = response.choices[0]?.message?.content;
  
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
    adaptContent = true 
  } = options;
  
  // Generate the primary content (default to LinkedIn style)
  const primary = await generatePostWithStrategy({
    strategy,
    topic,
    angle,
    inspiration,
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


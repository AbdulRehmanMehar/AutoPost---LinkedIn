import OpenAI from 'openai';
import { StructuredInput } from './models/Post';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    model: 'gpt-4o',
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
    model: 'gpt-4o',
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

/**
 * AI Content Reviewer
 * 
 * This service acts as an autonomous AI editor that reviews generated content
 * and makes publish/reject decisions. It evaluates:
 * - Content quality and clarity
 * - Brand voice alignment
 * - Risk assessment (controversial, offensive, factually questionable)
 * - Engagement potential
 * - Platform appropriateness
 * - Timing recommendations
 */

import { PageContentStrategy } from '@/lib/openai';
import { PlatformType } from '@/lib/platforms/types';
import { createChatCompletion, groqClient } from '@/lib/ai-client';

export interface ReviewCriteria {
  authenticity: {
    score: number; // 0-10 - THE MOST IMPORTANT
    feedback: string;
    aiRedFlagsFound?: string[];
  };
  hookQuality: {
    score: number; // 0-10
    feedback: string;
  };
  contentQuality: {
    score: number; // 0-10
    feedback: string;
  };
  brandAlignment: {
    score: number; // 0-10
    feedback: string;
  };
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    concerns: string[];
  };
  engagementPotential: {
    score: number; // 0-10
    reasoning: string;
  };
  platformFit: {
    score: number; // 0-10
    feedback: string;
  };
  overallScore: number; // 0-100
}

export interface ReviewDecision {
  approved: boolean;
  decision: 'publish' | 'needs_revision' | 'reject';
  criteria: ReviewCriteria;
  reasoning: string;
  suggestedRevisions?: string[];
  recommendedScheduleTime?: {
    reason: string;
    urgency: 'immediate' | 'optimal_time' | 'flexible';
  };
  confidence: number; // 0-1, how confident the AI is in its decision
}

export interface ReviewContext {
  content: string;
  platform: PlatformType;
  strategy?: PageContentStrategy;
  topic?: string;
  angle?: string;
  sourceContent?: {
    title?: string;
    summary?: string;
  };
  recentPerformance?: {
    avgEngagement: number;
    topPerformingAngles: string[];
    audiencePreferences: string[];
  };
}

/**
 * AI reviews generated content and makes a publish decision
 */
export async function reviewContentForPublishing(
  context: ReviewContext
): Promise<ReviewDecision> {
  const { content, platform, strategy, topic, angle, sourceContent, recentPerformance } = context;

  // Determine if this is organization or personal voice
  const pageType = strategy?.pageType || 'personal';
  const isOrganization = pageType === 'organization';
  
  const voiceGuidance = isOrganization 
    ? `This is an ORGANIZATION page using "We" voice. Adjust expectations:
- "We've seen..." is acceptable for organizations (not a red flag)
- Case studies and client stories are natural for companies
- Focus on SPECIFIC examples, not that it uses "We"
- Judge authenticity by specificity of details, not pronouns`
    : `This is a PERSONAL page using "I" voice. Standard authenticity rules apply.`;

  const systemPrompt = `You are an elite social media editor who can instantly spot AI-generated content. Your job is to ensure posts are both AUTHENTIC and HIGH-CONVERTING.

You evaluate posts on two dimensions:
1. AUTHENTICITY - Does it sound like a real human/company wrote it?
2. CONVERSION POTENTIAL - Will it drive engagement AND traffic?

${voiceGuidance}

EVALUATION CRITERIA:

1. **AUTHENTICITY (0-10)** - THE MOST IMPORTANT CRITERION
   - Does this sound like a REAL ${isOrganization ? 'COMPANY' : 'PERSON'} wrote it?
   - Does it share genuine insights or lessons?
   - Or is it generic observations that anyone could make?
   
   INSTANT FAILURES (score 0-3):
   ${isOrganization 
     ? `- Makes up fake client names or companies ("fintech client", "Series B startup")
   - Fabricates specific metrics without context ("60% improvement", "$40k saved")
   - Sounds like a press release (corporate speak without substance)`
     : `- Makes up fake stories about "a client" or "someone I worked with"
   - Fabricates specific metrics ("34% conversion boost", "400ms latency")
   - Sounds like someone else's experience, not authentic reflection`}
   - Generic observations without personal insight
   - Could have been written by any ${isOrganization ? 'consulting firm' : 'content creator'}
   
   AVERAGE (score 4-6):
   - Shares real lessons but feels formulaic
   - Has insights but lacks personal voice
   - Educational but impersonal
   
   EXCELLENT (score 7-10):
   - Shares genuine lessons from real experience
   - Reads like ${isOrganization ? 'a company sharing honest learnings' : 'someone reflecting on their journey'}
   - Has a strong, clear opinion or insight
   - Educational value comes from authentic reflection, not fabricated case studies

2. **Hook Quality (0-10)** - CRITICAL FOR CONVERSION
   - Does the first line make you STOP scrolling?
   - Is it under 210 characters? (Must fit before "see more")
   - Does it create CURIOSITY (raise a question in the reader's mind)?
   
   TERRIBLE HOOKS (score 0-3):
   - "We've seen many startups prioritize quick fixes..."
   - "In today's fast-paced world..."
   - "It's no secret that..."
   - Any hook that could apply to any company
   - Hook over 210 characters
   
   GREAT HOOKS (score 8-10):
   - "We mass-deleted 14,000 lines of code last Friday."
   - "$200k revenue. 47 lines of code. No framework."
   - Contains a specific number, action, or surprising fact
   - Creates immediate curiosity (makes you want to know more)

3. **AI Detection (critical check)**
   RED FLAGS that indicate AI-generated content:
   - Em dashes (—) anywhere in the text
   - "not just X, but Y" sentence structure
   - "It's worth noting", "This is where X comes in"
   - "Moreover", "Furthermore", "Additionally"
   - "prioritize X over Y", "balance X and Y"
   - "hidden liability", "brick wall", "strategic architecture"
   - "long-term success", "future-proof", "sustainable growth"
   - Generic closing questions like "What are your thoughts?"
   - "game-changing", "revolutionary", "seamlessly"
   
   If you detect 2+ of these: AUTOMATIC REJECTION

4. **Structure Check (PAS + Curiosity Loops)**
   Does the post follow proven formulas?
   - PAS (Problem-Agitate-Solve): Identifies problem → builds tension → delivers insight
   - Curiosity Loops: Raises questions → delays answers → mini-payoffs → new questions
   - NOT: Just stating observations or listing tips

5. **Engagement Potential (0-10)** - FOR FOLLOWERS
   - Will this spark conversation?
   - Does the CTA invite the reader to share THEIR story?
   - Bad: "What are your thoughts?" (too generic)
   - Good: "What's the most expensive shortcut you've taken?"
   - Is there a strong OPINION that people will agree/disagree with?

6. **Traffic Potential (0-10)** - FOR CONVERSIONS
   - Does it demonstrate expertise that makes people want to learn more?
   - Does it create desire for the solution/service implicitly?
   - Is there a clear transformation shown (before → after)?

7. **Brand/Voice Alignment (0-10)**
   - Does it match the specified tone?
   - Is it appropriate for the target audience?

8. **Risk Assessment (low/medium/high/critical)**
   - Controversial or offensive content?
   - Factual claims that could be wrong?
   - Legal concerns?

DECISION RULES:

**PUBLISH**: 
- Authenticity score ≥ 7
- Hook score ≥ 6
- No AI detection red flags (or only 1)
- Overall score ≥ 70
- Risk is low
- Has clear PAS structure or curiosity loop

**NEEDS_REVISION**:
- Authenticity score 5-6 (has potential but needs work)
- OR Hook is weak but story is good
- OR 2 AI detection red flags that could be fixed
- OR Good story but weak closing question

**REJECT**:
- Authenticity score < 5 (sounds like AI/marketing)
- OR Hook score < 4 (generic opener)
- OR 3+ AI detection red flags
- OR starts with banned phrases ("We've seen many...", etc.)
- OR overall score < 50
- OR high/critical risk
- OR no specific story/example (just observations)

Be HARSH. It's better to reject generic content than publish it. Generic content hurts engagement and brand perception.

Output valid JSON only.`;

  const userPrompt = `Review this ${platform} post for automatic publishing.

FIRST, check for these INSTANT REJECTION criteria:
1. ${isOrganization 
  ? 'Does it fabricate fake client names or companies?'
  : 'Does it make up fake stories with invented metrics?'}
2. Does it contain 3+ AI red flag phrases?
3. Is it generic advice with NO personal insight or lesson?
4. Could any ${isOrganization ? 'consulting firm' : 'content creator'} in the industry have written this exact post?

If ANY of the above are true, reject immediately with authenticity score < 5.

NOTE: Educational posts sharing genuine principles and lessons are GOOD, even without specific case studies. 
Focus on whether the insight feels authentic, not whether it has made-up client names.

---
CONTENT TO REVIEW:
${content}
---

${strategy ? `
BRAND STRATEGY:
- Persona: ${strategy.persona || 'Not specified'}
- Target Audience: ${strategy.targetAudience || 'Not specified'}
- Tone: ${strategy.tone || 'professional'}
- Topics: ${strategy.topics?.join(', ') || 'Not specified'}
- Preferred Angles: ${strategy.preferredAngles?.join(', ') || 'Not specified'}
${strategy.avoidTopics?.length ? `- Avoid Topics: ${strategy.avoidTopics.join(', ')}` : ''}
${strategy.customInstructions ? `- Custom Instructions: ${strategy.customInstructions}` : ''}
` : ''}

${topic ? `TOPIC: ${topic}` : ''}
${angle ? `INTENDED ANGLE: ${angle}` : ''}

${sourceContent ? `
SOURCE CONTENT BEING REPURPOSED:
Title: ${sourceContent.title || 'N/A'}
Summary: ${sourceContent.summary || 'N/A'}
` : ''}

${recentPerformance ? `
RECENT PERFORMANCE DATA:
- Average Engagement: ${recentPerformance.avgEngagement}
- Top Performing Angles: ${recentPerformance.topPerformingAngles.join(', ')}
- Audience Preferences: ${recentPerformance.audiencePreferences.join(', ')}
` : ''}

Evaluate this content and provide your decision in this exact JSON format:
{
  "approved": boolean,
  "decision": "publish" | "needs_revision" | "reject",
  "criteria": {
    "authenticity": { "score": number, "feedback": "string", "aiRedFlagsFound": ["string"] },
    "hookQuality": { "score": number, "feedback": "string" },
    "contentQuality": { "score": number, "feedback": "string" },
    "brandAlignment": { "score": number, "feedback": "string" },
    "riskAssessment": { "level": "low|medium|high|critical", "concerns": ["string"] },
    "engagementPotential": { "score": number, "reasoning": "string" },
    "platformFit": { "score": number, "feedback": "string" },
    "overallScore": number
  },
  "reasoning": "string explaining your decision - be specific about what's wrong",
  "suggestedRevisions": ["string"] (required if needs_revision - give specific, actionable fixes),
  "recommendedScheduleTime": {
    "reason": "string",
    "urgency": "immediate|optimal_time|flexible"
  },
  "confidence": number (0-1)
}`;

  try {
    // Note: For JSON mode, we use the raw groqClient since createChatCompletion doesn't support response_format yet
    const result = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent reviews
      maxTokens: 2000,
    });

    const resultContent = result.content;
    if (!resultContent) {
      throw new Error('No response from AI reviewer');
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = resultContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const decision = JSON.parse(jsonMatch[0]) as ReviewDecision;
    
    // Validate the decision
    if (typeof decision.approved !== 'boolean' || !decision.decision || !decision.criteria) {
      throw new Error('Invalid review response structure');
    }

    // Ensure decision matches approved status
    decision.approved = decision.decision === 'publish';

    return decision;

  } catch (error) {
    console.error('AI review failed:', error);
    
    // Fail-safe: if AI review fails, don't auto-publish
    return {
      approved: false,
      decision: 'needs_revision',
      criteria: {
        authenticity: { score: 0, feedback: 'Review failed', aiRedFlagsFound: [] },
        hookQuality: { score: 0, feedback: 'Review failed' },
        contentQuality: { score: 0, feedback: 'Review failed' },
        brandAlignment: { score: 0, feedback: 'Review failed' },
        riskAssessment: { level: 'high', concerns: ['AI review system error - requires human review'] },
        engagementPotential: { score: 0, reasoning: 'Review failed' },
        platformFit: { score: 0, feedback: 'Review failed' },
        overallScore: 0,
      },
      reasoning: `AI review failed: ${error instanceof Error ? error.message : 'Unknown error'}. Flagged for human review.`,
      confidence: 0,
    };
  }
}

/**
 * Batch review multiple pieces of content
 */
export async function reviewMultipleContents(
  contents: ReviewContext[]
): Promise<Map<string, ReviewDecision>> {
  const results = new Map<string, ReviewDecision>();
  
  // Review in parallel with rate limiting
  const batchSize = 3;
  for (let i = 0; i < contents.length; i += batchSize) {
    const batch = contents.slice(i, i + batchSize);
    const reviews = await Promise.all(
      batch.map(ctx => reviewContentForPublishing(ctx))
    );
    
    batch.forEach((ctx, idx) => {
      results.set(ctx.content.slice(0, 50), reviews[idx]);
    });
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < contents.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

/**
 * Quick quality check - faster but less thorough
 * Use for pre-screening before full review
 */
export async function quickQualityCheck(
  content: string,
  platform: PlatformType
): Promise<{ passesQuickCheck: boolean; concerns: string[] }> {
  const systemPrompt = `You are a quick content screener. Check for obvious issues that would disqualify content from publishing. Be fast and decisive.

Check for:
1. Offensive or inappropriate language
2. Obvious factual errors
3. Spam-like or promotional overload
4. Incomplete or broken content
5. Wrong platform format

Respond with JSON: { "passesQuickCheck": boolean, "concerns": ["string"] }`;

  try {
    const result = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Platform: ${platform}\n\nContent:\n${content}` },
      ],
      temperature: 0.1,
      maxTokens: 300,
      preferFast: true,
    });

    const jsonMatch = result.content?.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || '{}');
    return {
      passesQuickCheck: parsed.passesQuickCheck ?? false,
      concerns: parsed.concerns || [],
    };
  } catch {
    return { passesQuickCheck: false, concerns: ['Quick check failed'] };
  }
}

/**
 * Get minimum quality thresholds for auto-publishing
 * These can be customized per page/user
 */
export function getAutoPublishThresholds() {
  return {
    minOverallScore: 60,    // Lowered from 70
    minAuthenticity: 5,      // Lowered from 7 (was too strict)
    minHookQuality: 5,       // Lowered from 6
    minContentQuality: 5,    // Lowered from 6
    minBrandAlignment: 5,    // Lowered from 6
    minEngagementPotential: 4, // Lowered from 5
    minPlatformFit: 5,       // Lowered from 6
    maxRiskLevel: 'medium' as const,
    minConfidence: 0.6,      // Lowered from 0.7
    maxAiRedFlags: 2,        // Increased from 1 (more lenient)
  };
}

/**
 * Check if a review decision meets auto-publish thresholds
 */
export function meetsAutoPublishCriteria(
  decision: ReviewDecision,
  customThresholds?: Partial<ReturnType<typeof getAutoPublishThresholds>>
): boolean {
  const thresholds = { ...getAutoPublishThresholds(), ...customThresholds };
  const { criteria, confidence } = decision;
  
  // Must be explicitly approved
  if (!decision.approved || decision.decision !== 'publish') {
    return false;
  }
  
  // Check all thresholds
  if (criteria.overallScore < thresholds.minOverallScore) return false;
  if (criteria.authenticity?.score < thresholds.minAuthenticity) return false; // Critical check
  if (criteria.hookQuality?.score < thresholds.minHookQuality) return false;
  if (criteria.contentQuality.score < thresholds.minContentQuality) return false;
  if (criteria.brandAlignment.score < thresholds.minBrandAlignment) return false;
  if (criteria.engagementPotential.score < thresholds.minEngagementPotential) return false;
  if (criteria.platformFit.score < thresholds.minPlatformFit) return false;
  if (confidence < thresholds.minConfidence) return false;
  
  // Check AI red flags
  const aiRedFlagsCount = criteria.authenticity?.aiRedFlagsFound?.length || 0;
  if (aiRedFlagsCount > thresholds.maxAiRedFlags) return false;
  
  // Risk level check
  const riskLevels = ['low', 'medium', 'high', 'critical'];
  const maxRiskIndex = riskLevels.indexOf(thresholds.maxRiskLevel);
  const actualRiskIndex = riskLevels.indexOf(criteria.riskAssessment.level);
  if (actualRiskIndex > maxRiskIndex) return false;
  
  return true;
}

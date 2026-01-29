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

import OpenAI from 'openai';
import { PageContentStrategy } from '@/lib/openai';
import { PlatformType } from '@/lib/platforms/types';

// Use Groq's OpenAI-compatible API
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const AI_MODEL = 'llama-3.3-70b-versatile';

export interface ReviewCriteria {
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

  const systemPrompt = `You are an expert social media content editor and quality assurance reviewer. Your job is to review AI-generated social media posts and decide whether they should be published.

You must be STRICT but FAIR. Your goal is to ensure only high-quality, on-brand, risk-free content gets published automatically.

EVALUATION CRITERIA:

1. **Content Quality (0-10)**
   - Is the writing clear, engaging, and well-structured?
   - Is the hook compelling?
   - Is there a clear value proposition or takeaway?
   - Is the length appropriate for the platform?

2. **Brand Alignment (0-10)**
   - Does it match the specified tone and voice?
   - Is it consistent with the content strategy?
   - Does it serve the target audience?

3. **Risk Assessment (low/medium/high/critical)**
   - Could this be controversial or offensive?
   - Are there any factual claims that could be wrong?
   - Could this damage reputation?
   - Is there anything legally questionable?
   - **critical** = DO NOT PUBLISH under any circumstances
   - **high** = Needs human review
   - **medium** = Minor concerns, may publish with caution
   - **low** = Safe to publish

4. **Engagement Potential (0-10)**
   - Will this spark conversation?
   - Is there a clear CTA or engagement hook?
   - Does it provide value that encourages sharing?

5. **Platform Fit (0-10)**
   - Is this optimized for ${platform}?
   - Does it follow platform best practices?
   - Is the format appropriate?

DECISION RULES:
- **PUBLISH**: Overall score ≥ 70, risk is low/medium, no critical issues
- **NEEDS_REVISION**: Score 50-69 OR medium risk with fixable issues
- **REJECT**: Score < 50 OR high/critical risk OR unfixable issues

Be thorough but decisive. Output valid JSON only.`;

  const userPrompt = `Review this ${platform} post for automatic publishing:

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
    "contentQuality": { "score": number, "feedback": "string" },
    "brandAlignment": { "score": number, "feedback": "string" },
    "riskAssessment": { "level": "low|medium|high|critical", "concerns": ["string"] },
    "engagementPotential": { "score": number, "reasoning": "string" },
    "platformFit": { "score": number, "feedback": "string" },
    "overallScore": number
  },
  "reasoning": "string explaining your decision",
  "suggestedRevisions": ["string"] (only if needs_revision),
  "recommendedScheduleTime": {
    "reason": "string",
    "urgency": "immediate|optimal_time|flexible"
  },
  "confidence": number (0-1)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent reviews
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from AI reviewer');
    }

    const decision = JSON.parse(result) as ReviewDecision;
    
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
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Platform: ${platform}\n\nContent:\n${content}` },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      passesQuickCheck: result.passesQuickCheck ?? false,
      concerns: result.concerns || [],
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
    minOverallScore: 70,
    minContentQuality: 6,
    minBrandAlignment: 6,
    minEngagementPotential: 5,
    minPlatformFit: 6,
    maxRiskLevel: 'medium' as const,
    minConfidence: 0.7,
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
  if (criteria.contentQuality.score < thresholds.minContentQuality) return false;
  if (criteria.brandAlignment.score < thresholds.minBrandAlignment) return false;
  if (criteria.engagementPotential.score < thresholds.minEngagementPotential) return false;
  if (criteria.platformFit.score < thresholds.minPlatformFit) return false;
  if (confidence < thresholds.minConfidence) return false;
  
  // Risk level check
  const riskLevels = ['low', 'medium', 'high', 'critical'];
  const maxRiskIndex = riskLevels.indexOf(thresholds.maxRiskLevel);
  const actualRiskIndex = riskLevels.indexOf(criteria.riskAssessment.level);
  if (actualRiskIndex > maxRiskIndex) return false;
  
  return true;
}

/**
 * ICP Engagement Agent
 * 
 * An autonomous agent that:
 * 1. Analyzes page content to understand the ICP
 * 2. Searches Twitter for posts from ICPs
 * 3. Generates contextual, value-adding replies
 * 4. Posts replies with safeguards and rate limiting
 * 
 * Based on ICP principles from the transcripts:
 * - Target people with urgent, important problems
 * - Be 10x better in our responses (add real value)
 * - Track what works and iterate
 */

import mongoose from 'mongoose';
import Page from '../models/Page';
import { IPlatformConnection } from '../models/Page';
import { twitterAdapter, TwitterSearchResult, TwitterUser } from '../platforms/twitter-adapter';
import { analyzePageICP, ICPProfile } from './icp-analyzer';
import ICPEngagement, { IICPEngagement } from '../models/ICPEngagement';
import { createChatCompletion } from '../ai-client';

// ============================================
// Types
// ============================================

export interface EngagementCandidate {
  tweet: TwitterSearchResult;
  relevanceScore: number;         // 0-10 how relevant to ICP
  engagementPotential: number;    // 0-10 likelihood of positive response
  reasons: string[];               // Why this is a good candidate
  suggestedReply?: string;
}

export interface EngagementResult {
  tweet: TwitterSearchResult;
  reply: string;
  replyId?: string;
  replyUrl?: string;
  success: boolean;
  error?: string;
  engagedAt: Date;
}

export interface AgentRunResult {
  success: boolean;
  pageId: string;
  platform: 'twitter';
  queriesExecuted: number;
  tweetsFound: number;
  tweetsEvaluated: number;
  repliesSent: number;
  repliesSuccessful: number;
  engagements: EngagementResult[];
  errors: string[];
  startedAt: Date;
  completedAt: Date;
  icpProfile?: ICPProfile;
}

export interface AgentConfig {
  maxTweetsPerQuery: number;       // Max tweets to fetch per search query
  maxQueriesToRun: number;         // Max queries to run per execution
  maxRepliesToSend: number;        // Max replies to send per execution
  minRelevanceScore: number;       // Min score (0-10) to consider for reply
  minFollowers: number;            // Min followers for author
  maxFollowers: number;            // Max followers (avoid big accounts)
  skipVerified: boolean;           // Skip verified accounts
  cooldownMinutes: number;         // Min time between replies to same user
  dryRun: boolean;                 // If true, don't actually post replies
  testQueries?: string[];          // Override ICP queries with test queries
}

const DEFAULT_CONFIG: AgentConfig = {
  maxTweetsPerQuery: 10,
  maxQueriesToRun: 5,
  maxRepliesToSend: 3,
  minRelevanceScore: 6,
  minFollowers: 100,
  maxFollowers: 100000,
  skipVerified: true,
  cooldownMinutes: 60 * 24,        // Don't reply to same user twice in 24h
  dryRun: false,
};

// ============================================
// Agent Core
// ============================================

/**
 * Run the ICP Engagement Agent for a page
 */
export async function runICPEngagementAgent(
  pageId: string,
  configOverrides?: Partial<AgentConfig>
): Promise<AgentRunResult> {
  const startedAt = new Date();
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const errors: string[] = [];
  const engagements: EngagementResult[] = [];
  
  let queriesExecuted = 0;
  let tweetsFound = 0;
  let tweetsEvaluated = 0;
  let repliesSent = 0;
  let repliesSuccessful = 0;
  
  try {
    // 1. Load page and get Twitter connection
    const page = await Page.findById(pageId);
    if (!page) {
      throw new Error('Page not found');
    }

    const twitterConnection = page.connections?.find(
      (c: IPlatformConnection) => c.platform === 'twitter' && c.isActive
    );
    if (!twitterConnection) {
      throw new Error('No active Twitter connection found');
    }

    // 2. Analyze or load ICP profile
    console.log(`[ICP Agent] Analyzing ICP for page ${pageId}...`);
    const icpResult = await analyzePageICP({ pageId, includeDataSources: true, includeHistoricalPosts: true });
    
    if (!icpResult.success || !icpResult.profile) {
      throw new Error(icpResult.error || 'Failed to analyze ICP');
    }
    
    const icpProfile = icpResult.profile;
    console.log(`[ICP Agent] ICP analyzed. ${icpProfile.searchQueries.length} search queries generated.`);

    // 3. Get queries to run (use test queries if provided, otherwise ICP queries)
    let queriesToRun: { query: string; intent: string; priority: number }[];
    
    if (config.testQueries && config.testQueries.length > 0) {
      // Use test queries for testing
      console.log(`[ICP Agent] Using ${config.testQueries.length} test queries instead of ICP queries.`);
      queriesToRun = config.testQueries.map((q, i) => ({
        query: q,
        intent: 'test',
        priority: config.testQueries!.length - i,
      }));
    } else {
      // Use ICP-generated queries sorted by priority
      queriesToRun = icpProfile.searchQueries
        .sort((a, b) => b.priority - a.priority)
        .slice(0, config.maxQueriesToRun);
    }

    // 4. Collect candidates from all queries
    const allCandidates: EngagementCandidate[] = [];

    for (const searchQuery of queriesToRun) {
      try {
        console.log(`[ICP Agent] Searching: "${searchQuery.query}"`);
        queriesExecuted++;

        const searchResult = await twitterAdapter.searchTweets(
          twitterConnection,
          searchQuery.query,
          {
            maxResults: config.maxTweetsPerQuery,
            excludeRetweets: true,
            excludeReplies: true,
          }
        );

        if (!searchResult.success) {
          errors.push(`Search failed for "${searchQuery.query}": ${searchResult.error}`);
          continue;
        }

        const tweets = searchResult.tweets || [];
        tweetsFound += tweets.length;
        console.log(`[ICP Agent] Found ${tweets.length} tweets for query.`);

        // Filter and evaluate tweets
        for (const tweet of tweets) {
          tweetsEvaluated++;

          // Basic filters
          if (!passesBasicFilters(tweet, config)) {
            continue;
          }

          // Check if we've already engaged with this user recently
          const recentEngagement = await hasRecentEngagement(
            pageId,
            tweet.authorId,
            config.cooldownMinutes
          );
          if (recentEngagement) {
            continue;
          }

          // Evaluate relevance
          const evaluation = await evaluateTweetRelevance(tweet, icpProfile, searchQuery.intent);
          
          if (evaluation.relevanceScore >= config.minRelevanceScore) {
            allCandidates.push(evaluation);
          }
        }
      } catch (error) {
        errors.push(`Error processing query "${searchQuery.query}": ${error}`);
      }
    }

    console.log(`[ICP Agent] ${allCandidates.length} candidates passed filters.`);

    // 5. Sort by relevance and engagement potential
    allCandidates.sort((a, b) => {
      const scoreA = a.relevanceScore * 0.6 + a.engagementPotential * 0.4;
      const scoreB = b.relevanceScore * 0.6 + b.engagementPotential * 0.4;
      return scoreB - scoreA;
    });

    // 6. Generate replies and engage
    const candidatesToEngage = allCandidates.slice(0, config.maxRepliesToSend);

    for (const candidate of candidatesToEngage) {
      try {
        // Generate contextual reply with quality validation
        const reply = await generateAndValidateReply(candidate.tweet, icpProfile);
        
        if (!reply) {
          errors.push(`Could not generate quality reply for tweet ${candidate.tweet.id}`);
          continue;
        }

        repliesSent++;

        if (config.dryRun) {
          console.log(`[ICP Agent] DRY RUN - Would reply to @${candidate.tweet.author?.username}:`);
          console.log(`  Tweet: ${candidate.tweet.text.slice(0, 100)}...`);
          console.log(`  Reply: ${reply}`);
          
          engagements.push({
            tweet: candidate.tweet,
            reply,
            success: true,
            engagedAt: new Date(),
          });
          repliesSuccessful++;
        } else {
          // Actually post the reply
          const replyResult = await twitterAdapter.replyToTweet(
            twitterConnection,
            candidate.tweet.id,
            reply
          );

          if (replyResult.success) {
            repliesSuccessful++;
            console.log(`[ICP Agent] ✓ Replied to @${candidate.tweet.author?.username}`);

            // Save engagement record
            await saveEngagement({
              pageId,
              platform: 'twitter',
              tweet: candidate.tweet,
              reply,
              replyId: replyResult.replyId,
              replyUrl: replyResult.replyUrl,
              icpProfile,
              relevanceScore: candidate.relevanceScore,
            });

            engagements.push({
              tweet: candidate.tweet,
              reply,
              replyId: replyResult.replyId,
              replyUrl: replyResult.replyUrl,
              success: true,
              engagedAt: new Date(),
            });
          } else {
            errors.push(`Failed to reply to tweet ${candidate.tweet.id}: ${replyResult.error}`);
            engagements.push({
              tweet: candidate.tweet,
              reply,
              success: false,
              error: replyResult.error,
              engagedAt: new Date(),
            });
          }
        }

        // Rate limit: wait between replies
        if (!config.dryRun && candidatesToEngage.indexOf(candidate) < candidatesToEngage.length - 1) {
          await sleep(5000); // 5 second delay between replies
        }
      } catch (error) {
        errors.push(`Error engaging with tweet ${candidate.tweet.id}: ${error}`);
      }
    }

    return {
      success: true,
      pageId,
      platform: 'twitter',
      queriesExecuted,
      tweetsFound,
      tweetsEvaluated,
      repliesSent,
      repliesSuccessful,
      engagements,
      errors,
      startedAt,
      completedAt: new Date(),
      icpProfile,
    };
  } catch (error) {
    return {
      success: false,
      pageId,
      platform: 'twitter',
      queriesExecuted,
      tweetsFound,
      tweetsEvaluated,
      repliesSent,
      repliesSuccessful,
      engagements,
      errors: [...errors, error instanceof Error ? error.message : String(error)],
      startedAt,
      completedAt: new Date(),
    };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if tweet passes basic filters
 */
function passesBasicFilters(tweet: TwitterSearchResult, config: AgentConfig): boolean {
  const author = tweet.author;
  if (!author) return false;

  // Followers filter
  if (author.followersCount < config.minFollowers) return false;
  if (author.followersCount > config.maxFollowers) return false;

  // Verified filter
  if (config.skipVerified && author.verified) return false;

  // Skip tweets that are too short (likely not substantive)
  if (tweet.text.length < 50) return false;

  // Skip tweets with too many hashtags (likely promotional)
  const hashtagCount = (tweet.text.match(/#/g) || []).length;
  if (hashtagCount > 5) return false;

  // Skip tweets with URLs (often promotional)
  const hasUrl = /https?:\/\//.test(tweet.text);
  if (hasUrl) return false;

  return true;
}

/**
 * Check if we've engaged with this user recently
 */
async function hasRecentEngagement(
  pageId: string,
  authorId: string,
  cooldownMinutes: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  
  const recent = await ICPEngagement.findOne({
    pageId: new mongoose.Types.ObjectId(pageId),
    'targetUser.id': authorId,
    engagedAt: { $gte: cutoff },
  });

  return !!recent;
}

/**
 * Evaluate how relevant a tweet is to our ICP
 */
async function evaluateTweetRelevance(
  tweet: TwitterSearchResult,
  icpProfile: ICPProfile,
  intent: string
): Promise<EngagementCandidate> {
  const prompt = `Evaluate this tweet for ICP engagement.

## Our ICP (Ideal Customer Profile):
Target Audience: ${icpProfile.targetAudience.roles.join(', ')}
Industries: ${icpProfile.targetAudience.industries.join(', ')}
Pain Points: ${icpProfile.painPoints.map(p => p.problem).join('; ')}
Topics: ${icpProfile.topicsOfInterest.join(', ')}

## Tweet to Evaluate:
Author: @${tweet.author?.username} (${tweet.author?.followersCount} followers)
Bio: ${tweet.author?.description || 'No bio'}
Tweet: "${tweet.text}"
Engagement: ${tweet.metrics.likes} likes, ${tweet.metrics.replies} replies, ${tweet.metrics.retweets} RTs
Search Intent: ${intent}

## Evaluate (respond in JSON):
{
  "relevanceScore": 0-10 (how well author matches ICP),
  "engagementPotential": 0-10 (likelihood they'll appreciate our reply),
  "reasons": ["why this is a good/bad candidate"],
  "shouldEngage": true/false,
  "replyAngle": "what angle to take in reply if engaging"
}`;

  try {
    const response = await createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 500,
      preferFast: true, // Use fast model for many evaluations
    });

    const content = response.content;
    if (!content) {
      return {
        tweet,
        relevanceScore: 0,
        engagementPotential: 0,
        reasons: ['Could not evaluate'],
      };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const evaluation = JSON.parse(jsonMatch[0]);
      return {
        tweet,
        relevanceScore: evaluation.relevanceScore || 0,
        engagementPotential: evaluation.engagementPotential || 0,
        reasons: evaluation.reasons || [],
      };
    }
  } catch (error) {
    console.warn('Error evaluating tweet:', error);
  }

  return {
    tweet,
    relevanceScore: 0,
    engagementPotential: 0,
    reasons: ['Evaluation failed'],
  };
}

/**
 * Generate a contextual, value-adding reply using proven Twitter engagement principles
 * 
 * Research-backed strategies for replies that drive profile views:
 * 1. CURIOSITY GAPS - Leave an open loop that makes them want to learn more
 * 2. CONTRARIAN ANGLES - Politely challenge or add nuance (gets 3x engagement)
 * 3. PERSONAL STORIES - "When I did X..." makes replies memorable
 * 4. DATA/SPECIFICS - Numbers and specific details catch attention
 * 5. QUESTIONS - Thoughtful questions encourage replies back
 * 6. VALUE LADDERING - Give 80% value, tease 20% that's on profile
 * 7. PATTERN INTERRUPTS - Start with unexpected hooks
 */
async function generateReply(
  tweet: TwitterSearchResult,
  icpProfile: ICPProfile
): Promise<string | null> {
  // Select a reply formula randomly for variety
  const replyFormulas = [
    'CONTRARIAN - Respectfully add nuance or a different perspective',
    'STORY - Share a brief personal experience that relates',
    'DATA - Add a specific stat, number, or data point',
    'QUESTION - Ask a thought-provoking follow-up question',
    'FRAMEWORK - Share a mental model or framework briefly',
    'MISTAKE - Share a mistake you made related to this',
    'CURIOSITY - Tease deeper insight without fully explaining',
  ];
  
  const selectedFormula = replyFormulas[Math.floor(Math.random() * replyFormulas.length)];
  
  const systemPrompt = `You are a Twitter engagement expert who writes replies that make people click your profile.

## Your Expertise:
${icpProfile.valueProposition.expertise.join(', ')}

## Your Engagement Style:
Tone: ${icpProfile.engagementStyle.tone}
Do: ${icpProfile.engagementStyle.doThis.join('; ')}
Don't: ${icpProfile.engagementStyle.avoidThis.join('; ')}

## PROVEN REPLY PRINCIPLES (research-backed):

### 1. PATTERN INTERRUPT OPENERS (pick one):
- Start with a specific number: "3 things most people miss here..."
- Start with mild disagreement: "Unpopular take:" or "This is 80% right, but..."
- Start with a story hook: "Made this mistake last year."
- Start with a question: "But what about..."
- Start direct (no greeting): Never say "Hey" or "@username"

### 2. THE 80/20 VALUE RULE:
- Give 80% value in the reply itself (be genuinely helpful)
- The remaining 20% should make them curious about YOU
- Don't link, just leave them wanting more

### 3. REPLY STRUCTURES THAT WORK:
${selectedFormula === 'CONTRARIAN' ? `
- "Actually, this works better when..."
- "I'd add one thing: [specific insight]"
- "This is true, except when [nuance]"
- "Counterpoint: [respectful disagreement]"` : ''}
${selectedFormula === 'STORY' ? `
- "Made this mistake last year. Here's what happened..."
- "Tried this with [X]. The result surprised me."
- "Learned this the hard way when..."` : ''}
${selectedFormula === 'DATA' ? `
- "The data says [specific stat]..."
- "87% of [audience] miss this: [insight]"
- "Tested this across [N] [things]. Found that..."` : ''}
${selectedFormula === 'QUESTION' ? `
- "Curious - how do you handle [specific edge case]?"
- "What about when [challenging scenario]?"
- "Does this change if [variable]?"` : ''}
${selectedFormula === 'FRAMEWORK' ? `
- "I think of it as [simple framework]..."
- "My mental model: [brief concept]"
- "The way I break it down: [1], [2], [3]"` : ''}
${selectedFormula === 'MISTAKE' ? `
- "I got this wrong for years. The fix: [specific]"
- "Biggest mistake I made with this: [specific]"
- "What I wish I knew earlier: [insight]"` : ''}
${selectedFormula === 'CURIOSITY' ? `
- "There's a second-order effect most miss..."
- "The real unlock is [tease without explaining]..."
- "This is just the surface. The deeper pattern..."` : ''}

### 4. WHAT MAKES PEOPLE CLICK YOUR PROFILE:
- Demonstrate unexpected expertise
- Show personality (not corporate speak)
- Leave them wanting more context
- Be the person they'd want to follow for more insights

### 5. HARD RULES:
- NO sycophantic openers ("Great point!", "Love this!", "So true!")
- NO self-promotion or links
- NO hashtags in replies
- NO emojis unless they used them
- NO generic advice anyone could give
- MAXIMUM 280 characters (ideally 200-250)
- Sound like a REAL human, not a bot
- Be SPECIFIC not generic

## YOUR FORMULA FOR THIS REPLY: ${selectedFormula}`;

  const userPrompt = `Write a reply using the ${selectedFormula} formula.

Tweet from @${tweet.author?.username}:
"${tweet.text}"

Their bio: ${tweet.author?.description || 'No bio available'}
Their followers: ${tweet.author?.followersCount}

Remember:
- Use the ${selectedFormula} approach
- Be specific to their tweet (don't give generic advice)
- Leave them curious about you
- Sound human, not like a bot
- Under 280 chars (aim for 200-250)

Generate ONLY the reply text. No quotes, no explanation.`;

  try {
    const response = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85, // Slightly higher for more creative replies
      maxTokens: 150,
      preferFast: false, // Use quality model for reply generation
    });

    const reply = response.content?.trim();
    
    // Validate reply
    if (!reply || reply.length > 280) {
      return null;
    }

    // Filter out bad patterns that kill engagement
    const badPatterns = [
      // Sycophantic openers
      /^(great|love|amazing|awesome|nice|fantastic|brilliant|excellent|perfect|wonderful)\s+(point|post|take|insight|thread|perspective|thought)/i,
      /^(this|that|so)\s+(is\s+)?(great|amazing|true|right|perfect)/i,
      /^(couldn't agree more|well said|nailed it|spot on|exactly)/i,
      
      // Self-promotion
      /check out/i,
      /our (product|tool|platform|service|app)/i,
      /sign up/i,
      /link in bio/i,
      /DM me/i,
      /https?:\/\//i,
      
      // Generic bot-like responses
      /^(hey|hi|hello)\s+@/i,
      /thanks for sharing/i,
      /great question/i,
      /^(agree|agreed|100%|this|same)$/i,
      
      // Corporate speak
      /leverage/i,
      /synergy/i,
      /at the end of the day/i,
      /in my experience as a/i,
      /as (a|an) (expert|professional|thought leader)/i,
    ];

    for (const pattern of badPatterns) {
      if (pattern.test(reply)) {
        console.log(`[Reply Validator] Rejected - matched bad pattern: ${pattern}`);
        return null;
      }
    }

    // Quality checks
    // 1. Too short replies don't add value
    if (reply.length < 30) {
      console.log('[Reply Validator] Rejected - too short');
      return null;
    }

    // 2. All caps is spammy
    const capsRatio = (reply.match(/[A-Z]/g) || []).length / reply.length;
    if (capsRatio > 0.5) {
      console.log('[Reply Validator] Rejected - too many caps');
      return null;
    }

    // 3. Check it's not just a question (should have substance)
    if (reply.endsWith('?') && reply.length < 60) {
      const wordCount = reply.split(/\s+/).length;
      if (wordCount < 10) {
        console.log('[Reply Validator] Rejected - question too short to add value');
        return null;
      }
    }

    return reply;
  } catch (error) {
    console.error('Error generating reply:', error);
    return null;
  }
}

/**
 * Save engagement record to database
 */
async function saveEngagement(data: {
  pageId: string;
  platform: 'twitter';
  tweet: TwitterSearchResult;
  reply: string;
  replyId?: string;
  replyUrl?: string;
  icpProfile: ICPProfile;
  relevanceScore: number;
}): Promise<void> {
  try {
    await ICPEngagement.create({
      pageId: new mongoose.Types.ObjectId(data.pageId),
      platform: data.platform,
      targetPost: {
        id: data.tweet.id,
        content: data.tweet.text,
        url: `https://twitter.com/${data.tweet.author?.username}/status/${data.tweet.id}`,
        metrics: data.tweet.metrics,
      },
      targetUser: {
        id: data.tweet.authorId,
        username: data.tweet.author?.username,
        name: data.tweet.author?.name,
        bio: data.tweet.author?.description,
        followersCount: data.tweet.author?.followersCount,
      },
      ourReply: {
        id: data.replyId,
        content: data.reply,
        url: data.replyUrl,
      },
      icpMatch: {
        relevanceScore: data.relevanceScore,
        matchedPainPoints: [],
        matchedTopics: [],
      },
      status: 'sent',
      engagedAt: new Date(),
    });
  } catch (error) {
    console.error('Error saving engagement:', error);
  }
}

/**
 * Score a generated reply for quality before sending
 * Uses AI to evaluate if the reply follows engagement best practices
 */
async function scoreReplyQuality(
  reply: string,
  originalTweet: string,
  authorBio: string
): Promise<{ score: number; issues: string[]; passesQuality: boolean }> {
  const prompt = `Score this Twitter reply for engagement quality.

ORIGINAL TWEET:
"${originalTweet}"

AUTHOR BIO:
"${authorBio}"

REPLY TO EVALUATE:
"${reply}"

SCORING CRITERIA (rate 1-10 each):
1. SPECIFICITY - Does it address the specific tweet or is it generic? (generic = 1, highly specific = 10)
2. VALUE ADD - Does it add new information, perspective, or insight? (no value = 1, high value = 10)
3. CONVERSATION STARTER - Would this make the author want to respond? (boring = 1, engaging = 10)
4. AUTHENTICITY - Does it sound human and genuine? (bot-like = 1, authentic = 10)
5. PROFILE CLICK POTENTIAL - Would this make someone curious to check the replier's profile? (no = 1, definitely = 10)

RED FLAGS (automatic fail):
- Starts with sycophantic praise ("Great point!", "Love this!")
- Generic advice anyone could give
- Self-promotional
- Uses corporate buzzwords
- Doesn't relate to the original tweet

Respond ONLY in JSON:
{
  "scores": {
    "specificity": X,
    "valueAdd": X,
    "conversationStarter": X,
    "authenticity": X,
    "profileClickPotential": X
  },
  "overallScore": X (average),
  "issues": ["list any problems"],
  "passesQuality": true/false (true if overallScore >= 7 and no red flags)
}`;

  try {
    const response = await createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 300,
      preferFast: true, // Use fast model for scoring
    });

    const content = response.content;
    if (!content) {
      return { score: 5, issues: ['Could not evaluate'], passesQuality: false };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        score: result.overallScore || 5,
        issues: result.issues || [],
        passesQuality: result.passesQuality ?? (result.overallScore >= 7),
      };
    }
  } catch (error) {
    console.warn('Error scoring reply:', error);
  }

  return { score: 5, issues: ['Evaluation failed'], passesQuality: false };
}

/**
 * Generate and validate a reply with retries
 * Will regenerate up to maxAttempts times if quality is too low
 */
async function generateAndValidateReply(
  tweet: TwitterSearchResult,
  icpProfile: ICPProfile,
  maxAttempts: number = 3
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const reply = await generateReply(tweet, icpProfile);
    
    if (!reply) {
      console.log(`[Reply Generator] Attempt ${attempt}: Reply rejected by validator`);
      continue;
    }

    // Score the reply quality
    const quality = await scoreReplyQuality(
      reply,
      tweet.text,
      tweet.author?.description || ''
    );

    console.log(`[Reply Generator] Attempt ${attempt}: Score ${quality.score}/10, Passes: ${quality.passesQuality}`);
    
    if (quality.passesQuality) {
      return reply;
    }

    if (quality.issues.length > 0) {
      console.log(`[Reply Generator] Issues: ${quality.issues.join(', ')}`);
    }
  }

  console.log(`[Reply Generator] Failed to generate quality reply after ${maxAttempts} attempts`);
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  runICPEngagementAgent,
};
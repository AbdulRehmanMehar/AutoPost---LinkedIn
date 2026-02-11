/**
 * ICP Engagement System - Index
 * 
 * A system that finds posts from Ideal Customer Profiles (ICPs) on Twitter
 * and generates contextual, value-adding replies to build relationships.
 * 
 * ## Architecture
 * 
 * 1. ICP Analyzer (icp-analyzer.ts)
 *    - Analyzes page content strategy, data sources, and historical posts
 *    - Generates search queries to find ICPs on Twitter
 *    - Creates engagement guidelines for replies
 * 
 * 2. ICP Engagement Agent (icp-engagement-agent.ts)
 *    - Searches Twitter for ICP posts using generated queries
 *    - Evaluates tweet relevance using AI
 *    - Generates contextual, value-adding replies
 *    - Posts replies with rate limiting and safeguards
 * 
 * 3. Twitter Adapter (../platforms/twitter-adapter.ts)
 *    - searchTweets(): Search for recent tweets
 *    - replyToTweet(): Post a reply to a tweet
 *    - likeTweet(): Like a tweet
 *    - getUserTweets(): Get tweets from a specific user
 * 
 * ## API Endpoints
 * 
 * - POST /api/icp-engagement
 *   Run the ICP engagement agent for a page
 *   Body: { pageId, dryRun: true, config?: {...} }
 * 
 * - GET /api/icp-engagement?pageId=xxx
 *   Get engagement stats and recent activity
 * 
 * - GET /api/icp-engagement?pageId=xxx&action=analyze
 *   Analyze and return the ICP profile
 * 
 * - GET /api/cron/icp-engage
 *   Cron job to run agent for all pages with Twitter connections
 * 
 * ## Usage Example
 * 
 * ```typescript
 * import { runICPEngagementAgent } from '@/lib/engagement/icp-engagement-agent';
 * 
 * // Run with dry run (no actual replies)
 * const result = await runICPEngagementAgent(pageId, { dryRun: true });
 * 
 * // Run in production mode
 * const result = await runICPEngagementAgent(pageId, {
 *   dryRun: false,
 *   maxRepliesToSend: 3,
 *   minRelevanceScore: 7,
 * });
 * 
 * console.log(`Sent ${result.repliesSuccessful} replies`);
 * ```
 * 
 * ## ICP Analysis Example
 * 
 * ```typescript
 * import { analyzePageICP } from '@/lib/engagement/icp-analyzer';
 * 
 * const result = await analyzePageICP({
 *   pageId: 'xxx',
 *   includeDataSources: true,
 *   includeHistoricalPosts: true,
 * });
 * 
 * console.log(result.profile.searchQueries);
 * // [
 * //   { query: '"struggling with" SaaS growth', intent: 'problem_awareness', priority: 9 },
 * //   { query: 'ICP definition startup', intent: 'seeking_solution', priority: 8 },
 * //   ...
 * // ]
 * ```
 * 
 * ## Rate Limits (Twitter API v2)
 * 
 * - Basic tier: 10 search requests per 15 min
 * - Pro tier: Higher limits
 * 
 * Recommended: Run agent every 4-6 hours with maxRepliesToSend: 2-3
 * 
 * ## Safety Features
 * 
 * - dryRun mode for testing
 * - Cooldown period between replies to same user (default: 24h)
 * - Follower count filters (avoid bots and mega-accounts)
 * - Content filters (skip promotional tweets, short tweets)
 * - AI review of reply quality before posting
 * - Bad pattern detection (no self-promotion, no sycophancy)
 */

export { analyzePageICP, expandSearchQueries, refineICPFromResults } from './icp-analyzer';
export type { ICPProfile, ICPAnalysisInput, ICPAnalysisResult } from './icp-analyzer';

export { runICPEngagementAgent } from './icp-engagement-agent';
export type { 
  EngagementCandidate, 
  EngagementResult, 
  AgentRunResult, 
  AgentConfig 
} from './icp-engagement-agent';

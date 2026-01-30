/**
 * ICP Analyzer Service
 * 
 * Analyzes a page's content strategy, data sources, and historical posts
 * to understand the Ideal Customer Profile and generate search queries
 * for finding ICP posts on social platforms.
 * 
 * Based on ICP principles:
 * - Urgent + Important problem
 * - Has budget (decision makers)
 * - Underserved market
 * - 10x better positioning
 */

import Page, { IPage, ContentStrategy, DatabaseSource } from '../models/Page';
import Post from '../models/Post';
import { fetchContentForGeneration } from '../data-sources/database';
import { createChatCompletion } from '../ai-client';

// ============================================
// Types
// ============================================

export interface ICPProfile {
  // Core ICP components
  targetAudience: {
    roles: string[];           // "SaaS founders", "Technical PMs", "Startup CTOs"
    industries: string[];      // "B2B SaaS", "Fintech", "Developer Tools"
    companySize: string[];     // "Seed to Series A", "10-50 employees"
    seniority: string[];       // "Founders", "VPs", "Directors"
  };
  
  // Pain points they talk about (for search)
  painPoints: {
    problem: string;
    urgency: 'high' | 'medium' | 'low';
    keywords: string[];        // Search terms for this pain point
  }[];
  
  // Topics they engage with
  topicsOfInterest: string[];
  
  // How we can add value (for reply generation)
  valueProposition: {
    expertise: string[];       // What we know that can help
    uniqueAngle: string;       // Our 10x better angle
    avoidTopics: string[];     // What NOT to engage on
  };
  
  // Search queries to find ICPs
  searchQueries: {
    query: string;
    intent: 'problem_awareness' | 'seeking_solution' | 'discussing_topic' | 'sharing_experience';
    priority: number;          // 1-10
  }[];
  
  // Engagement guidelines
  engagementStyle: {
    tone: string;
    doThis: string[];
    avoidThis: string[];
    exampleReplies: string[];
  };
}

export interface ICPAnalysisInput {
  pageId: string;
  includeDataSources?: boolean;
  includeHistoricalPosts?: boolean;
  maxHistoricalPosts?: number;
}

export interface ICPAnalysisResult {
  success: boolean;
  profile?: ICPProfile;
  error?: string;
  analyzedAt: Date;
  inputSummary: {
    contentStrategy: boolean;
    dataSources: number;
    historicalPosts: number;
  };
}

// ============================================
// ICP Analysis Functions
// ============================================

/**
 * Analyze a page to extract/infer the ICP profile
 */
export async function analyzePageICP(
  input: ICPAnalysisInput
): Promise<ICPAnalysisResult> {
  const { pageId, includeDataSources = true, includeHistoricalPosts = true, maxHistoricalPosts = 20 } = input;
  
  try {
    // Fetch page with content strategy
    const page = await Page.findById(pageId);
    if (!page) {
      return {
        success: false,
        error: 'Page not found',
        analyzedAt: new Date(),
        inputSummary: { contentStrategy: false, dataSources: 0, historicalPosts: 0 },
      };
    }
    
    // Gather context for analysis
    const context: string[] = [];
    let dataSourceCount = 0;
    let historicalPostCount = 0;
    
    // 1. Content Strategy
    if (page.contentStrategy) {
      const strategy = page.contentStrategy as ContentStrategy;
      context.push(`## Content Strategy
- Persona: ${strategy.persona || 'Not specified'}
- Topics: ${strategy.topics?.join(', ') || 'Not specified'}
- Tone: ${strategy.tone || 'Not specified'}
- Target Audience: ${strategy.targetAudience || 'Not specified'}
- Avoid Topics: ${strategy.avoidTopics?.join(', ') || 'None'}
- Custom Instructions: ${strategy.customInstructions || 'None'}`);
    }
    
    // 2. Data Sources (sample content)
    if (includeDataSources && page.dataSources?.databases?.length > 0) {
      const activeSources = page.dataSources.databases.filter((db: DatabaseSource) => db.isActive);
      dataSourceCount = activeSources.length;
      
      for (const source of activeSources.slice(0, 3)) { // Max 3 sources
        try {
          const fetchResult = await fetchContentForGeneration(source, { limit: 5, randomize: true });
          if (fetchResult.success && fetchResult.items?.length) {
            const sampleContent = fetchResult.items
              .slice(0, 3)
              .map(item => `- ${item.title}: ${item.body?.slice(0, 200)}...`)
              .join('\n');
            context.push(`## Data Source: ${source.name}
Sample Content:
${sampleContent}`);
          }
        } catch (e) {
          console.warn(`Could not fetch from data source ${source.name}:`, e);
        }
      }
    }
    
    // 3. Historical Posts (top performing)
    if (includeHistoricalPosts) {
      const posts = await Post.find({
        pageId: page._id,
        status: 'published',
      })
        .sort({ 'metrics.engagementRate': -1 })
        .limit(maxHistoricalPosts)
        .select('content aiAnalysis metrics');
      
      historicalPostCount = posts.length;
      
      if (posts.length > 0) {
        const postSummaries = posts.slice(0, 10).map((post, i) => 
          `${i + 1}. [${post.aiAnalysis?.angle || 'unknown'}] ${post.content?.slice(0, 150)}...`
        ).join('\n');
        context.push(`## Top Performing Historical Posts
${postSummaries}`);
      }
    }
    
    // If no context available, return error
    if (context.length === 0) {
      return {
        success: false,
        error: 'No content strategy, data sources, or historical posts found',
        analyzedAt: new Date(),
        inputSummary: { contentStrategy: false, dataSources: 0, historicalPosts: 0 },
      };
    }
    
    // Generate ICP Profile using AI
    const profile = await generateICPProfile(context.join('\n\n'));
    
    return {
      success: true,
      profile,
      analyzedAt: new Date(),
      inputSummary: {
        contentStrategy: !!page.contentStrategy,
        dataSources: dataSourceCount,
        historicalPosts: historicalPostCount,
      },
    };
  } catch (error) {
    console.error('Error analyzing page ICP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      analyzedAt: new Date(),
      inputSummary: { contentStrategy: false, dataSources: 0, historicalPosts: 0 },
    };
  }
}

/**
 * Use AI to generate a detailed ICP profile from page context
 */
async function generateICPProfile(pageContext: string): Promise<ICPProfile> {
  const systemPrompt = `You are an expert at building Ideal Customer Profiles (ICPs) for B2B SaaS companies.

An effective ICP has three components:
1. URGENT + IMPORTANT PROBLEM - They have a real pain point
2. BUDGET - They can pay for solutions (decision makers)
3. UNDERSERVED - Current solutions aren't 10x better

Your job is to analyze the content strategy, data sources, and historical posts to:
1. Identify WHO the target audience is (roles, industries, seniority)
2. Identify their PAIN POINTS (problems they're struggling with)
3. Generate SEARCH QUERIES to find these people on Twitter
4. Define ENGAGEMENT GUIDELINES for replying to their posts

For search queries, think about:
- What would ICPs tweet when they're frustrated?
- What hashtags do they use?
- What questions do they ask?
- What tools/topics do they discuss?

Output a JSON object with the ICP profile structure.`;

  const userPrompt = `Analyze this page's content to build an ICP profile:

${pageContext}

Generate a detailed ICP profile in this EXACT JSON format:
{
  "targetAudience": {
    "roles": ["specific job titles"],
    "industries": ["specific industries"],
    "companySize": ["company stages/sizes"],
    "seniority": ["decision-making levels"]
  },
  "painPoints": [
    {
      "problem": "specific problem description",
      "urgency": "high|medium|low",
      "keywords": ["search terms for this pain point"]
    }
  ],
  "topicsOfInterest": ["topics they care about"],
  "valueProposition": {
    "expertise": ["what we know that can help them"],
    "uniqueAngle": "our 10x better positioning",
    "avoidTopics": ["topics to NOT engage on"]
  },
  "searchQueries": [
    {
      "query": "Twitter search query",
      "intent": "problem_awareness|seeking_solution|discussing_topic|sharing_experience",
      "priority": 1-10
    }
  ],
  "engagementStyle": {
    "tone": "how to sound",
    "doThis": ["engagement best practices"],
    "avoidThis": ["things to never do"],
    "exampleReplies": ["2-3 example replies that would resonate"]
  }
}

Generate 10-15 search queries covering different intents. Be SPECIFIC with keywords your ICP would actually use.

CRITICAL - Twitter Search Query Rules:
- Use simple keyword matching ONLY (no AND/OR operators)
- Use hashtags for topics: #startup #SaaS
- Use phrases in quotes: "struggling with"
- Combine keywords with spaces: slow product development
- NO parentheses, NO boolean operators
- Examples: "product development taking forever", slow deployment #startup, "agency costs too much"
`;

  const response = await createChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 3000,
  });

  const content = response.content;
  if (!content) {
    throw new Error('Failed to generate ICP profile');
  }

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse ICP profile JSON');
  }

  try {
    const profile = JSON.parse(jsonMatch[0]) as ICPProfile;
    return profile;
  } catch (e) {
    throw new Error(`Invalid JSON in ICP profile: ${e}`);
  }
}

/**
 * Generate additional search queries for a specific pain point
 */
export async function expandSearchQueries(
  profile: ICPProfile,
  painPointIndex: number
): Promise<string[]> {
  const painPoint = profile.painPoints[painPointIndex];
  if (!painPoint) return [];

  const prompt = `Given this ICP pain point:
"${painPoint.problem}"

And these existing keywords: ${painPoint.keywords.join(', ')}

Generate 10 more Twitter search queries that would find people discussing this pain point.
Include:
- Frustrated tweets ("so tired of...", "why is it so hard to...")
- Questions ("how do you handle...", "anyone know how to...")
- Sharing failures ("just spent 3 hours...", "our X broke again")

Return just the queries, one per line.`;

  const response = await createChatCompletion({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    maxTokens: 500,
    preferFast: true,
  });

  const content = response.content;
  if (!content) return [];

  return content.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Validate and refine ICP based on engagement results
 */
export async function refineICPFromResults(
  currentProfile: ICPProfile,
  engagementResults: {
    query: string;
    tweetsFound: number;
    repliesSent: number;
    repliesGotEngagement: number;
  }[]
): Promise<ICPProfile> {
  // Find high-performing queries
  const goodQueries = engagementResults
    .filter(r => r.repliesGotEngagement > 0)
    .map(r => r.query);

  // Find low-performing queries  
  const badQueries = engagementResults
    .filter(r => r.repliesSent > 5 && r.repliesGotEngagement === 0)
    .map(r => r.query);

  if (goodQueries.length === 0 && badQueries.length === 0) {
    return currentProfile; // Not enough data
  }

  const prompt = `Current ICP search queries:
${currentProfile.searchQueries.map(q => `- "${q.query}" (priority: ${q.priority})`).join('\n')}

Queries that got engagement:
${goodQueries.join('\n') || 'None yet'}

Queries with no engagement:
${badQueries.join('\n') || 'None'}

Adjust the search queries based on what's working. Increase priority of similar queries to good ones, decrease or remove similar queries to bad ones.

Return the updated searchQueries array as JSON.`;

  const response = await createChatCompletion({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    maxTokens: 1000,
    preferFast: true,
  });

  const content = response.content;
  if (!content) return currentProfile;

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const newQueries = JSON.parse(jsonMatch[0]);
      return {
        ...currentProfile,
        searchQueries: newQueries,
      };
    }
  } catch {
    // Keep current profile if parsing fails
  }

  return currentProfile;
}

export default {
  analyzePageICP,
  expandSearchQueries,
  refineICPFromResults,
};

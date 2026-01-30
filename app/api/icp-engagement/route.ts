/**
 * ICP Engagement API Route
 * 
 * Endpoints:
 * - POST: Run the ICP engagement agent for a page
 * - GET: Get engagement stats and history
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Page from '@/lib/models/Page';
import ICPEngagement from '@/lib/models/ICPEngagement';
import { runICPEngagementAgent, AgentConfig } from '@/lib/engagement/icp-engagement-agent';
import { analyzePageICP } from '@/lib/engagement/icp-analyzer';
import mongoose from 'mongoose';

/**
 * POST /api/icp-engagement
 * Run the ICP engagement agent
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const { pageId, dryRun = true, config: configOverrides } = body;

    if (!pageId) {
      return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    // Verify user owns this page
    const page = await Page.findById(pageId);
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Check for Twitter connection
    const hasTwitter = page.connections?.some(
      (c: { platform: string; isActive: boolean }) => c.platform === 'twitter' && c.isActive
    );
    if (!hasTwitter) {
      return NextResponse.json(
        { error: 'No active Twitter connection found. Connect Twitter first.' },
        { status: 400 }
      );
    }

    // Build agent config
    const agentConfig: Partial<AgentConfig> = {
      dryRun,
      ...configOverrides,
    };

    console.log(`[API] Running ICP engagement agent for page ${pageId} (dryRun: ${dryRun})`);

    // Run the agent
    const result = await runICPEngagementAgent(pageId, agentConfig);

    return NextResponse.json({
      success: result.success,
      summary: {
        queriesExecuted: result.queriesExecuted,
        tweetsFound: result.tweetsFound,
        tweetsEvaluated: result.tweetsEvaluated,
        repliesSent: result.repliesSent,
        repliesSuccessful: result.repliesSuccessful,
        dryRun,
      },
      engagements: result.engagements.map(e => ({
        tweetId: e.tweet.id,
        tweetText: e.tweet.text.slice(0, 100) + '...',
        author: e.tweet.author?.username,
        reply: e.reply,
        replyUrl: e.replyUrl,
        success: e.success,
        error: e.error,
      })),
      icpProfile: result.icpProfile ? {
        targetAudience: result.icpProfile.targetAudience,
        painPoints: result.icpProfile.painPoints.length,
        searchQueries: result.icpProfile.searchQueries.length,
      } : null,
      errors: result.errors,
      duration: new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime(),
    });
  } catch (error) {
    console.error('[API] ICP engagement error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/icp-engagement?pageId=xxx
 * Get engagement stats and recent activity
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const action = searchParams.get('action');

    if (!pageId) {
      return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    const pageObjectId = new mongoose.Types.ObjectId(pageId);

    // Action: analyze ICP
    if (action === 'analyze') {
      const result = await analyzePageICP({
        pageId,
        includeDataSources: true,
        includeHistoricalPosts: true,
      });

      return NextResponse.json(result);
    }

    // Default: get stats and recent engagements
    const stats = await ICPEngagement.getEngagementStats(pageObjectId, 30);

    const recentEngagements = await ICPEngagement.find({ pageId: pageObjectId })
      .sort({ engagedAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({
      stats,
      recentEngagements: recentEngagements.map(e => ({
        id: e._id,
        platform: e.platform,
        targetUser: e.targetUser,
        targetPost: {
          id: e.targetPost.id,
          content: e.targetPost.content.slice(0, 150) + '...',
          url: e.targetPost.url,
        },
        ourReply: e.ourReply,
        relevanceScore: e.icpMatch.relevanceScore,
        status: e.status,
        followUp: e.followUp,
        engagedAt: e.engagedAt,
      })),
    });
  } catch (error) {
    console.error('[API] Get ICP engagement error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/lib/models/User';
import { 
  EngagementTarget, 
  IEngagementTarget,
  EngagementType 
} from '@/lib/models/Engagement';
import { extractPostUrn, getPostDetails } from '@/lib/linkedin-engagement';
import { generateComment, generateCommentVariations } from '@/lib/openai';

// GET /api/engagements - List engagement targets
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: { userId: typeof user._id; status?: string } = { userId: user._id };
    if (status) {
      query.status = status;
    }

    const engagements = await EngagementTarget.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const serialized = engagements.map((e) => ({
      _id: e._id.toString(),
      postUrl: e.postUrl,
      postUrn: e.postUrn,
      postAuthor: e.postAuthor,
      postContent: e.postContent,
      engagementType: e.engagementType,
      aiGeneratedComment: e.aiGeneratedComment,
      userEditedComment: e.userEditedComment,
      status: e.status,
      scheduledFor: e.scheduledFor?.toISOString(),
      engagedAt: e.engagedAt?.toISOString(),
      error: e.error,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({ engagements: serialized });
  } catch (error) {
    console.error('Error fetching engagements:', error);
    return NextResponse.json({ error: 'Failed to fetch engagements' }, { status: 500 });
  }
}

// POST /api/engagements - Create new engagement target
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      postUrl, 
      engagementType = 'both',
      generateAIComment = true,
      scheduledFor,
    }: {
      postUrl: string;
      engagementType?: EngagementType;
      generateAIComment?: boolean;
      scheduledFor?: string;
    } = body;

    if (!postUrl) {
      return NextResponse.json({ error: 'Post URL is required' }, { status: 400 });
    }

    // Extract post URN from URL
    const postUrn = extractPostUrn(postUrl);
    if (!postUrn) {
      return NextResponse.json({ 
        error: 'Could not extract post URN from URL. Please use a valid LinkedIn post URL.' 
      }, { status: 400 });
    }

    // Check for duplicate
    const existing = await EngagementTarget.findOne({ 
      userId: user._id, 
      postUrn,
      status: { $in: ['pending', 'approved'] }
    });

    if (existing) {
      return NextResponse.json({ 
        error: 'This post is already in your engagement queue' 
      }, { status: 409 });
    }

    // Try to fetch post details (may fail for some posts, that's okay)
    let postContent: string | undefined;
    let postAuthor: string | undefined;

    const postDetails = await getPostDetails(session.user.email, postUrn);
    if (postDetails.success && postDetails.post) {
      postContent = postDetails.post.content;
      postAuthor = postDetails.post.author;
    }

    // Generate AI comment if requested
    let aiGeneratedComment: string | undefined;
    if (generateAIComment && (engagementType === 'comment' || engagementType === 'both')) {
      try {
        if (postContent) {
          aiGeneratedComment = await generateComment({
            postContent,
            postAuthor,
            style: 'professional',
          });
        }
      } catch (aiError) {
        console.error('AI comment generation failed:', aiError);
        // Continue without AI comment
      }
    }

    const engagement = await EngagementTarget.create({
      userId: user._id,
      postUrl,
      postUrn,
      postAuthor,
      postContent,
      engagementType,
      aiGeneratedComment,
      status: 'pending',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    });

    return NextResponse.json({
      success: true,
      engagement: {
        _id: engagement._id.toString(),
        postUrl: engagement.postUrl,
        postUrn: engagement.postUrn,
        postAuthor: engagement.postAuthor,
        postContent: engagement.postContent,
        engagementType: engagement.engagementType,
        aiGeneratedComment: engagement.aiGeneratedComment,
        status: engagement.status,
        scheduledFor: engagement.scheduledFor?.toISOString(),
        createdAt: engagement.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating engagement:', error);
    return NextResponse.json({ error: 'Failed to create engagement' }, { status: 500 });
  }
}

// POST /api/engagements/bulk - Create multiple engagement targets
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      postUrls,
      engagementType = 'both',
    }: {
      postUrls: string[];
      engagementType?: EngagementType;
    } = body;

    if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
      return NextResponse.json({ error: 'Post URLs array is required' }, { status: 400 });
    }

    const results: { url: string; success: boolean; error?: string }[] = [];

    for (const postUrl of postUrls.slice(0, 20)) { // Limit to 20 at a time
      const postUrn = extractPostUrn(postUrl);
      
      if (!postUrn) {
        results.push({ url: postUrl, success: false, error: 'Invalid URL format' });
        continue;
      }

      // Check for duplicate
      const existing = await EngagementTarget.findOne({ 
        userId: user._id, 
        postUrn,
        status: { $in: ['pending', 'approved'] }
      });

      if (existing) {
        results.push({ url: postUrl, success: false, error: 'Already in queue' });
        continue;
      }

      try {
        await EngagementTarget.create({
          userId: user._id,
          postUrl,
          postUrn,
          engagementType,
          status: 'pending',
        });
        results.push({ url: postUrl, success: true });
      } catch {
        results.push({ url: postUrl, success: false, error: 'Failed to create' });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Added ${successful} posts to engagement queue${failed > 0 ? `, ${failed} failed` : ''}`,
      results,
    });
  } catch (error) {
    console.error('Error bulk creating engagements:', error);
    return NextResponse.json({ error: 'Failed to create engagements' }, { status: 500 });
  }
}

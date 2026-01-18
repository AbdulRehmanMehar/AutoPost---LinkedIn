import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/lib/models/User';
import { EngagementTarget, EngagementStatus, EngagementType } from '@/lib/models/Engagement';
import { engageWithPost } from '@/lib/linkedin-engagement';
import { generateComment } from '@/lib/openai';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/engagements/[id] - Get single engagement
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const engagement = await EngagementTarget.findOne({ 
      _id: id, 
      userId: user._id 
    }).lean();

    if (!engagement) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    return NextResponse.json({
      engagement: {
        _id: engagement._id.toString(),
        postUrl: engagement.postUrl,
        postUrn: engagement.postUrn,
        postAuthor: engagement.postAuthor,
        postContent: engagement.postContent,
        engagementType: engagement.engagementType,
        aiGeneratedComment: engagement.aiGeneratedComment,
        userEditedComment: engagement.userEditedComment,
        status: engagement.status,
        scheduledFor: engagement.scheduledFor?.toISOString(),
        engagedAt: engagement.engagedAt?.toISOString(),
        error: engagement.error,
        createdAt: engagement.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching engagement:', error);
    return NextResponse.json({ error: 'Failed to fetch engagement' }, { status: 500 });
  }
}

// PUT /api/engagements/[id] - Update engagement
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      status,
      engagementType,
      userEditedComment,
      scheduledFor,
      regenerateComment,
    }: {
      status?: EngagementStatus;
      engagementType?: EngagementType;
      userEditedComment?: string;
      scheduledFor?: string;
      regenerateComment?: boolean;
    } = body;

    const engagement = await EngagementTarget.findOne({ 
      _id: id, 
      userId: user._id 
    });

    if (!engagement) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    // Regenerate AI comment if requested
    if (regenerateComment && engagement.postContent) {
      try {
        engagement.aiGeneratedComment = await generateComment({
          postContent: engagement.postContent,
          postAuthor: engagement.postAuthor,
          style: 'professional',
        });
      } catch (aiError) {
        console.error('AI comment regeneration failed:', aiError);
      }
    }

    // Update fields
    if (status) engagement.status = status;
    if (engagementType) engagement.engagementType = engagementType;
    if (userEditedComment !== undefined) engagement.userEditedComment = userEditedComment;
    if (scheduledFor) engagement.scheduledFor = new Date(scheduledFor);

    await engagement.save();

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
        userEditedComment: engagement.userEditedComment,
        status: engagement.status,
        scheduledFor: engagement.scheduledFor?.toISOString(),
        engagedAt: engagement.engagedAt?.toISOString(),
        error: engagement.error,
        createdAt: engagement.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating engagement:', error);
    return NextResponse.json({ error: 'Failed to update engagement' }, { status: 500 });
  }
}

// POST /api/engagements/[id] - Execute engagement NOW
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const engagement = await EngagementTarget.findOne({ 
      _id: id, 
      userId: user._id 
    });

    if (!engagement) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    if (!engagement.postUrn) {
      return NextResponse.json({ error: 'Post URN not available' }, { status: 400 });
    }

    if (engagement.status === 'engaged') {
      return NextResponse.json({ error: 'Already engaged with this post' }, { status: 400 });
    }

    // Determine comment to use
    const commentToPost = engagement.userEditedComment || engagement.aiGeneratedComment;

    // Execute engagement
    const result = await engageWithPost(session.user.email, engagement.postUrn, {
      like: engagement.engagementType === 'like' || engagement.engagementType === 'both',
      comment: (engagement.engagementType === 'comment' || engagement.engagementType === 'both') 
        ? commentToPost 
        : undefined,
    });

    if (result.success) {
      engagement.status = 'engaged';
      engagement.engagedAt = new Date();
      engagement.error = undefined;
    } else {
      engagement.status = 'failed';
      engagement.error = result.error;
    }

    await engagement.save();

    return NextResponse.json({
      success: result.success,
      liked: result.liked,
      commented: result.commented,
      error: result.error,
      engagement: {
        _id: engagement._id.toString(),
        status: engagement.status,
        engagedAt: engagement.engagedAt?.toISOString(),
        error: engagement.error,
      },
    });
  } catch (error) {
    console.error('Error executing engagement:', error);
    return NextResponse.json({ error: 'Failed to execute engagement' }, { status: 500 });
  }
}

// DELETE /api/engagements/[id] - Delete engagement
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await EngagementTarget.deleteOne({ 
      _id: id, 
      userId: user._id 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting engagement:', error);
    return NextResponse.json({ error: 'Failed to delete engagement' }, { status: 500 });
  }
}

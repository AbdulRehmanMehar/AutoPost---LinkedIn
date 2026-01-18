import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Post from '@/lib/models/Post';
import { postToLinkedIn } from '@/lib/linkedin';
import User from '@/lib/models/User';

// This API route processes scheduled posts
// You should call this endpoint via a cron job service (e.g., Vercel Cron, GitHub Actions, or external services)
// Recommended: Run every minute or every 5 minutes

export async function GET(request: Request) {
  try {
    // Verify the request is authorized (use a secret key for cron jobs)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization') ?? '';
      const xCronSecret = request.headers.get('x-cron-secret') ?? '';
      const url = new URL(request.url);
      const querySecret = url.searchParams.get('cron_secret') ?? url.searchParams.get('token') ?? '';

      const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : '';
      const authorized = bearerToken === cronSecret || xCronSecret === cronSecret || querySecret === cronSecret;

      if (!authorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    await connectToDatabase();

    // Find all scheduled posts that are due
    const now = new Date();
    const scheduledPosts = await Post.find({
      status: 'scheduled',
      scheduledFor: { $lte: now },
    }).populate('userId');

    const results = [];

    for (const post of scheduledPosts) {
      try {
        // Get the user to get their email
        const user = await User.findById(post.userId);
        
        if (!user) {
          post.status = 'failed';
          post.error = 'User not found';
          await post.save();
          results.push({ postId: post._id, status: 'failed', error: 'User not found' });
          continue;
        }

        const result = await postToLinkedIn(user.email, post.content, post.media || []);

        if (result.success) {
          post.status = 'published';
          post.publishedAt = new Date();
          post.linkedinPostId = result.postId;
          post.error = undefined;
        } else {
          post.status = 'failed';
          post.error = result.error;
        }

        await post.save();
        results.push({
          postId: post._id,
          status: post.status,
          error: post.error,
        });
      } catch (error) {
        post.status = 'failed';
        post.error = error instanceof Error ? error.message : 'Unknown error';
        await post.save();
        results.push({
          postId: post._id,
          status: 'failed',
          error: post.error,
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

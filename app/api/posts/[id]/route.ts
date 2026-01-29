import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Post from '@/lib/models/Post';
import User from '@/lib/models/User';
import { postToLinkedIn } from '@/lib/linkedin';

// GET /api/posts/[id] - Get a specific post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await connectToDatabase();
    
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const post = await Post.findOne({ _id: id, userId: user._id });
    
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/posts/[id] - Update a post
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content, scheduledFor, publishNow } = body;

    await connectToDatabase();
    
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const post = await Post.findOne({ _id: id, userId: user._id });
    
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Can only edit draft or scheduled posts
    if (post.status === 'published') {
      return NextResponse.json({ error: 'Cannot edit published posts' }, { status: 400 });
    }

    // If publishing now
    if (publishNow) {
      const result = await postToLinkedIn(
        session.user.email, 
        content || post.content,
        post.media || [],
        post.postAs || 'person',
        post.organizationId
      );
      
      post.content = content || post.content;
      post.status = result.success ? 'published' : 'failed';
      post.publishedAt = result.success ? new Date() : undefined;
      post.linkedinPostId = result.postId;
      post.error = result.error;
      post.scheduledFor = undefined;
      
      await post.save();
      return NextResponse.json(post);
    }

    // Update content and/or schedule
    if (content) post.content = content;
    if (scheduledFor) {
      post.scheduledFor = new Date(scheduledFor);
      post.status = 'scheduled';
    } else if (scheduledFor === null) {
      post.scheduledFor = undefined;
      post.status = 'draft';
    }

    await post.save();
    return NextResponse.json(post);
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/posts/[id] - Delete a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await connectToDatabase();
    
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const post = await Post.findOneAndDelete({ _id: id, userId: user._id });
    
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

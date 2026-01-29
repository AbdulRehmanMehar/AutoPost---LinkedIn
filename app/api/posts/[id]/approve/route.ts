import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Post from '@/lib/models/Post';

// GET /api/posts/[id]/approve?token=xxx&action=approve|reject
// Handles email approval links
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const action = searchParams.get('action');

    if (!token || !action) {
      return redirectWithMessage('error', 'Missing token or action');
    }

    if (!['approve', 'reject'].includes(action)) {
      return redirectWithMessage('error', 'Invalid action');
    }

    await connectToDatabase();

    const post = await Post.findById(id);
    if (!post) {
      return redirectWithMessage('error', 'Post not found');
    }

    // Verify token
    if (post.approval?.approvalToken !== token) {
      return redirectWithMessage('error', 'Invalid approval token');
    }

    // Check token expiration
    if (post.approval?.tokenExpiresAt && new Date() > post.approval.tokenExpiresAt) {
      return redirectWithMessage('error', 'Approval link has expired');
    }

    // Check if already processed
    if (post.approval?.decision !== 'pending') {
      return redirectWithMessage('info', `This post was already ${post.approval?.decision}`);
    }

    // Process the action
    if (action === 'approve') {
      post.status = 'scheduled';
      post.approval.decision = 'approved';
      post.approval.decidedAt = new Date();
      post.approval.decidedBy = 'email';
    } else {
      post.status = 'rejected';
      post.approval.decision = 'rejected';
      post.approval.decidedAt = new Date();
      post.approval.decidedBy = 'email';
    }

    // Clear the token
    post.approval.approvalToken = undefined;
    post.approval.tokenExpiresAt = undefined;

    await post.save();

    return redirectWithMessage(
      'success',
      action === 'approve' ? 'Post approved and scheduled!' : 'Post rejected'
    );
  } catch (error) {
    console.error('Approval error:', error);
    return redirectWithMessage('error', 'Failed to process approval');
  }
}

function redirectWithMessage(type: 'success' | 'error' | 'info', message: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUrl = `${baseUrl}/dashboard/scheduled?${type}=${encodeURIComponent(message)}`;
  return NextResponse.redirect(redirectUrl);
}

// POST /api/posts/[id]/approve - API-based approval (from dashboard)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, feedbackNote } = body;

    if (!action || !['approve', 'reject', 'edit'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await connectToDatabase();

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (action === 'approve') {
      post.status = 'scheduled';
      post.approval = {
        ...post.approval,
        decision: 'approved',
        decidedAt: new Date(),
        decidedBy: 'dashboard',
        feedbackNote,
        approvalToken: undefined,
        tokenExpiresAt: undefined,
      };
    } else if (action === 'reject') {
      post.status = 'rejected';
      post.approval = {
        ...post.approval,
        decision: 'rejected',
        decidedAt: new Date(),
        decidedBy: 'dashboard',
        feedbackNote,
        approvalToken: undefined,
        tokenExpiresAt: undefined,
      };
    } else if (action === 'edit') {
      // Mark as edited, keep in draft for further editing
      post.status = 'draft';
      post.approval = {
        ...post.approval,
        decision: 'edited',
        decidedAt: new Date(),
        decidedBy: 'dashboard',
        feedbackNote,
        approvalToken: undefined,
        tokenExpiresAt: undefined,
      };
    }

    await post.save();

    return NextResponse.json({
      success: true,
      post: {
        id: post._id,
        status: post.status,
        approval: post.approval,
      },
    });
  } catch (error) {
    console.error('Approval API error:', error);
    return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}

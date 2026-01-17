import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateLinkedInPost, improvePost } from '@/lib/openai';
import { StructuredInput } from '@/lib/models/Post';

interface GenerateRequest {
  mode: 'structured' | 'ai';
  structuredInput?: StructuredInput;
  aiPrompt?: string;
  tone?: 'professional' | 'casual' | 'inspirational' | 'educational';
  includeEmojis?: boolean;
  includeHashtags?: boolean;
  targetAudience?: string;
}

interface ImproveRequest {
  content: string;
  instructions: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'generate') {
      const { mode, structuredInput, aiPrompt, tone, includeEmojis, includeHashtags, targetAudience } = body as GenerateRequest & { action: string };

      if (mode === 'structured' && !structuredInput) {
        return NextResponse.json({ error: 'Structured input is required for structured mode' }, { status: 400 });
      }

      if (mode === 'ai' && !aiPrompt) {
        return NextResponse.json({ error: 'AI prompt is required for AI mode' }, { status: 400 });
      }

      const content = await generateLinkedInPost({
        mode,
        structuredInput,
        aiPrompt,
        tone,
        includeEmojis,
        includeHashtags,
        targetAudience,
      });

      return NextResponse.json({ content });
    }

    if (action === 'improve') {
      const { content, instructions } = body as ImproveRequest & { action: string };

      if (!content || !instructions) {
        return NextResponse.json({ error: 'Content and instructions are required' }, { status: 400 });
      }

      const improvedContent = await improvePost(content, instructions);

      return NextResponse.json({ content: improvedContent });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate content' },
      { status: 500 }
    );
  }
}

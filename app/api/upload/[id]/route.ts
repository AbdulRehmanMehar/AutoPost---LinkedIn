import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteFromS3, getS3KeyFromUrl } from '@/lib/s3';

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
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract the S3 key from the URL
    const key = getS3KeyFromUrl(url);
    
    if (!key) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Security: ensure the key contains the id to prevent unauthorized deletion
    if (!key.includes(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    await deleteFromS3(key);

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Post from '@/lib/models/Post';
import User from '@/lib/models/User';
import { getFromS3, getS3KeyFromUrl, uploadToS3 } from '@/lib/s3';
import { processVideoForLinkedIn, processImageForLinkedIn, checkFfmpegAvailable } from '@/lib/ffmpeg';
import { randomUUID } from 'crypto';

// POST /api/posts/[id]/reprocess - Reprocess media for a failed post
export async function POST(
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

    // Check if ffmpeg is available
    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      return NextResponse.json({ 
        error: 'ffmpeg is not available. Cannot process media.' 
      }, { status: 500 });
    }

    if (!post.media || post.media.length === 0) {
      return NextResponse.json({ 
        error: 'No media to process' 
      }, { status: 400 });
    }

    const processedMedia = [];
    const errors = [];

    for (const item of post.media) {
      try {
        console.log(`Processing ${item.type}: ${item.filename}`);
        
        // Get the S3 key from the URL
        const s3Key = getS3KeyFromUrl(item.url);
        if (!s3Key) {
          errors.push(`Could not extract S3 key from URL: ${item.url}`);
          continue;
        }

        // Fetch the original file from S3
        const originalBuffer = await getFromS3(s3Key);
        console.log(`Fetched ${item.filename} (${originalBuffer.length} bytes)`);

        let processedBuffer: Buffer;
        let newFilename: string;
        let newMimeType: string;

        if (item.type === 'video') {
          // Process video
          console.log(`Converting video to MP4...`);
          const processed = await processVideoForLinkedIn(originalBuffer, item.filename);
          processedBuffer = processed.buffer;
          newFilename = processed.filename;
          newMimeType = processed.mimeType;
          console.log(`Video converted: ${newFilename} (${(processedBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
        } else {
          // Process image
          console.log(`Optimizing image...`);
          const processed = await processImageForLinkedIn(originalBuffer, item.filename, item.mimeType);
          processedBuffer = processed.buffer;
          newFilename = processed.filename;
          newMimeType = processed.mimeType;
          console.log(`Image optimized: ${newFilename} (${(processedBuffer.length / 1024).toFixed(2)}KB)`);
        }

        // Upload processed file to S3 with new key
        const newId = randomUUID();
        const extension = newMimeType.includes('mp4') ? 'mp4' : 'jpg';
        const newS3Key = `media/${newId}.${extension}`;
        
        const newUrl = await uploadToS3(newS3Key, processedBuffer, newMimeType);
        console.log(`Uploaded processed file to: ${newUrl}`);

        processedMedia.push({
          id: newId,
          url: newUrl,
          type: item.type,
          filename: newFilename,
          mimeType: newMimeType,
          size: processedBuffer.length,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process ${item.filename}:`, errorMessage);
        errors.push(`${item.filename}: ${errorMessage}`);
      }
    }

    if (processedMedia.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to process any media',
        details: errors 
      }, { status: 500 });
    }

    // Update the post with processed media
    post.media = processedMedia;
    post.status = 'draft'; // Reset status so it can be published again
    post.error = undefined;
    await post.save();

    return NextResponse.json({
      success: true,
      message: `Processed ${processedMedia.length} media file(s)`,
      post: post.toObject(),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error reprocessing media:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

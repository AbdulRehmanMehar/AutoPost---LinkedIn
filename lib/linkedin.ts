import connectToDatabase from '@/lib/mongodb';
import User from '@/lib/models/User';
import { MediaItem } from './models/Post';
import { getFromS3, getS3KeyFromUrl } from './s3';
import { processVideoForLinkedIn, processImageForLinkedIn, checkFfmpegAvailable, combineVideos } from './ffmpeg';

interface LinkedInPostResponse {
  id: string;
}

interface LinkedInRegisterUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
      };
    };
    asset: string;
  };
}

// LinkedIn Media Rules (from official docs):
// - Multiple Images: 2-20 images per post (using MultiImage API / newer Posts API)
// - Single Video: Only 1 video per post
// - Cannot mix videos and images in the same post
// - UGC Posts API (legacy) supports single media or array of same type

async function registerMediaUpload(
  accessToken: string,
  personUrn: string,
  mediaType: 'image' | 'video'
): Promise<{ uploadUrl: string; asset: string }> {
  const recipeType = mediaType === 'image' 
    ? 'urn:li:digitalmediaRecipe:feedshare-image'
    : 'urn:li:digitalmediaRecipe:feedshare-video';

  const response = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: [recipeType],
        owner: personUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to register upload: ${errorText}`);
  }

  const data: LinkedInRegisterUploadResponse = await response.json();
  
  return {
    uploadUrl: data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
    asset: data.value.asset,
  };
}

async function uploadMedia(uploadUrl: string, fileBuffer: Buffer, accessToken: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload media: ${response.status}`);
  }
}

async function checkAssetStatus(
  accessToken: string,
  asset: string
): Promise<{ status: 'PROCESSING' | 'AVAILABLE' | 'FAILED'; details?: string }> {
  // Extract just the asset ID from the URN
  // urn:li:digitalmediaAsset:D4D05AQG1TkWry7Po3A -> D4D05AQG1TkWry7Po3A
  const assetId = asset.includes(':') ? asset.split(':').pop() : asset;
  
  const response = await fetch(`https://api.linkedin.com/v2/assets/${assetId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to check asset status:', errorText);
    return { status: 'FAILED', details: errorText };
  }

  const data = await response.json();
  console.log('Asset status response:', JSON.stringify(data, null, 2));
  
  const recipe = data.recipes?.[0];
  const status = recipe?.status || 'PROCESSING';
  
  // Get more details if available
  const details = recipe?.statusDetails || recipe?.errorMessage || '';
  
  if (status === 'AVAILABLE') return { status: 'AVAILABLE' };
  if (status === 'PROCESSING' || status === 'WAITING_UPLOAD' || status === 'NEW') return { status: 'PROCESSING' };
  return { status: 'FAILED', details: details || `Status: ${status}` };
}

async function waitForAssetReady(
  accessToken: string,
  asset: string,
  maxWaitMs: number = 120000 // 2 minutes max wait
): Promise<{ ready: boolean; error?: string }> {
  const startTime = Date.now();
  const pollIntervalMs = 5000; // Poll every 5 seconds
  
  while (Date.now() - startTime < maxWaitMs) {
    const { status, details } = await checkAssetStatus(accessToken, asset);
    
    if (status === 'AVAILABLE') {
      return { ready: true };
    }
    
    if (status === 'FAILED') {
      console.error(`Asset ${asset} processing failed: ${details}`);
      return { ready: false, error: details };
    }
    
    console.log(`Asset ${asset} still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  console.error(`Asset ${asset} processing timed out after ${maxWaitMs}ms`);
  return { ready: false, error: 'Processing timed out' };
}

async function fetchMediaBuffer(url: string): Promise<Buffer> {
  // Check if it's an S3/MinIO URL
  const s3Key = getS3KeyFromUrl(url);
  
  if (s3Key) {
    // Fetch from S3/MinIO
    console.log(`Fetching from S3 with key: ${s3Key}`);
    try {
      const buffer = await getFromS3(s3Key);
      console.log(`Successfully fetched ${buffer.length} bytes from S3`);
      return buffer;
    } catch (s3Error) {
      console.error(`S3 fetch failed for key ${s3Key}:`, s3Error);
      throw s3Error;
    }
  }
  
  // Fallback: fetch from URL directly (for external URLs)
  console.log(`S3 key extraction failed, fetching directly from URL: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch media from URL: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  console.log(`Successfully fetched ${arrayBuffer.byteLength} bytes from URL`);
  return Buffer.from(arrayBuffer);
}

export async function postToLinkedIn(
  userId: string,
  content: string,
  media: MediaItem[] = []
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    await connectToDatabase();
    
    const user = await User.findOne({ email: userId });
    
    if (!user || !user.linkedinAccessToken || !user.linkedinId) {
      return { success: false, error: 'User not connected to LinkedIn' };
    }

    // Check if token is expired
    if (user.linkedinAccessTokenExpires && new Date() > user.linkedinAccessTokenExpires) {
      return { success: false, error: 'LinkedIn access token expired. Please reconnect.' };
    }

    const personUrn = `urn:li:person:${user.linkedinId}`;
    const uploadedAssets: { asset: string; type: 'image' | 'video'; filename: string }[] = [];

    // Check if ffmpeg is available for media processing
    const ffmpegAvailable = await checkFfmpegAvailable();

    // Upload media if present
    // LinkedIn rules (from official docs):
    // - Multiple images: 2-20 images per post (using UGC Posts API with IMAGE category)
    // - Only ONE video allowed per post
    // - Cannot mix videos and images in the same post
    // - If multiple videos provided and ffmpeg available, combine them side-by-side
    const videos = media.filter(m => m.type === 'video');
    const images = media.filter(m => m.type === 'image');
    
    let mediaToUpload: typeof media = [];
    let combinedVideoBuffer: Buffer | null = null;
    let combinedVideoFilename = 'combined-video.mp4';
    
    if (videos.length > 0) {
      if (images.length > 0) {
        console.warn('LinkedIn does not allow mixing videos and images. Using video(s) only.');
      }
      
      if (videos.length > 1 && ffmpegAvailable) {
        // Combine multiple videos into one side-by-side video
        console.log(`Combining ${videos.length} videos into one side-by-side video...`);
        
        try {
          // Fetch all video buffers
          const videoInputs = await Promise.all(
            videos.slice(0, 4).map(async (v) => ({
              buffer: await fetchMediaBuffer(v.url),
              filename: v.filename || 'video',
            }))
          );
          
          // Combine videos
          const layout = videos.length === 2 ? 'horizontal' : 'grid';
          const combined = await combineVideos(videoInputs, layout);
          combinedVideoBuffer = combined.buffer;
          combinedVideoFilename = combined.filename;
          
          console.log(`Videos combined successfully: ${combinedVideoFilename} (${(combinedVideoBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
          
          // Create a synthetic media item for the combined video
          mediaToUpload = [{
            id: 'combined',
            url: '', // Not used since we have the buffer
            type: 'video' as const,
            filename: combinedVideoFilename,
            mimeType: 'video/mp4',
            size: combinedVideoBuffer.length,
          }];
        } catch (combineError) {
          console.error('Failed to combine videos:', combineError);
          console.warn('Falling back to first video only.');
          mediaToUpload = [videos[0]];
        }
      } else {
        // Single video or ffmpeg not available
        if (videos.length > 1 && !ffmpegAvailable) {
          console.warn('Multiple videos provided but ffmpeg not available to combine them. Using first video only.');
        }
        mediaToUpload = [videos[0]];
      }
    } else if (images.length > 0) {
      // Use all images (up to 20 per LinkedIn MultiImage API docs)
      if (images.length > 20) {
        console.warn('LinkedIn allows maximum 20 images per post. Using first 20 only.');
        mediaToUpload = images.slice(0, 20);
      } else {
        mediaToUpload = images;
      }
    }

    if (!ffmpegAvailable && mediaToUpload.length > 0 && !combinedVideoBuffer) {
      console.warn('ffmpeg not available - uploading media without processing. Video uploads may fail if not in MP4 format.');
    }

    if (mediaToUpload.length > 0) {
      for (const item of mediaToUpload) {
        try {
          console.log(`Processing ${item.type}: ${item.filename}`);
          
          // Use combined video buffer if available, otherwise fetch from URL
          let fileBuffer: Buffer;
          let filename = item.filename || 'Media';
          
          if (combinedVideoBuffer && item.id === 'combined') {
            fileBuffer = combinedVideoBuffer;
            filename = combinedVideoFilename;
          } else {
            // Fetch the file from S3/MinIO
            console.log(`Fetching media from: ${item.url}`);
            fileBuffer = await fetchMediaBuffer(item.url);
          }
          
          // Process media with ffmpeg if available (skip if already combined)
          // Also skip if the video is already a pre-combined video (from our fix-failed-post script)
          const isPreCombinedVideo = item.type === 'video' && item.url?.includes('/combined/');
          
          if (ffmpegAvailable && !combinedVideoBuffer && !isPreCombinedVideo) {
            if (item.type === 'video') {
              console.log(`Converting video to LinkedIn-compatible format (MP4 H.264)...`);
              const processed = await processVideoForLinkedIn(fileBuffer, filename);
              fileBuffer = processed.buffer;
              filename = processed.filename;
              console.log(`Video processed: ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
            } else if (item.type === 'image') {
              console.log(`Optimizing image for LinkedIn...`);
              const processed = await processImageForLinkedIn(fileBuffer, filename, item.mimeType || 'image/jpeg');
              fileBuffer = processed.buffer;
              filename = processed.filename;
              console.log(`Image processed: ${filename} (${(fileBuffer.length / 1024).toFixed(2)}KB)`);
            }
          } else if (isPreCombinedVideo) {
            console.log(`Video is already pre-combined and processed, skipping re-encoding`);
          } else if (ffmpegAvailable && item.type === 'image') {
            // Still process images even when we have a combined video
            console.log(`Optimizing image for LinkedIn...`);
            const processed = await processImageForLinkedIn(fileBuffer, filename, item.mimeType || 'image/jpeg');
            fileBuffer = processed.buffer;
            filename = processed.filename;
            console.log(`Image processed: ${filename} (${(fileBuffer.length / 1024).toFixed(2)}KB)`);
          }
          
          console.log(`Registering upload for ${item.type}: ${filename}`);
          
          const { uploadUrl, asset } = await registerMediaUpload(
            user.linkedinAccessToken,
            personUrn,
            item.type
          );

          console.log(`Uploading media (${fileBuffer.length} bytes) to LinkedIn...`);
          
          await uploadMedia(uploadUrl, fileBuffer, user.linkedinAccessToken);
          console.log(`Upload complete for asset: ${asset}`);
          
          // For videos, wait for processing to complete
          if (item.type === 'video') {
            console.log('Waiting for LinkedIn video processing...');
            const result = await waitForAssetReady(user.linkedinAccessToken, asset);
            if (!result.ready) {
              console.error('Video processing failed or timed out:', result.error);
              return { 
                success: false, 
                error: `LinkedIn video processing failed: ${result.error || 'Unknown error. The video may be corrupted or in an unsupported format.'}` 
              };
            }
            console.log('LinkedIn video processing complete');
          }
          
          uploadedAssets.push({ asset, type: item.type, filename });
        } catch (uploadError) {
          console.error('Media upload error:', uploadError);
          const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
          return { success: false, error: `Media upload failed: ${errorMessage}` };
        }
      }
    }

    // Determine media category and build post body
    let shareMediaCategory = 'NONE';
    let mediaContent: object[] = [];

    if (uploadedAssets.length > 0) {
      const hasVideo = uploadedAssets.some(m => m.type === 'video');
      shareMediaCategory = hasVideo ? 'VIDEO' : 'IMAGE';
      
      mediaContent = uploadedAssets.map((item) => ({
        status: 'READY',
        description: {
          text: item.filename,
        },
        media: item.asset,
        title: {
          text: item.filename,
        },
      }));
      
      console.log(`Posting with ${uploadedAssets.length} media asset(s), category: ${shareMediaCategory}`);
    } else if (mediaToUpload.length > 0) {
      // We had media to upload but nothing was uploaded - this is an error!
      console.error('CRITICAL: Had media to upload but uploadedAssets is empty!');
      return { 
        success: false, 
        error: 'Media upload failed silently - no assets were uploaded to LinkedIn' 
      };
    } else {
      console.log('Posting text-only content (no media)');
    }

    const postBody = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory,
          ...(mediaContent.length > 0 && { media: mediaContent }),
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.linkedinAccessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('LinkedIn API error:', errorData);
      
      // Parse specific LinkedIn error messages
      let errorMessage = `LinkedIn API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson.message) {
          errorMessage = `LinkedIn: ${errorJson.message}`;
        } else if (errorJson.serviceErrorCode) {
          errorMessage = `LinkedIn error code ${errorJson.serviceErrorCode}: ${errorJson.message || 'Unknown error'}`;
        }
      } catch {
        // Use raw error text if not JSON
        if (errorData) {
          errorMessage = `LinkedIn API error: ${errorData.substring(0, 200)}`;
        }
      }
      
      return { success: false, error: errorMessage };
    }

    const data: LinkedInPostResponse = await response.json();
    return { success: true, postId: data.id };
  } catch (error) {
    console.error('Error posting to LinkedIn:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to post to LinkedIn';
    return { success: false, error: errorMessage };
  }
}

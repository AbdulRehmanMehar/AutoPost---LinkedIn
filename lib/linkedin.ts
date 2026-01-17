import connectToDatabase from '@/lib/mongodb';
import User from '@/lib/models/User';
import { MediaItem } from './models/Post';
import { getFromS3, getS3KeyFromUrl } from './s3';

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

async function fetchMediaBuffer(url: string): Promise<Buffer> {
  // Check if it's an S3/MinIO URL
  const s3Key = getS3KeyFromUrl(url);
  
  if (s3Key) {
    // Fetch from S3/MinIO
    return await getFromS3(s3Key);
  }
  
  // Fallback: fetch from URL directly (for external URLs)
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
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
    const uploadedAssets: string[] = [];

    // Upload media if present
    if (media.length > 0) {
      for (const item of media) {
        try {
          const { uploadUrl, asset } = await registerMediaUpload(
            user.linkedinAccessToken,
            personUrn,
            item.type
          );

          // Fetch the file from S3/MinIO
          const fileBuffer = await fetchMediaBuffer(item.url);
          await uploadMedia(uploadUrl, fileBuffer, user.linkedinAccessToken);
          
          uploadedAssets.push(asset);
        } catch (uploadError) {
          console.error('Media upload error:', uploadError);
          // Continue with text-only post if media upload fails
        }
      }
    }

    // Determine media category and build post body
    let shareMediaCategory = 'NONE';
    let mediaContent: object[] = [];

    if (uploadedAssets.length > 0) {
      const hasVideo = media.some(m => m.type === 'video');
      shareMediaCategory = hasVideo ? 'VIDEO' : 'IMAGE';
      
      mediaContent = uploadedAssets.map((asset, index) => ({
        status: 'READY',
        description: {
          text: media[index]?.filename || 'Media',
        },
        media: asset,
        title: {
          text: media[index]?.filename || 'Media',
        },
      }));
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
      return { success: false, error: `LinkedIn API error: ${response.status}` };
    }

    const data: LinkedInPostResponse = await response.json();
    return { success: true, postId: data.id };
  } catch (error) {
    console.error('Error posting to LinkedIn:', error);
    return { success: false, error: 'Failed to post to LinkedIn' };
  }
}

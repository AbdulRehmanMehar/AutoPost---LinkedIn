#!/usr/bin/env node

/**
 * Script to test uploading a video directly to LinkedIn
 * This helps debug video processing failures
 * 
 * Usage:
 *   node scripts/test-linkedin-video.mjs <video-url>
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';

// Load environment variables
dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function registerUpload(accessToken, personUrn) {
  const response = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
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
    throw new Error(`Register upload failed: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    uploadUrl: data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
    asset: data.value.asset,
  };
}

async function uploadVideo(uploadUrl, buffer, accessToken) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  }
  
  return true;
}

async function checkAssetStatus(accessToken, asset) {
  // Extract just the asset ID from the URN
  // urn:li:digitalmediaAsset:D4D05AQG1TkWry7Po3A -> D4D05AQG1TkWry7Po3A
  const assetId = asset.includes(':') ? asset.split(':').pop() : asset;
  
  // Try the assets endpoint first
  let response = await fetch(`https://api.linkedin.com/v2/assets/${assetId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    log(`First attempt failed (${response.status}), trying with full URN...`, 'yellow');
    
    // Try with encoded full URN
    response = await fetch(`https://api.linkedin.com/v2/assets/${encodeURIComponent(asset)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  }
  
  if (!response.ok) {
    log(`Second attempt failed (${response.status}), trying digitalMediaAssets endpoint...`, 'yellow');
    
    // Try the digitalMediaAssets endpoint 
    response = await fetch(`https://api.linkedin.com/rest/videos/${encodeURIComponent(asset)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to check status:', errorText);
    return null;
  }

  return await response.json();
}

async function waitForProcessing(accessToken, asset, maxWaitMs = 120000) {
  const startTime = Date.now();
  const pollInterval = 3000;
  
  while (Date.now() - startTime < maxWaitMs) {
    const data = await checkAssetStatus(accessToken, asset);
    
    if (!data) {
      return { success: false, error: 'Failed to get status' };
    }
    
    log(`\nFull asset status:`, 'cyan');
    console.log(JSON.stringify(data, null, 2));
    
    const recipe = data.recipes?.[0];
    const status = recipe?.status;
    
    log(`Status: ${status}`, status === 'AVAILABLE' ? 'green' : status === 'FAILED' ? 'red' : 'yellow');
    
    if (status === 'AVAILABLE') {
      return { success: true };
    }
    
    if (status === 'FAILED' || status === 'CLIENT_ERROR') {
      // Try to get more error details
      const errorDetails = {
        status,
        statusDetails: recipe?.statusDetails,
        errorMessage: recipe?.errorMessage,
        mediaType: data.mediaTypeFamily,
        serviceRelationships: data.serviceRelationships,
      };
      return { success: false, error: errorDetails };
    }
    
    log(`Waiting... (${Math.round((Date.now() - startTime) / 1000)}s)`, 'yellow');
    await new Promise(r => setTimeout(r, pollInterval));
  }
  
  return { success: false, error: 'Timeout' };
}

async function main() {
  const videoUrl = process.argv[2];
  
  if (!videoUrl) {
    console.log('Usage: node scripts/test-linkedin-video.mjs <video-url-or-local-path>');
    console.log('Example: node scripts/test-linkedin-video.mjs /tmp/test-video.mp4');
    console.log('Example: node scripts/test-linkedin-video.mjs http://192.168.1.9:7675/...');
    process.exit(1);
  }
  
  log('\n=== LinkedIn Video Upload Test ===\n', 'cyan');
  
  // Connect to MongoDB to get user token
  log('Connecting to MongoDB...', 'blue');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  
  const db = client.db();
  const user = await db.collection('users').findOne({});
  
  if (!user || !user.linkedinAccessToken) {
    log('No user with LinkedIn access token found', 'red');
    process.exit(1);
  }
  
  log(`Found user: ${user.email}`, 'green');
  
  const accessToken = user.linkedinAccessToken;
  const personUrn = `urn:li:person:${user.linkedinId}`;
  
  // Load video
  log('\nLoading video...', 'blue');
  let videoBuffer;
  
  if (videoUrl.startsWith('http')) {
    // Fetch from URL
    const response = await fetch(videoUrl);
    if (!response.ok) {
      log(`Failed to fetch video: ${response.status}`, 'red');
      process.exit(1);
    }
    videoBuffer = Buffer.from(await response.arrayBuffer());
  } else {
    // Local file
    videoBuffer = await readFile(videoUrl);
  }
  
  log(`Video size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`, 'green');
  
  // Register upload
  log('\nRegistering upload with LinkedIn...', 'blue');
  const { uploadUrl, asset } = await registerUpload(accessToken, personUrn);
  log(`Asset: ${asset}`, 'green');
  
  // Upload
  log('\nUploading video...', 'blue');
  await uploadVideo(uploadUrl, videoBuffer, accessToken);
  log('Upload complete!', 'green');
  
  // Wait for processing
  log('\nWaiting for LinkedIn to process video...', 'blue');
  const result = await waitForProcessing(accessToken, asset);
  
  if (result.success) {
    log('\n✅ Video processed successfully!', 'green');
    log(`Asset URN: ${asset}`, 'green');
  } else {
    log('\n❌ Video processing failed!', 'red');
    log('Error details:', 'red');
    console.log(JSON.stringify(result.error, null, 2));
  }
  
  await client.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

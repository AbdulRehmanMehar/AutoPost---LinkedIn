#!/usr/bin/env node

/**
 * Migration Script: Update publishTo.platforms for existing pages
 * 
 * This script updates existing pages to include Facebook and Twitter
 * in their publishTo.platforms array if they have those connections active.
 */

import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function migrate() {
  console.log('🔄 Starting migration: Update publishTo.platforms\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const pagesCollection = db.collection('pages');

    // Find all active pages
    const pages = await pagesCollection.find({ isActive: true }).toArray();
    console.log(`📊 Found ${pages.length} active pages\n`);

    let updated = 0;
    let skipped = 0;

    for (const page of pages) {
      const currentPlatforms = page.publishTo?.platforms || ['linkedin'];
      const connections = page.connections || [];
      
      // Build new platform list based on active connections
      const newPlatforms = ['linkedin']; // Always include LinkedIn
      
      // Add Facebook if connected
      const hasFacebook = connections.some(c => c.platform === 'facebook' && c.isActive);
      if (hasFacebook && !currentPlatforms.includes('facebook')) {
        newPlatforms.push('facebook');
      } else if (currentPlatforms.includes('facebook')) {
        newPlatforms.push('facebook');
      }
      
      // Add Twitter if connected
      const hasTwitter = connections.some(c => c.platform === 'twitter' && c.isActive);
      if (hasTwitter && !currentPlatforms.includes('twitter')) {
        newPlatforms.push('twitter');
      } else if (currentPlatforms.includes('twitter')) {
        newPlatforms.push('twitter');
      }
      
      // Add Instagram if connected
      const hasInstagram = connections.some(c => c.platform === 'instagram' && c.isActive);
      if (hasInstagram && !currentPlatforms.includes('instagram')) {
        newPlatforms.push('instagram');
      } else if (currentPlatforms.includes('instagram')) {
        newPlatforms.push('instagram');
      }

      // Check if update is needed
      const needsUpdate = JSON.stringify(currentPlatforms.sort()) !== JSON.stringify(newPlatforms.sort());
      
      if (needsUpdate) {
        console.log(`📝 Updating page: ${page.name}`);
        console.log(`   Old platforms: ${currentPlatforms.join(', ')}`);
        console.log(`   New platforms: ${newPlatforms.join(', ')}`);
        
        await pagesCollection.updateOne(
          { _id: page._id },
          {
            $set: {
              'publishTo.platforms': newPlatforms,
              'publishTo.adaptContent': true,
            }
          }
        );
        
        updated++;
        console.log(`   ✅ Updated\n`);
      } else {
        console.log(`⏭️  Skipping page: ${page.name} (already configured correctly)`);
        skipped++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total pages: ${pages.length}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run migration
migrate().catch(console.error);

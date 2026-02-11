#!/usr/bin/env node

/**
 * Enable Multi-Platform Post Generation
 * 
 * This script updates your page to generate posts for all connected platforms
 * instead of just one at a time.
 */

import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;
const PAGE_ID = process.env.PAGE_ID || '697a8625f047b183f44c15f7'; // Your default page

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function enableMultiPlatform() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const page = await db.collection('pages').findOne({
      _id: new mongoose.Types.ObjectId(PAGE_ID),
    });

    if (!page) {
      console.error(`❌ Page not found with ID: ${PAGE_ID}`);
      process.exit(1);
    }

    console.log(`📄 Page: ${page.name}\n`);

    // Get active connections
    const activeConnections = (page.connections || [])
      .filter(c => c.isActive)
      .map(c => c.platform);

    console.log('🔌 Active Connections:');
    activeConnections.forEach(p => console.log(`   - ${p}`));
    console.log('');

    // Current publishTo configuration
    const currentPlatforms = page.publishTo?.platforms || ['linkedin'];
    console.log('📮 Current publishTo.platforms:', currentPlatforms.join(', '));
    console.log('');

    // New configuration - all active connections
    const newPlatforms = activeConnections.length > 0 ? activeConnections : ['linkedin'];
    
    if (JSON.stringify(currentPlatforms.sort()) === JSON.stringify(newPlatforms.sort())) {
      console.log('✅ Already configured correctly! No changes needed.');
      console.log('');
      console.log('The system will generate posts for:', newPlatforms.join(', '));
    } else {
      console.log('🔧 Updating configuration...\n');

      const result = await db.collection('pages').updateOne(
        { _id: new mongoose.Types.ObjectId(PAGE_ID) },
        {
          $set: {
            'publishTo.platforms': newPlatforms,
            'publishTo.adaptContent': true,
          },
        }
      );

      if (result.modifiedCount > 0) {
        console.log('✅ Page updated successfully!\n');
        console.log('📮 New publishTo.platforms:', newPlatforms.join(', '));
        console.log('');
        console.log('ℹ️  The auto-generate cron will now create posts for all these platforms.');
        console.log('ℹ️  Each platform will get an optimized version of the content.');
      } else {
        console.log('⚠️  No changes made. Configuration might already be correct.');
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('HOW IT WORKS:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('When auto-generate runs, it will:');
    console.log('  1. Loop through each platform in publishTo.platforms');
    console.log('  2. Generate platform-optimized content for each one');
    console.log('  3. Create separate posts targeting each platform');
    console.log('  4. Use platform-specific learning and timing');
    console.log('');
    console.log('Example: If you have LinkedIn + Twitter connected:');
    console.log('  - Creates Post A → LinkedIn (3000 chars, professional)');
    console.log('  - Creates Post B → Twitter (280 chars, punchy)');
    console.log('  - Both posts on the same topic but optimized per platform');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

enableMultiPlatform();

#!/usr/bin/env node

import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

async function diagnose() {
  await mongoose.connect(MONGODB_URI);
  
  const db = mongoose.connection.db;
  
  console.log('🔍 DIAGNOSIS: Facebook & Twitter Post Generation\n');
  console.log('='.repeat(60));
  
  // 1. Check Page Configuration
  console.log('\n1️⃣  PAGE CONFIGURATION');
  console.log('-'.repeat(60));
  
  const page = await db.collection('pages').findOne({ name: 'PrimeStrides' });
  
  console.log(`✓ Page Name: ${page.name}`);
  console.log(`✓ Auto-Generate: ${page.schedule?.autoGenerate ? 'YES ✅' : 'NO ❌'}`);
  console.log(`✓ Auto-Approve: ${page.schedule?.autoApprove ? 'YES ✅' : 'NO ❌'}`);
  console.log(`✓ Active: ${page.isActive ? 'YES ✅' : 'NO ❌'}`);
  console.log(`✓ publishTo.platforms: ${page.publishTo?.platforms?.join(', ') || 'NOT SET ❌'}`);
  
  console.log('\n  Connected Platforms:');
  page.connections?.forEach(c => {
    console.log(`    - ${c.platform.toUpperCase()}: ${c.isActive ? '✅ Active' : '❌ Inactive'} (${c.platformUsername})`);
  });
  
  // 2. Check Recent Posts
  console.log('\n\n2️⃣  RECENT POSTS (Last 7 days)');
  console.log('-'.repeat(60));
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const posts = await db.collection('posts')
    .find({ 
      pageId: page._id,
      createdAt: { $gte: weekAgo }
    })
    .sort({ createdAt: -1 })
    .toArray();
  
  if (posts.length === 0) {
    console.log('❌ NO POSTS GENERATED IN LAST 7 DAYS');
    console.log('\n   Reasons why posts might not be generated:');
    console.log('   1. Auto-generate cron not running');
    console.log('   2. Wrong day of week (check preferredDays)');
    console.log('   3. Frequency limit reached (check postingFrequency)');
  } else {
    console.log(`✓ Found ${posts.length} posts\n`);
    
    posts.forEach((p, i) => {
      console.log(`${i + 1}. ${p.content?.substring(0, 50)}...`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Target Platforms: ${p.targetPlatforms?.join(', ') || '❌ NOT SET'}`);
      console.log(`   Created: ${new Date(p.createdAt).toLocaleString()}`);
      console.log(`   Scheduled: ${p.scheduledFor ? new Date(p.scheduledFor).toLocaleString() : 'not set'}`);
      if (p.platformResults) {
        console.log(`   Platform Results:`);
        p.platformResults.forEach(r => {
          console.log(`     - ${r.platform}: ${r.status} ${r.error ? `(${r.error})` : ''}`);
        });
      }
      console.log('');
    });
  }
  
  // 3. Check Today's Day
  console.log('\n3️⃣  SCHEDULE CHECK');
  console.log('-'.repeat(60));
  
  const today = new Date();
  const dayOfWeek = today.getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  console.log(`Today: ${dayNames[dayOfWeek]} (${dayOfWeek})`);
  console.log(`Preferred Days: ${page.schedule?.preferredDays?.map(d => dayNames[d]).join(', ')}`);
  console.log(`Today is preferred: ${page.schedule?.preferredDays?.includes(dayOfWeek) ? 'YES ✅' : 'NO ❌'}`);
  
  // 4. Check posts this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const postsThisWeek = await db.collection('posts').countDocuments({
    pageId: page._id,
    createdAt: { $gte: weekStart },
    status: { $in: ['pending_approval', 'scheduled', 'published'] },
  });
  
  console.log(`\nPosts this week: ${postsThisWeek}`);
  console.log(`Target frequency: ${page.contentStrategy?.postingFrequency || 0} posts/week`);
  console.log(`Can generate more: ${postsThisWeek < (page.contentStrategy?.postingFrequency || 0) ? 'YES ✅' : 'NO ❌'}`);
  
  // 5. Test Cron Trigger
  console.log('\n\n4️⃣  ACTION ITEMS');
  console.log('-'.repeat(60));
  
  console.log('\n✅ To manually trigger auto-generate:');
  console.log(`   curl "http://localhost:3000/api/cron/auto-generate?key=${process.env.CRON_SECRET || 'YOUR_CRON_SECRET'}"`);
  
  console.log('\n✅ To check cron logs (Docker):');
  console.log('   docker-compose logs scheduler');
  
  console.log('\n✅ To test with a simpler script:');
  console.log('   node scripts/test-auto-generate.mjs');
  
  console.log('\n' + '='.repeat(60));
  
  await mongoose.disconnect();
}

diagnose().catch(console.error);

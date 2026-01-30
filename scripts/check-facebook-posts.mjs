#!/usr/bin/env node
import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

async function checkFacebookPosts() {
  await mongoose.connect(MONGODB_URI);
  
  const posts = await mongoose.connection.db.collection('posts')
    .find({ targetPlatforms: 'facebook' })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  
  console.log('📊 Recent Facebook Posts:\n');
  console.log('='.repeat(60));
  
  if (posts.length === 0) {
    console.log('\n❌ NO FACEBOOK POSTS FOUND\n');
  } else {
    console.log(`\nFound ${posts.length} Facebook posts\n`);
    
    const published = posts.filter(p => p.status === 'published').length;
    const rejected = posts.filter(p => p.status === 'rejected').length;
    const scheduled = posts.filter(p => p.status === 'scheduled').length;
    const pending = posts.filter(p => p.status === 'pending_approval').length;
    
    console.log(`Summary:`);
    console.log(`  Published: ${published}`);
    console.log(`  Scheduled: ${scheduled}`);
    console.log(`  Pending: ${pending}`);
    console.log(`  Rejected: ${rejected}\n`);
    
    posts.forEach((p, i) => {
      console.log(`${i + 1}. ${p.content?.substring(0, 60)}...`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Created: ${new Date(p.createdAt).toLocaleString()}`);
      if (p.status === 'rejected' && p.aiReview) {
        console.log(`   AI Score: ${p.aiReview.overallScore}/100`);
        console.log(`   Reason: ${p.aiReview.reasoning?.substring(0, 100)}...`);
      }
      if (p.platformResults?.length) {
        p.platformResults.forEach(r => {
          console.log(`   Result: ${r.platform} - ${r.status}`);
        });
      }
      console.log('');
    });
  }
  
  await mongoose.disconnect();
}

checkFacebookPosts().catch(console.error);

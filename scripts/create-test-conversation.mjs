#!/usr/bin/env node
/**
 * Create a test conversation to verify the monitoring system works
 */

import mongoose from 'mongoose';

// Manually set env before any imports
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://admin:strongpassword@192.168.1.9:27017/social_media_automation?authSource=admin";

import ICPEngagement from '../lib/models/ICPEngagement.ts';
import Page from '../lib/models/Page.ts';

async function createTestConversation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find a page with Twitter connection
    const page = await Page.findOne({ 'connections.platform': 'twitter' });
    
    if (!page) {
      console.log('❌ No page with Twitter connection found');
      console.log('   Create a Twitter connection first at /dashboard/connect');
      process.exit(1);
    }

    console.log(`Found page: ${page.name || page._id}`);

    // Create a test engagement with conversation enabled
    const testEngagement = await ICPEngagement.create({
      pageId: page._id,
      platform: 'twitter',
      targetPost: {
        id: 'test_post_123',
        content: 'This is a test post about AI and automation',
        url: 'https://twitter.com/test/status/123',
        createdAt: new Date(),
      },
      targetUser: {
        id: 'test_user_456',
        username: 'test_user',
        name: 'Test User',
        followersCount: 1000,
      },
      ourComment: {
        id: 'reply_789',
        content: 'Great insights! We use similar approaches in our automation workflows.',
        timestamp: new Date(),
        url: 'https://twitter.com/us/status/789',
      },
      icpProfile: {
        profileId: new mongoose.Types.ObjectId(),
        matchScore: 0.85,
      },
      relevanceScore: 0.9,
      conversation: {
        threadId: 'test_post_123', // Same as original post ID
        autoResponseEnabled: true,
        maxAutoResponses: 3,
        currentAutoResponseCount: 0,
        messages: [
          {
            id: 'reply_789',
            authorId: 'us_id',
            content: 'Great insights! We use similar approaches in our automation workflows.',
            timestamp: new Date(),
            isFromUs: true,
            url: 'https://twitter.com/us/status/789',
          }
        ],
        lastCheckedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      followUp: {
        theyReplied: false,
        conversationLength: 1,
      },
    });

    console.log(`\n✅ Created test engagement: ${testEngagement._id}`);
    console.log(`   Platform: ${testEngagement.platform}`);
    console.log(`   Auto-response enabled: ${testEngagement.conversation.autoResponseEnabled}`);
    console.log(`   Thread ID: ${testEngagement.conversation.threadId}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Test the conversation monitor:');
    console.log('      curl -G -fsS \\');
    console.log('        --data-urlencode "key=YOUR_CRON_SECRET" \\');
    console.log('        "http://localhost:3000/api/cron/conversation-monitor?dryRun=true&maxConversations=10"');
    console.log('\n   2. View in dashboard:');
    console.log('      http://localhost:3000/dashboard/conversations');
    console.log('\n   3. Cleanup test data:');
    console.log(`      curl -X DELETE http://localhost:3000/api/conversations/${testEngagement._id}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createTestConversation();

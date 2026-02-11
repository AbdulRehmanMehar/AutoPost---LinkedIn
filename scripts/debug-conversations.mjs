#!/usr/bin/env node
/**
 * Debug: Find conversations in database
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env FIRST before any imports
const envPath = join(__dirname, '../.env');
dotenv.config({ path: envPath });

// THEN import modules that need env
import ICPEngagement from '../lib/models/ICPEngagement.ts';
import connectToDatabase from '../lib/mongodb.ts';

async function debugConversations() {
  try {
    await connectToDatabase();
    console.log('✅ Connected to MongoDB\n');

    // Find ALL ICP engagements
    console.log('📊 All ICP Engagements:');
    const allEngagements = await ICPEngagement.find({})
      .select('platform targetUser.username ourComment.content followUp.theyReplied conversation')
      .limit(20)
      .lean();
    
    console.log(`Total: ${allEngagements.length}\n`);
    
    allEngagements.forEach((eng, i) => {
      console.log(`${i + 1}. Platform: ${eng.platform}`);
      console.log(`   User: ${eng.targetUser?.username}`);
      console.log(`   They replied: ${eng.followUp?.theyReplied}`);
      console.log(`   Conversation enabled: ${eng.conversation?.autoResponseEnabled}`);
      console.log(`   Thread ID: ${eng.conversation?.threadId || 'none'}`);
      console.log(`   Messages: ${eng.conversation?.messages?.length || 0}`);
      console.log(`   Response count: ${eng.conversation?.currentAutoResponseCount || 0}`);
      console.log('');
    });

    // Check what the query would match
    console.log('\n🔍 Testing conversation monitor query:');
    const query = {
      platform: 'twitter',
      'conversation.autoResponseEnabled': true,
      $or: [
        { 'conversation.currentAutoResponseCount': { $lt: 3 } },
        { 'conversation.currentAutoResponseCount': { $exists: false } },
      ],
    };
    
    console.log('Query:', JSON.stringify(query, null, 2));
    
    const matches = await ICPEngagement.find(query)
      .select('targetUser.username conversation followUp')
      .lean();
    
    console.log(`\nMatches: ${matches.length}`);
    matches.forEach((m, i) => {
      console.log(`${i + 1}. ${m.targetUser?.username} - autoResponse: ${m.conversation?.autoResponseEnabled}, count: ${m.conversation?.currentAutoResponseCount || 0}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

debugConversations();

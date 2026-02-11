/**
 * Test Script: Conversation System
 * 
 * Tests the bidirectional conversation system for Twitter ICP engagement
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

import { monitorAndRespondToConversations, getConversationStats } from '../lib/engagement/conversation-manager.ts';
import connectToDatabase from '../lib/mongodb.ts';

async function testConversationSystem() {
  try {
    console.log('🚀 Testing Conversation System...');
    
    await connectToDatabase();
    console.log('✅ Connected to MongoDB');

    // Test 1: Get conversation statistics
    console.log('\n📊 Getting conversation statistics...');
    const stats = await getConversationStats();
    console.log('Stats:', JSON.stringify(stats, null, 2));

    // Test 2: Monitor conversations (dry run)
    console.log('\n🔍 Testing conversation monitoring (dry run)...');
    const monitorResult = await monitorAndRespondToConversations(undefined, {
      maxConversationsToCheck: 5,
      maxResponsesToSend: 2,
      minTimeBetweenChecks: 1, // 1 minute for testing
      dryRun: true, // Don't actually send responses
    });

    console.log('Monitor Result:', JSON.stringify(monitorResult, null, 2));

    console.log('\n✅ Conversation system test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

testConversationSystem();
/**
 * Test ICP Engagement Agent - Dry Run
 * 
 * This script tests the full flow:
 * 1. ICP Analysis
 * 2. Twitter Search
 * 3. Tweet Evaluation
 * 4. Reply Generation
 * 
 * Without actually posting anything.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Import after dotenv so env vars are loaded
const { runICPEngagementAgent } = await import('../lib/engagement/icp-engagement-agent.js');

const PAGE_ID = '697a8625f047b183f44c15f7'; // PrimeStrides

// Override search queries with broader terms for testing
const TEST_QUERIES = [
  'startup hiring engineers',
  'building a tech team',
  'software development challenges',
  'scaling my startup',
  'CTO problems',
];

async function main() {
  console.log('🚀 Starting ICP Engagement Agent - DRY RUN\n');
  console.log('=' .repeat(60));
  
  try {
    // Connect to MongoDB
    console.log('\n📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected\n');

    // Run the agent in dry run mode
    console.log('🔍 Running ICP Engagement Agent...\n');
    console.log('Using broader test queries:', TEST_QUERIES.join(', '), '\n');
    
    const result = await runICPEngagementAgent(PAGE_ID, {
      dryRun: true,                    // Don't actually post
      maxQueriesToRun: 5,              // Run all test queries
      maxRepliesToSend: 3,             // Generate up to 3 replies
      minRelevanceScore: 4,            // Lower threshold for testing
      maxTweetsPerQuery: 15,           // Get more tweets per query
      minFollowers: 50,                // Lower follower threshold
      maxFollowers: 500000,            // Higher max
      testQueries: TEST_QUERIES,       // Use our test queries
    });

    // Display results
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS\n');
    
    console.log(`Success: ${result.success ? '✓' : '✗'}`);
    console.log(`Queries Executed: ${result.queriesExecuted}`);
    console.log(`Tweets Found: ${result.tweetsFound}`);
    console.log(`Tweets Evaluated: ${result.tweetsEvaluated}`);
    console.log(`Replies Generated: ${result.repliesSent}`);
    console.log(`Duration: ${(result.completedAt.getTime() - result.startedAt.getTime()) / 1000}s`);

    if (result.icpProfile) {
      console.log('\n📎 ICP PROFILE:');
      console.log(`  Target Audience: ${result.icpProfile.targetAudience.roles.slice(0, 3).join(', ')}`);
      console.log(`  Pain Points: ${result.icpProfile.painPoints.slice(0, 3).map(p => p.problem).join('; ')}`);
    }

    if (result.engagements.length > 0) {
      console.log('\n💬 GENERATED REPLIES (not posted):\n');
      result.engagements.forEach((eng, i) => {
        console.log(`--- Reply ${i + 1} ---`);
        console.log(`To: @${eng.tweet.author?.username} (${eng.tweet.author?.followersCount} followers)`);
        console.log(`Tweet: "${eng.tweet.text.slice(0, 150)}${eng.tweet.text.length > 150 ? '...' : ''}"`);
        console.log(`\nOur Reply: "${eng.reply}"`);
        console.log(`\nTweet URL: https://twitter.com/${eng.tweet.author?.username}/status/${eng.tweet.id}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️ No replies were generated.');
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(e => console.log(`  - ${e}`));
      }
    }

    if (result.errors.length > 0 && result.engagements.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      result.errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

main();

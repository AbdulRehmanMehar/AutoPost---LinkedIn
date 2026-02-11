import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Directly import the learning functions
async function testLearning() {
  console.log('Testing learning context...\n');
  
  await mongoose.connect(process.env.MONGODB_URI);
  
  const pageId = '697a8625f047b183f44c15f7';
  const platforms = ['facebook', 'twitter'];
  
  // Import dynamically
  const { getPlatformInsights } = await import('../lib/learning/platform-learning.js');
  const { getPlatformLearningContext } = await import('../lib/learning/ai-content-learning.js');
  
  for (const platform of platforms) {
    console.log(`\n=== Testing ${platform} ===`);
    
    try {
      console.log('1. Getting platform insights...');
      const insights = await getPlatformInsights(pageId, platform);
      console.log('   Sample size:', insights.sampleSize);
      console.log('   Top angles:', insights.topPerformingAngles);
      console.log('   Optimal slots:', insights.optimalSlots?.length || 0);
      
      console.log('2. Getting learning context...');
      const context = await getPlatformLearningContext(pageId, platform);
      console.log('   Has enough data:', context.hasEnoughData);
      console.log('   Top angles:', context.topAngles);
      console.log('   ✅ Success');
    } catch (err) {
      console.log('   ❌ Error:', err.message);
      console.log('   Stack:', err.stack);
    }
  }
  
  await mongoose.disconnect();
}

testLearning().catch(console.error);

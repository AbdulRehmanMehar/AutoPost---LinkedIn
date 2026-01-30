/**
 * Test script for the Stats Reviewer service
 * 
 * Tests the metric interpretation logic with sample data
 */

import { 
  analyzePostMetrics, 
  generateLearningPrompt, 
  comparePosts,
  getPlatformMetricGuide 
} from '../lib/learning/stats-reviewer';

console.log('='.repeat(80));
console.log('STATS REVIEWER TEST');
console.log('='.repeat(80));

// Test 1: Analyze a high-performing LinkedIn post
console.log('\n📊 TEST 1: High-Performing LinkedIn Post\n');

const highPerformingLinkedIn = analyzePostMetrics('linkedin', {
  impressions: 15000,
  likes: 450,
  comments: 85,
  shares: 45,
  clicks: 120,
  engagementRate: 4.67,
});

console.log('Overall Performance:', highPerformingLinkedIn.overallPerformance);
console.log('Performance Score:', highPerformingLinkedIn.performanceScore, '/100');
console.log('\nDetected Patterns:');
highPerformingLinkedIn.patterns.forEach(p => {
  console.log(`  ✓ ${p.pattern}: ${p.significance}`);
});
console.log('\nKey Insights:');
highPerformingLinkedIn.keyInsights.forEach(i => {
  console.log(`  • ${i}`);
});

// Test 2: Analyze a poor-performing post
console.log('\n' + '='.repeat(80));
console.log('📊 TEST 2: Poor-Performing Facebook Post\n');

const poorPerforming = analyzePostMetrics('facebook', {
  impressions: 5000,
  likes: 15,
  comments: 0,
  shares: 0,
  clicks: 2,
  engagementRate: 0.03,
});

console.log('Overall Performance:', poorPerforming.overallPerformance);
console.log('Performance Score:', poorPerforming.performanceScore, '/100');
console.log('\nWeaknesses Detected:');
poorPerforming.contentCharacteristics.weaknesses.forEach(w => {
  console.log(`  ⚠️ ${w}`);
});
console.log('\nRecommendations:');
poorPerforming.recommendations.forEach(r => {
  console.log(`  → ${r}`);
});

// Test 3: Generate AI Learning Prompt
console.log('\n' + '='.repeat(80));
console.log('📊 TEST 3: AI Learning Prompt Generation\n');

const learningPrompt = generateLearningPrompt(highPerformingLinkedIn);
console.log(learningPrompt);

// Test 4: Instagram post with saves
console.log('\n' + '='.repeat(80));
console.log('📊 TEST 4: Instagram Post with High Saves\n');

const instagramPost = analyzePostMetrics('instagram', {
  impressions: 8000,
  likes: 600,
  comments: 45,
  shares: 80,
  saves: 120,
  engagementRate: 10.56,
});

console.log('Overall Performance:', instagramPost.overallPerformance);
console.log('Performance Score:', instagramPost.performanceScore, '/100');
console.log('\nSave Analysis:');
const saveInterp = instagramPost.interpretations.find(i => i.metric === 'saves');
if (saveInterp) {
  console.log(`  Status: ${saveInterp.status}`);
  console.log(`  Meaning: ${saveInterp.meaning}`);
}

// Test 5: Compare multiple posts
console.log('\n' + '='.repeat(80));
console.log('📊 TEST 5: Compare Multiple Twitter Posts\n');

const comparison = comparePosts('twitter', [
  {
    content: 'This is my best post about AI tools',
    metrics: { impressions: 20000, likes: 800, comments: 150, shares: 200, engagementRate: 5.75 }
  },
  {
    content: 'Average post about productivity',
    metrics: { impressions: 5000, likes: 100, comments: 10, shares: 5, engagementRate: 2.3 }
  },
  {
    content: 'Poor post that flopped',
    metrics: { impressions: 1000, likes: 20, comments: 0, shares: 0, engagementRate: 2.0 }
  }
]);

console.log('Best Performer Score:', comparison.bestPerformer.analysis.performanceScore);
console.log('Worst Performer Score:', comparison.worstPerformer.analysis.performanceScore);
console.log('\nCommon Success Factors:');
comparison.commonSuccessFactors.forEach(f => {
  console.log(`  ✓ ${f}`);
});
console.log('\nCommon Failure Factors:');
comparison.commonFailureFactors.forEach(f => {
  console.log(`  ⚠️ ${f}`);
});

// Test 6: Platform Guide
console.log('\n' + '='.repeat(80));
console.log('📊 TEST 6: Platform-Specific Metric Guide\n');

console.log('--- LinkedIn Guide (first 500 chars) ---');
const guide = getPlatformMetricGuide('linkedin');
console.log(guide.substring(0, 500) + '...');

console.log('\n' + '='.repeat(80));
console.log('✅ ALL TESTS COMPLETED');
console.log('='.repeat(80));

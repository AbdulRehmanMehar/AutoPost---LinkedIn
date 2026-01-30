// Test Twitter Token Refresh and API Access
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Page = mongoose.model('Page', new mongoose.Schema({}, { strict: false }));
  const page = await Page.findById('697a8625f047b183f44c15f7');
  
  const twitter = page.connections.find(c => c.platform === 'twitter');
  if (!twitter) {
    console.log('No Twitter connection');
    process.exit(1);
  }
  
  console.log('Current token expires:', twitter.tokenExpiresAt);
  console.log('Current time:', new Date());
  console.log('Token expired:', new Date() > new Date(twitter.tokenExpiresAt));
  
  // Try to refresh the token
  console.log('\n🔄 Attempting to refresh token...');
  
  try {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: twitter.refreshToken,
      }).toString(),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log('❌ Refresh failed:', data);
    } else {
      console.log('✓ Token refreshed!');
      console.log('  New expiry:', new Date(Date.now() + data.expires_in * 1000));
      
      // Update the connection in DB
      twitter.accessToken = data.access_token;
      twitter.refreshToken = data.refresh_token;
      twitter.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
      await page.save();
      console.log('✓ Saved to database');
      
      // Now test the API
      console.log('\n🔍 Testing Twitter API...');
      
      // Test 1: User lookup (Basic tier)
      const meResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: { 'Authorization': `Bearer ${data.access_token}` },
      });
      console.log('  /users/me:', meResponse.ok ? '✓' : `✗ (${meResponse.status})`);
      
      // Test 2: Search (requires Pro tier)
      const searchResponse = await fetch(
        'https://api.twitter.com/2/tweets/search/recent?query=test&max_results=10',
        { headers: { 'Authorization': `Bearer ${data.access_token}` } }
      );
      const searchStatus = searchResponse.status;
      const searchBody = await searchResponse.json();
      console.log('  /tweets/search/recent:', 
        searchResponse.ok ? '✓' : `✗ (${searchStatus}: ${searchBody.detail || searchBody.title || 'unknown'})`
      );
      
      if (searchStatus === 403) {
        console.log('\n⚠️  The Twitter search endpoint requires Basic or Pro API tier ($100-5000/month)');
        console.log('   Your current tier does not have access to tweet search.');
        console.log('\n   Alternative approaches:');
        console.log('   1. Upgrade to Twitter API Basic tier ($100/month)');
        console.log('   2. Use user timeline search instead (get tweets from specific users)');
        console.log('   3. Monitor hashtags/keywords manually and input them');
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
  
  await mongoose.disconnect();
}

run();

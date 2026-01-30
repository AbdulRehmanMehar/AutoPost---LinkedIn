import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function productionCheck() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    PRODUCTION READINESS CHECK                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const issues = [];
  const warnings = [];

  // 1. Environment Variables
  console.log('1️⃣  ENVIRONMENT VARIABLES');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  const requiredEnvVars = [
    'MONGODB_URI',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GROQ_API_KEY',
    'CRON_SECRET',
  ];
  
  const optionalEnvVars = [
    { key: 'RESEND_API_KEY', purpose: 'Email notifications' },
    { key: 'LINKEDIN_CLIENT_ID', purpose: 'LinkedIn publishing' },
    { key: 'LINKEDIN_CLIENT_SECRET', purpose: 'LinkedIn publishing' },
    { key: 'TWITTER_CLIENT_ID', purpose: 'Twitter publishing' },
    { key: 'TWITTER_CLIENT_SECRET', purpose: 'Twitter publishing' },
    { key: 'TWITTER_API_KEY', purpose: 'Twitter OAuth 1.0a' },
    { key: 'TWITTER_API_SECRET', purpose: 'Twitter OAuth 1.0a' },
    { key: 'FACEBOOK_APP_ID', purpose: 'Facebook publishing' },
    { key: 'FACEBOOK_APP_SECRET', purpose: 'Facebook publishing' },
  ];

  for (const key of requiredEnvVars) {
    if (process.env[key]) {
      console.log(`   ✅ ${key}`);
    } else {
      console.log(`   ❌ ${key} - MISSING (Required)`);
      issues.push(`Missing required env var: ${key}`);
    }
  }
  
  console.log('');
  console.log('   Optional (for platform publishing):');
  for (const { key, purpose } of optionalEnvVars) {
    if (process.env[key]) {
      console.log(`   ✅ ${key} (${purpose})`);
    } else {
      console.log(`   ⚠️  ${key} - not set (${purpose})`);
      warnings.push(`Optional: ${key} not set - ${purpose} won't work`);
    }
  }
  console.log('');

  // 2. Database Connection
  console.log('2️⃣  DATABASE CONNECTION');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ MongoDB connected');
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log(`   ✅ Collections: ${collectionNames.join(', ')}`);
    
    // Check indexes
    if (collectionNames.includes('posts')) {
      const indexes = await mongoose.connection.db.collection('posts').indexes();
      console.log(`   ✅ Posts indexes: ${indexes.length}`);
    }
    
    // Check distributed_locks collection for TTL index
    if (collectionNames.includes('distributed_locks')) {
      console.log('   ✅ distributed_locks collection exists');
    } else {
      console.log('   ⚠️  distributed_locks collection will be created on first use');
    }
  } catch (err) {
    console.log(`   ❌ MongoDB connection failed: ${err.message}`);
    issues.push('MongoDB connection failed');
  }
  console.log('');

  // 3. Pages & Data Sources
  console.log('3️⃣  PAGES & DATA SOURCES');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  try {
    const pages = await mongoose.connection.db.collection('pages').find({}).toArray();
    console.log(`   📄 Total pages: ${pages.length}`);
    
    for (const page of pages) {
      console.log(`   ├─ ${page.name}`);
      console.log(`   │  ├─ isActive: ${page.isActive ? '✅' : '❌'}`);
      console.log(`   │  ├─ pageType: ${page.pageType || 'personal (default)'}`);
      console.log(`   │  ├─ autoGenerate: ${page.schedule?.autoGenerate ? '✅' : '❌'}`);
      console.log(`   │  ├─ autoApprove: ${page.schedule?.autoApprove ? '✅' : '❌'}`);
      
      const dataSources = page.dataSources?.databases || [];
      const activeDs = dataSources.filter(d => d.isActive);
      console.log(`   │  └─ Data sources: ${activeDs.length} active / ${dataSources.length} total`);
      
      // Check platform connections
      const connections = page.connections || [];
      const activeConns = connections.filter(c => c.isActive);
      if (activeConns.length > 0) {
        console.log(`   │     Platforms: ${activeConns.map(c => c.platform).join(', ')}`);
      } else {
        console.log(`   │     ⚠️  No active platform connections`);
        warnings.push(`Page "${page.name}" has no platform connections`);
      }
    }
    
    const autoGenPages = pages.filter(p => p.isActive && p.schedule?.autoGenerate);
    if (autoGenPages.length === 0) {
      warnings.push('No pages with auto-generate enabled');
    }
  } catch (err) {
    console.log(`   ❌ Error checking pages: ${err.message}`);
  }
  console.log('');

  // 4. Cron Schedule
  console.log('4️⃣  CRON SCHEDULE (from scheduler/entrypoint.sh)');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('   📅 Auto-Generate: 0 6 * * * (Daily at 6:00 AM UTC)');
  console.log('   📤 Publish:       */5 * * * * (Every 5 minutes)');
  console.log('   💬 Engage:        */15 * * * * (Every 15 minutes)');
  console.log('   📊 Metrics:       0 */6 * * * (Every 6 hours)');
  console.log('');

  // 5. AI Configuration
  console.log('5️⃣  AI CONFIGURATION');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log(`   🤖 Model: llama-3.3-70b-versatile (Groq)`);
  console.log(`   ✅ GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'Set' : 'Not set'}`);
  console.log('');

  // 6. Security
  console.log('6️⃣  SECURITY');
  console.log('─────────────────────────────────────────────────────────────────────');
  
  if (process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32) {
    console.log('   ✅ CRON_SECRET is set and secure');
  } else if (process.env.CRON_SECRET) {
    console.log('   ⚠️  CRON_SECRET is set but short (recommend 32+ chars)');
    warnings.push('CRON_SECRET should be at least 32 characters');
  } else {
    console.log('   ❌ CRON_SECRET is not set');
    issues.push('CRON_SECRET not set - cron jobs unprotected');
  }
  
  if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32) {
    console.log('   ✅ NEXTAUTH_SECRET is set and secure');
  } else {
    console.log('   ❌ NEXTAUTH_SECRET issue');
    issues.push('NEXTAUTH_SECRET should be at least 32 characters');
  }
  
  if (process.env.NEXTAUTH_URL?.startsWith('https://')) {
    console.log('   ✅ NEXTAUTH_URL uses HTTPS');
  } else {
    console.log('   ⚠️  NEXTAUTH_URL should use HTTPS in production');
    warnings.push('NEXTAUTH_URL should use HTTPS');
  }
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ PRODUCTION READY!');
  } else {
    if (issues.length > 0) {
      console.log(`\n❌ CRITICAL ISSUES (${issues.length}):`);
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    }
    if (warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
      warnings.forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
    }
    
    if (issues.length === 0) {
      console.log('\n✅ PRODUCTION READY (with warnings)');
    } else {
      console.log('\n❌ NOT PRODUCTION READY - Fix critical issues first');
    }
  }
  
  await mongoose.disconnect();
}

productionCheck().catch(console.error);

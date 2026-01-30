import mongoose from 'mongoose';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const PAGE_ID = '697a8625f047b183f44c15f7';

async function debug() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║            GENERATION FLOW DEBUG                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Step 1: Connect to MongoDB
  console.log('Step 1: Connecting to MongoDB...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ MongoDB connected\n');
  } catch (err) {
    console.log('   ❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // Step 2: Find the page
  console.log('Step 2: Loading page...');
  const page = await mongoose.connection.db.collection('pages').findOne({ 
    _id: new mongoose.Types.ObjectId(PAGE_ID) 
  });
  
  if (!page) {
    console.log('   ❌ Page not found');
    process.exit(1);
  }
  console.log('   ✅ Page found:', page.name);
  console.log('   ├─ isActive:', page.isActive);
  console.log('   ├─ autoGenerate:', page.schedule?.autoGenerate);
  console.log('   └─ pageType:', page.pageType || 'not set (defaults to personal)');
  console.log('');

  // Step 3: Check schedule conditions
  console.log('Step 3: Checking schedule conditions...');
  const today = new Date();
  const currentDay = today.getDay();
  const preferredDays = page.schedule?.preferredDays || [1, 2, 3, 4, 5];
  
  console.log('   ├─ Today is day:', currentDay, '(' + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][currentDay] + ')');
  console.log('   ├─ Preferred days:', preferredDays.join(', '));
  console.log('   └─ Is today a preferred day?', preferredDays.includes(currentDay) ? '✅ Yes' : '❌ No');
  console.log('');

  // Step 4: Check posting frequency
  console.log('Step 4: Checking posting frequency...');
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const postsThisWeek = await mongoose.connection.db.collection('posts').countDocuments({
    pageId: page._id,
    createdAt: { $gte: weekStart },
    status: { $in: ['pending_approval', 'scheduled', 'published'] },
  });
  
  const targetFrequency = page.contentStrategy?.postingFrequency || 3;
  console.log('   ├─ Posts this week:', postsThisWeek);
  console.log('   ├─ Target frequency:', targetFrequency, 'per week');
  console.log('   └─ Can generate more?', postsThisWeek < targetFrequency ? '✅ Yes' : '❌ Already at limit');
  console.log('');

  // Step 5: Check for existing post today
  console.log('Step 5: Checking for existing post today...');
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  
  const existingTodayPost = await mongoose.connection.db.collection('posts').findOne({
    pageId: page._id,
    createdAt: { $gte: todayStart, $lte: todayEnd },
    status: { $in: ['pending_approval', 'scheduled'] },
  });
  
  if (existingTodayPost) {
    console.log('   ❌ Already have a post today:', existingTodayPost._id.toString());
    console.log('   └─ Status:', existingTodayPost.status);
  } else {
    console.log('   ✅ No existing post today');
  }
  console.log('');

  // Step 6: Check data sources
  console.log('Step 6: Checking data sources...');
  const dataSources = page.dataSources?.databases || [];
  const activeSource = dataSources.find(ds => ds.isActive);
  
  if (!activeSource) {
    console.log('   ❌ No active data source found');
    console.log('   └─ Total data sources:', dataSources.length);
  } else {
    console.log('   ✅ Active data source found:', activeSource.name);
    console.log('   ├─ Type:', activeSource.type);
    console.log('   ├─ Query:', activeSource.query?.slice(0, 80) + '...');
    console.log('   └─ Field mapping:');
    console.log('      ├─ titleField:', activeSource.fieldMapping?.titleField || 'auto-detect');
    console.log('      └─ bodyField:', activeSource.fieldMapping?.bodyField || 'auto-detect');
  }
  console.log('');

  // Step 7: Test data source connection and fetch
  if (activeSource) {
    console.log('Step 7: Testing data source connection...');
    try {
      const url = new URL(activeSource.connectionString);
      const connection = await mysql.createConnection({
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: true },
      });
      
      console.log('   ✅ Database connected');
      
      // Execute the query
      const [rows] = await connection.query(activeSource.query);
      console.log('   ├─ Query returned:', Array.isArray(rows) ? rows.length : 0, 'rows');
      
      if (Array.isArray(rows) && rows.length > 0) {
        const firstRow = rows[0];
        console.log('   └─ First row fields:', Object.keys(firstRow).join(', '));
        
        // Show sample content
        const titleField = activeSource.fieldMapping?.titleField || Object.keys(firstRow).find(k => k.toLowerCase().includes('title'));
        const bodyField = activeSource.fieldMapping?.bodyField || Object.keys(firstRow).find(k => k.toLowerCase().includes('content') || k.toLowerCase().includes('body'));
        
        if (titleField && firstRow[titleField]) {
          console.log('   📄 Sample title:', String(firstRow[titleField]).slice(0, 80));
        }
        if (bodyField && firstRow[bodyField]) {
          let bodyContent = firstRow[bodyField];
          if (typeof bodyContent === 'object') {
            bodyContent = JSON.stringify(bodyContent).slice(0, 100);
          }
          console.log('   📝 Sample body:', String(bodyContent).slice(0, 100) + '...');
        }
      }
      
      await connection.end();
    } catch (err) {
      console.log('   ❌ Database connection failed:', err.message);
    }
  }
  console.log('');

  // Step 8: Test AI generation
  console.log('Step 8: Testing AI generation...');
  if (!process.env.GROQ_API_KEY) {
    console.log('   ❌ GROQ_API_KEY not set');
  } else {
    console.log('   ✅ GROQ_API_KEY is set');
    
    try {
      const openai = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      
      // Test with a simple generation
      const pageType = page.pageType || 'personal';
      const voice = pageType === 'organization' ? 'we/our' : 'I/my';
      
      console.log('   ├─ Testing generation with pageType:', pageType);
      console.log('   └─ Voice will use:', voice);
      
      const testPrompt = `Generate a short 2-sentence LinkedIn post test about technology. Use "${voice}" voice.`;
      
      const response = await openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: testPrompt },
        ],
        max_tokens: 100,
      });
      
      const generated = response.choices[0]?.message?.content;
      if (generated) {
        console.log('   ✅ AI generation working');
        console.log('   └─ Test output:', generated.slice(0, 150) + '...');
      }
    } catch (err) {
      console.log('   ❌ AI generation failed:', err.message);
    }
  }
  console.log('');

  // Step 9: Check content strategy
  console.log('Step 9: Checking content strategy...');
  const strategy = page.contentStrategy;
  if (!strategy) {
    console.log('   ❌ No content strategy configured');
  } else {
    console.log('   ✅ Content strategy found');
    console.log('   ├─ Persona:', strategy.persona ? strategy.persona.slice(0, 60) + '...' : 'Not set');
    console.log('   ├─ Topics:', strategy.topics?.length || 0, 'topics');
    console.log('   ├─ Tone:', strategy.tone?.slice(0, 60) || 'Not set');
    console.log('   ├─ Target audience:', strategy.targetAudience?.slice(0, 60) || 'Not set');
    console.log('   └─ Preferred angles:', strategy.preferredAngles?.join(', ') || 'Not set');
  }
  console.log('');

  // Summary
  console.log('════════════════════════════════════════════════════════════════');
  console.log('SUMMARY - Will generation run?');
  console.log('════════════════════════════════════════════════════════════════');
  
  const issues = [];
  if (!page.isActive) issues.push('Page is not active');
  if (!page.schedule?.autoGenerate) issues.push('autoGenerate is disabled');
  if (!preferredDays.includes(currentDay)) issues.push('Today is not a preferred posting day');
  if (postsThisWeek >= targetFrequency) issues.push('Already reached posting frequency limit');
  if (existingTodayPost) issues.push('Already have a post scheduled/pending today');
  if (!activeSource) issues.push('No active data source');
  if (!strategy?.persona) issues.push('No content strategy persona');
  
  if (issues.length === 0) {
    console.log('✅ All conditions met - generation SHOULD run');
  } else {
    console.log('❌ Generation will be SKIPPED because:');
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }
  console.log('');

  await mongoose.disconnect();
}

debug().catch(console.error);

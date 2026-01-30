import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const PAGE_ID = '697a8625f047b183f44c15f7';

async function testGeneration() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('          TESTING CONTENT GENERATION WITH CORRECT VOICE            ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  await mongoose.connect(process.env.MONGODB_URI);
  
  // Get page
  const page = await mongoose.connection.db.collection('pages').findOne({ 
    _id: new mongoose.Types.ObjectId(PAGE_ID) 
  });
  
  console.log('Page:', page.name);
  console.log('Page Type:', page.pageType);
  console.log('');

  // Test AI generation with organization voice
  const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const isOrganization = page.pageType === 'organization';
  const voiceInstruction = isOrganization 
    ? 'Write as an ORGANIZATION/COMPANY using "we", "our team", "our company". Never use "I".'
    : 'Write as an INDIVIDUAL using "I", "my". Never use "we" or "our team".';

  const strategy = page.contentStrategy;
  
  const prompt = `Generate a LinkedIn post based on the following content strategy:

## Voice:
${voiceInstruction}

## Your Voice & Persona:
${strategy.persona}

## Target Audience:
${strategy.targetAudience}

## Tone:
${strategy.tone}

## Topic for this post:
Technical leadership and building effective engineering teams

## Post Angle:
insight: Share a useful observation or tip that your audience might not have considered.

## Requirements:
- Keep under 1200 characters (aim for 900-1100)
- Write authentically in the persona described above
- ${isOrganization ? 'ALWAYS use "we/our" voice, NEVER "I/my"' : 'ALWAYS use "I/my" voice, NEVER "we/our"'}
- Match the tone exactly
- End with a specific question that invites discussion
- Include 3-5 relevant hashtags at the end
- Use 0-1 emoji (less is more for credibility)
- NEVER use em dashes (—). Use commas or periods instead`;

  console.log('Generating with voice instruction:');
  console.log('  ', voiceInstruction.slice(0, 80) + '...');
  console.log('');

  try {
    const response = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { 
          role: 'system', 
          content: `You are an expert LinkedIn content creator. ${isOrganization ? 'You write as a company/brand sharing valuable content. Always use "we", "our team", etc. Never use "I".' : 'You write as an individual professional. Always use "I", "my". Never use "we" or "our team".'}`
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('GENERATED CONTENT:');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(content);
    console.log('═══════════════════════════════════════════════════════════════════');
    
    // Check if voice is correct
    const usesI = /\bI\b|\bI\'ve\b|\bI\'m\b|\bmy\b/i.test(content);
    const usesWe = /\bWe\b|\bWe\'ve\b|\bWe\'re\b|\bour\b|\bour team\b/i.test(content);
    
    console.log('');
    console.log('Voice Check:');
    console.log('  Uses "I/my":', usesI ? '⚠️ YES' : '✅ NO');
    console.log('  Uses "we/our":', usesWe ? '✅ YES' : '⚠️ NO');
    
    if (isOrganization && usesI && !usesWe) {
      console.log('  ❌ WRONG VOICE - Should use "we/our" but using "I/my"');
    } else if (!isOrganization && usesWe && !usesI) {
      console.log('  ❌ WRONG VOICE - Should use "I/my" but using "we/our"');
    } else if (isOrganization && usesWe) {
      console.log('  ✅ CORRECT - Using organization voice (we/our)');
    } else if (!isOrganization && usesI) {
      console.log('  ✅ CORRECT - Using personal voice (I/my)');
    }

  } catch (err) {
    console.log('Generation error:', err.message);
  }

  await mongoose.disconnect();
}

testGeneration().catch(console.error);

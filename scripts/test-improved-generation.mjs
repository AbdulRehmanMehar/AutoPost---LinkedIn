import 'dotenv/config';
import mongoose from 'mongoose';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

async function testGeneration() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const page = await mongoose.connection.db.collection('pages').findOne({});
  console.log('Testing with page:', page.name);
  console.log('');
  
  const systemPrompt = `You are an expert content creator who writes posts that STOP THE SCROLL. You write as a company that has DONE THINGS and has STORIES to tell. Not a marketing team.

## THE #1 RULE: STORIES OVER STATEMENTS

BAD: "We've seen many startups prioritize quick fixes over strategic architecture."
GOOD: "We rebuilt a client's 'quick MVP' last month. Cost them 4x what the original build did."

BAD: "Technical debt is a hidden liability."
GOOD: "Their 'simple' Firebase setup turned into a $40k/month bill at 10k users."

ALWAYS lead with a specific story, number, or concrete example. NEVER lead with generic observations.

## HASHTAG FORMAT - CRITICAL:
- ALWAYS use # symbol: #engineering #startups #techdebt
- NEVER use dashes: -engineering -startups (THIS IS WRONG)
- Place at the very end of the post
- 3-5 hashtags maximum

## BE OPINIONATED
- Take a stance. "X is wrong" not "X might not be ideal"
- Wishy-washy posts get ignored. Strong opinions drive engagement.`;

  const prompt = `Generate a LinkedIn post based on the following content strategy:

## Voice:
Write as an ORGANIZATION/COMPANY using "we", "our team", "our company". Never use "I".

## Your Voice & Persona:
${page.contentStrategy.persona}

## Target Audience:
${page.contentStrategy.targetAudience}

## Tone:
${page.contentStrategy.tone}

## Topic for this post:
Why "fast" projects usually fail

## Post Angle:
war_story: Tell a SPECIFIC story: "Last month our team..." Include timeline, what happened, what went wrong or right. Real details make it compelling.

## CRITICAL REQUIREMENTS:

### FORMAT:
- Keep under 1200 characters (aim for 900-1100)
- ALWAYS use "we/our" voice, NEVER "I/my"
- HASHTAGS: Use # symbol (e.g., #startup #engineering). NEVER use dashes like -startup
- Include 3-5 hashtags at the very end, each starting with #
- Use 0 emojis. Zero. None.
- NEVER use em dashes (—). Use periods or commas.

### CONTENT RULES (CRITICAL):
- FIRST LINE must be a hook: specific story, surprising fact, or bold claim
- NEVER start with "We've seen many..." or any generic observation
- Include at least ONE specific number, timeline, or concrete example
- Take a STANCE. Be opinionated. Wishy-washy posts fail.
- End with a question that invites the reader to share THEIR story

### BANNED PHRASES (do not use these):
- "We've seen many startups..." or "Many companies..."
- "prioritize X over Y", "hidden liability", "brick wall"
- "strategic architecture", "long-term success", "future-proof"
- "In today's world", "It's no secret", "At the end of the day"
- "What are your thoughts?" (too generic)

### GOOD vs BAD EXAMPLES:
BAD HOOK: "We've seen many startups prioritize quick fixes over strategic architecture."
GOOD HOOK: "We rebuilt a client's MVP last month. Cost them 4x the original build."

BAD QUESTION: "How do you balance speed and scalability?"
GOOD QUESTION: "What's the most expensive shortcut you've taken?"`;

  const response = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  console.log('=== GENERATED POST ===');
  console.log('');
  console.log(response.choices[0].message.content);
  console.log('');
  console.log('=== CHARACTER COUNT ===');
  console.log(response.choices[0].message.content.length);
  console.log('======================');
  
  await mongoose.disconnect();
}

testGeneration().catch(console.error);

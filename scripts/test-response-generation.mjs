#!/usr/bin/env node
/**
 * Test response generation
 */

import { createChatCompletion } from '../lib/ai-client.ts';

async function testResponseGeneration() {
  const prompt = `Generate a thoughtful follow-up reply for this twitter conversation.

ORIGINAL POST THEY SHARED:
"Building a startup? Join our event to meet investors who specialize in tech funding!"

RECENT CONVERSATION:
[US]: Are custom AI solutions really the key to saving 20+ hours/week for dev-heavy startups, or does it depend on the specific workflow they're automating?
[THEM]: @AbdulRehma11980 It depends on the workflow they are automating, but freeing up time to grow their business rather then focus on low value tasks

Tone: friendly
Platform: twitter
Max length: 250 characters

Guidelines:
- Be natural and conversational, not robotic
- Add genuine value or insight
- Reference something specific from their latest message
- Keep it concise and engaging
- Sound like a real person, not a brand or bot
- Avoid generic responses like "Great point!" or "Thanks for sharing!"
- If they asked a question, answer it thoughtfully
- If they shared an insight, build on it or share a related perspective

Return ONLY the reply text, nothing else.`;

  console.log('Testing response generation...\n');
  console.log('Prompt:', prompt.slice(0, 200) + '...\n');
  
  try {
    const result = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You write authentic, engaging social media replies that sound human and add value to conversations.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      maxTokens: 150,
      preferFast: true,
    });

    console.log('Response content:', result.content);
    console.log('Response length:', result.content?.length || 0);
    
    if (!result.content || result.content.length === 0) {
      console.error('ERROR: Response is empty!');
    } else {
      console.log('\n✅ Response generation works!');
    }
  } catch (error) {
    console.error('ERROR:', error);
  }
  
  process.exit(0);
}

testResponseGeneration();

import 'dotenv/config';
import OpenAI from 'openai';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const AI_MODEL = 'llama-3.3-70b-versatile';

// The updated system prompt - with CONVERSION principles
function getSystemPrompt(pageType = 'organization') {
  const isOrganization = pageType === 'organization';
  const we = isOrganization ? 'We' : 'I';
  const our = isOrganization ? 'Our' : 'My';
  const us = isOrganization ? 'our team' : 'me';
  
  return `You are an elite social media ghostwriter who creates viral, high-converting content. Your posts get followers AND drive traffic.

## YOUR SECRET WEAPON: THE CURIOSITY LOOP

Great posts don't give answers - they raise questions in the reader's mind, then answer them while raising NEW questions.

**How it works:**
1. Hook: Raise a question (without asking it directly)
2. Build tension: Don't answer immediately  
3. Mini-payoff: Give partial answer
4. New hook: Immediately raise ANOTHER question
5. Final insight: Strong opinion + call to action

## THE PAS FORMULA (Problem-Agitate-Solve)

Every high-converting post follows this hidden structure:
- **Problem**: What pain does your audience face?
- **Agitate**: Make them FEEL it (consequences, frustration, cost)
- **Solve**: Your insight/solution (the payoff)

## CRITICAL: SPECIFICITY = BELIEVABILITY

Generic: "Many companies waste money on bad code"
Specific: "${we} spent $40k last quarter fixing a client's botched Redis implementation"

INVENT plausible details:
- Numbers: "14,000 lines", "6 weeks", "$40k", "47%"  
- Situations: "a fintech client", "last Tuesday", "during a code review"
- Technologies: "their Express API", "the Redis cache", "the Stripe integration"
- Outcomes: "Deploy time: 45 min → 8 min", "Conversions up 34%"

## VIRAL HOOK FORMULAS

**Formula 1: Story Opening** (most engaging)
"Last Friday ${we} mass-deleted 40% of ${our.toLowerCase()} codebase."
"A client asked ${us} to add AI last month. ${we} said no."

**Formula 2: Contrarian Statement** (drives comments)
"Everyone's using microservices. That's exactly why ${our.toLowerCase()} startup uses a monolith."
"The best code ${we} wrote this year? The code ${we} deleted."

**Formula 3: Transformation** (highly shareable)
"${our} deploy time went from 45 minutes to 8 minutes. Here's what ${we} did:"
"A 3-person startup was running 12 microservices. ${we} cut it to 2."

**Formula 4: Hidden Revelation** (builds curiosity)
"${our} 'senior' hire couldn't deploy to production. Not because he was bad..."
"${we} charged a client $8k to delete their code. They thanked ${us}."

## PERFECT EXAMPLE (study this)

"${we} mass-deleted 40% of ${our.toLowerCase()} codebase last Friday.

14,000 lines. Gone.

${we}'d been 'moving fast' for 18 months. Every feature was a hack on top of a hack. New engineers took 3 weeks to ship their first PR.

The 'fast' code was actually slow code.

${we} stopped. Took 2 weeks. Rewrote the core from scratch.

Now new engineers ship on day 2.

What's the biggest codebase surgery you've done?

#engineering #techdebt #startups"

**Why this works:**
- Hook has NUMBER + unexpected action (deleted code)
- Builds tension (18 months, hacks on hacks)
- Pain is FELT ("3 weeks to ship first PR")
- Strong opinion ("fast code was slow")
- Transformation shown ("day 2")
- Question invites THEIR story

## THE STRUCTURE (follow exactly)

**LINE 1 (THE HOOK) - Must be under 210 characters!**
A surprising statement with a NUMBER or unexpected detail.

**LINES 2-5 (BUILD TENSION)**
The story. What happened? Be specific. Use numbers.

**LINES 6-7 (THE INSIGHT)**
ONE strong opinion. Be bold. Short sentences.

**LAST LINE (THE CTA)**
Question that invites THEIR story (not "thoughts")

**END: 3-5 hashtags with # symbol**

## HARD RULES

1. Hook MUST be a STORY start, not a statistic
2. INVENT specific, plausible details  
3. ${isOrganization ? 'Always use "We/Our/Our team". Never "I".' : 'Always use "I/My/Me". Never "We".'}
4. ZERO emojis
5. NO em dashes. Use periods or commas.
6. Hashtags use # symbol
7. Keep under 1200 characters
8. Hook under 210 characters (must fit before "see more")

## BANNED PHRASES (instant rejection)

**Never start with:**
- "${we}'ve seen X%" / "${we}'ve found X%"
- "Many startups..." / "Most companies..."
- "In today's..." / "It's no secret..."
- Statistics without a story

**Never use anywhere:**
- "strategic architecture", "hidden liability", "future-proof"
- "${we}'ve found that", "Studies show", "Research shows"
- "Moreover", "Furthermore", "Additionally"
- "game-changing", "revolutionary", "seamlessly"

**Never end with:**
- "What are your thoughts?"
- "How do you handle this?"`;
}

async function generatePost() {
  console.log('Generating post with improved conversion-focused prompts...\n');

  const userPrompt = `Generate a LinkedIn post based on the following content strategy:

## Voice:
Write as an ORGANIZATION/COMPANY using "we", "our team", "our company". Never use "I".

## Your Voice & Persona:
A software agency that helps startups build and scale their products. Direct, confident, engineering-first.

## Target Audience:
Startup founders, CTOs, technical decision makers

## Topic for this post:
Cost of bad technical decisions

## Post Angle:
war_story: Tell a SPECIFIC story about a project that went wrong and how it was fixed.

Remember: Follow the formula from the examples. First line MUST have a specific number or surprising fact. INVENT plausible details.`;

  const response = await groq.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  
  console.log('GENERATED POST:');
  console.log('================');
  console.log(content);
  console.log('================\n');

  // Now test the reviewer
  console.log('Now testing reviewer on this content...\n');
  
  const reviewerSystemPrompt = `You are an elite social media editor who can instantly spot AI-generated content. Your job is to ensure posts are both AUTHENTIC and HIGH-CONVERTING.

You evaluate posts on two dimensions:
1. AUTHENTICITY - Does it sound like a real human wrote it?
2. CONVERSION POTENTIAL - Will it drive engagement AND traffic?

EVALUATION CRITERIA:

1. **AUTHENTICITY (0-10)** - THE MOST IMPORTANT CRITERION
   INSTANT FAILURES (score 0-3):
   - Starts with "We've seen many..." or "Many startups..."
   - Uses phrases like "hidden liability", "strategic architecture", "future-proof"
   - Generic observations without specific examples
   
   EXCELLENT (score 7-10):
   - Specific numbers, timelines, or concrete examples
   - Reads like someone telling a story to a friend
   - Has a strong, clear opinion

2. **Hook Quality (0-10)** - CRITICAL FOR CONVERSION
   - Does the first line make you STOP scrolling?
   - Is it under 210 characters?
   - Does it create CURIOSITY?
   
   TERRIBLE HOOKS (score 0-3):
   - "We've seen many startups..."
   - "In today's fast-paced world..."
   - Any generic opener
   
   GREAT HOOKS (score 8-10):
   - "We mass-deleted 14,000 lines of code last Friday."
   - Contains a specific number, action, or surprising fact

3. **AI Detection**
   RED FLAGS:
   - Em dashes anywhere
   - "not just X, but Y" structure
   - "Moreover", "Furthermore", "Additionally"
   - Generic questions like "What are your thoughts?"
   
   If you detect 2+ of these: AUTOMATIC REJECTION

Be HARSH. Output valid JSON only.`;

  const reviewPrompt = `Review this post for automatic publishing.

---
CONTENT TO REVIEW:
${content}
---

Evaluate and provide JSON:
{
  "approved": boolean,
  "decision": "publish" | "needs_revision" | "reject",
  "criteria": {
    "authenticity": { "score": number, "feedback": "string", "aiRedFlagsFound": ["string"] },
    "hookQuality": { "score": number, "feedback": "string" },
    "overallScore": number
  },
  "reasoning": "string",
  "suggestedRevisions": ["string"]
}`;

  const reviewResponse = await groq.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: reviewerSystemPrompt },
      { role: 'user', content: reviewPrompt },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const review = JSON.parse(reviewResponse.choices[0]?.message?.content || '{}');
  
  console.log('REVIEW RESULT:');
  console.log('================');
  console.log(JSON.stringify(review, null, 2));
  console.log('================');
  
  // Summary
  console.log('\n📊 SUMMARY:');
  console.log(`Decision: ${review.decision?.toUpperCase() || 'UNKNOWN'}`);
  console.log(`Authenticity Score: ${review.criteria?.authenticity?.score || 0}/10`);
  console.log(`Hook Quality Score: ${review.criteria?.hookQuality?.score || 0}/10`);
  console.log(`Overall Score: ${review.criteria?.overallScore || 0}/100`);
  
  if (review.criteria?.authenticity?.aiRedFlagsFound?.length > 0) {
    console.log(`\n⚠️ AI Red Flags Found: ${review.criteria.authenticity.aiRedFlagsFound.join(', ')}`);
  }
}

// Run 3 tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('TEST 1: War Story about Technical Decisions');
  console.log('='.repeat(60));
  await generatePost();
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Different Topic - Scaling Challenges');
  console.log('='.repeat(60));
  
  const test2Prompt = `Generate a LinkedIn post about:

## Voice:
Organization (we/our)

## Topic:
Scaling challenges and when NOT to scale

## Angle:
contrarian: Challenge the "always scale" mindset. Most startups scale too early.

Remember: Follow the formula. First line MUST have a specific number or surprising fact. INVENT plausible details.`;

  const test2Response = await groq.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: test2Prompt },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  console.log('\nGENERATED POST:');
  console.log('================');
  console.log(test2Response.choices[0]?.message?.content);
  console.log('================');
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Problem-Solution about DevOps');
  console.log('='.repeat(60));
  
  const test3Prompt = `Generate a LinkedIn post about:

## Voice:
Organization (we/our)

## Topic:
CI/CD and deployment best practices

## Angle:
transformation: Show a before/after story of fixing a broken deployment process.

Remember: Follow the formula. First line MUST have a specific number or surprising fact. INVENT plausible details.`;

  const test3Response = await groq.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: test3Prompt },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  console.log('\nGENERATED POST:');
  console.log('================');
  console.log(test3Response.choices[0]?.message?.content);
  console.log('================');
}

runTests().catch(console.error);

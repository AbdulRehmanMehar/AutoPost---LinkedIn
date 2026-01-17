# LinkedIn Auto-Poster

A self-hosted tool for scheduling and auto-posting content to LinkedIn with AI-powered content generation.

## Features

- **Three Posting Modes**
  - **Manual** - Write your own content with full control
  - **Structured** - Provide key details (problem, solution, tech stack), AI writes the post
  - **AI Generate** - Describe your topic, AI creates the entire post

- **Smart AI Content Generation**
  - Optimized prompts for high-engagement LinkedIn posts
  - Human-like writing style (no AI-sounding phrases)
  - Customizable tone, emojis, and hashtags
  - Posts optimized for 800-1200 characters (engagement sweet spot)

- **Media Support**
  - Upload images and videos (up to 100MB)
  - S3-compatible storage (MinIO, AWS S3, etc.)
  - Media attached natively to LinkedIn posts

- **Scheduling**
  - Schedule posts for future publishing
  - Automatic publishing via built-in cron scheduler
  - View and manage scheduled posts

- **Self-Hosted & Dockerized**
  - Run on your own infrastructure
  - Docker Compose setup with built-in scheduler
  - No external cron services needed

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: MongoDB
- **Auth**: NextAuth.js v5 with LinkedIn OAuth
- **AI**: OpenAI GPT-4o-mini
- **Storage**: S3-compatible (MinIO)
- **Styling**: Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB instance
- MinIO or S3-compatible storage
- LinkedIn Developer App ([create here](https://www.linkedin.com/developers/apps))
- OpenAI API key

### Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```env
# MongoDB
MONGODB_URI=mongodb://user:password@localhost:27017/linkedin-poster?authSource=admin

# NextAuth
AUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret

# OpenAI
OPENAI_API_KEY=your-openai-key

# S3/MinIO Storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=uploads

# Cron Secret (for scheduler authentication)
CRON_SECRET=your-random-secret
```

### LinkedIn App Setup

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Create a new app
3. Under "Auth" tab, add redirect URL: `http://localhost:3000/api/auth/callback/linkedin`
4. Under "Products" tab, request access to:
   - Sign In with LinkedIn using OpenID Connect
   - Share on LinkedIn
5. Copy Client ID and Client Secret to your `.env`

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Docker Deployment

The easiest way to deploy. Everything runs in containers with automatic scheduling.

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### What's Included

| Container | Purpose |
|-----------|---------|
| `app` | Next.js application (port 3000) |
| `scheduler` | Cron job that publishes scheduled posts every 5 minutes |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
├─────────────────────────┬───────────────────────────────┤
│      app (Next.js)      │      scheduler (Alpine)       │
│      Port 3000          │      Cron every 5 min         │
└───────────┬─────────────┴───────────────┬───────────────┘
            │                             │
            ▼                             ▼
┌───────────────────┐         ┌───────────────────────────┐
│     MongoDB       │         │    /api/cron/publish      │
│   (your server)   │         │    Finds due posts        │
└───────────────────┘         │    Posts to LinkedIn      │
                              └───────────────────────────┘
┌───────────────────┐
│   MinIO / S3      │
│  (media storage)  │
└───────────────────┘
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/posts` | GET | List all posts |
| `/api/posts` | POST | Create a new post |
| `/api/posts/[id]` | PUT | Update a post |
| `/api/posts/[id]` | DELETE | Delete a post |
| `/api/generate` | POST | Generate AI content |
| `/api/upload` | POST | Upload media files |
| `/api/cron/publish` | GET | Process scheduled posts |
| `/api/health` | GET | Health check |

## Post Modes Explained

### Manual Mode
You write everything. Full control over content, formatting, and hashtags.

### Structured Mode
Provide structured input:
- **Title**: What you built/did
- **Problem**: What problem it solves
- **Solution**: How it solves it
- **Tech Stack**: Technologies used
- **Outcome**: Results or impact
- **CTA**: Discussion topic

AI generates an engaging LinkedIn post from this structure.

### AI Generate Mode
Just describe what you want to post about. The AI writes a complete post following LinkedIn best practices:
- Strong hook in the first line
- Scannable format
- Human-like tone (no marketing speak)
- Thoughtful closing question
- Relevant hashtags

## AI Writing Quality

The AI is tuned to write like a senior professional, not a marketer:

**Avoided patterns:**
- Em dashes (—)
- "Not just X, but Y"
- Marketing words: "empowering", "revolutionizing", "seamlessly"
- AI phrases: "It's worth noting", "At its core", "Moreover"

**Encouraged patterns:**
- First person ("I built", "I learned")
- Contractions (don't, it's, that's)
- Varied sentence length
- Honest disclaimers for POCs/early-stage work
- Specific closing questions

## License

MIT


# DynastyJudge — Setup Guide

## Stack
- **Framework**: Next.js 14 (App Router-compatible, using Pages Router for simplicity)
- **Deployment**: Vercel (free tier)
- **Subscriptions**: Memberful + Stripe (add in Phase 2)
- **Database**: None yet (Phase 1 is static + Sleeper API only)
- **Styling**: CSS Modules + global design tokens

## Getting started locally

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev

# 3. Open http://localhost:3000
```

## Deploy to Vercel (5 minutes)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (first time — follow prompts)
vercel

# Production deploy
vercel --prod
```

## Project structure

```
dynastyjudge/
├── components/
│   ├── Nav.jsx            # Sticky nav with mobile menu
│   └── Nav.module.css
├── lib/
│   └── sleeper.js         # Full Sleeper API client + WebSocket
├── pages/
│   ├── _app.jsx           # Global app wrapper
│   ├── index.jsx          # Homepage
│   └── api/               # API routes (add as needed)
├── styles/
│   └── globals.css        # Design system tokens + utilities
└── public/                # Static assets
```

## Phase 2 additions (next sprint)

### Memberful paywall
```bash
npm install @memberful/next
```
Set env vars:
```
MEMBERFUL_API_KEY=xxx
MEMBERFUL_SUBDOMAIN=dynastyjudge
```

### Environment variables needed
Create `.env.local`:
```
NEXT_PUBLIC_SITE_URL=https://dynastyjudge.com

# Phase 2 — Memberful
MEMBERFUL_API_KEY=
MEMBERFUL_SUBDOMAIN=

# Phase 2 — newsletter
BEEHIIV_API_KEY=
BEEHIIV_PUBLICATION_ID=

# Phase 3 — AI layer
ANTHROPIC_API_KEY=
```

## Sleeper integration

The `lib/sleeper.js` file is a complete Sleeper API client with:
- All REST endpoints (leagues, rosters, drafts, transactions, players)
- In-memory caching with appropriate TTLs per endpoint
- WebSocket connection for live draft data
- `findPlayerAcrossLeagues()` — powers the player→leagues tool
- `buildLeaguemateTendencies()` — powers the draft analyzer and predictions
- `getLeagueSnapshot()` — powers the league dashboard

**Test it with your own Sleeper username:**
```javascript
import { getUser, getUserLeagues } from '../lib/sleeper';

const user = await getUser('your_sleeper_username');
const leagues = await getUserLeagues(user.user_id, 'nfl', '2026');
```

## Design system

Colors, typography, and utility classes are in `styles/globals.css`.

Key design tokens:
- Primary: Charcoal (`--charcoal-900: #1C1C1E`)
- Accent: Gold (`--gold-500: #C8973A`)
- Display font: Playfair Display (serif — courtroom authority)
- Body font: Inter (clean, readable)

Brand voice: Courtroom aesthetic throughout.
- Articles = "Rulings"
- Trade advice = "Verdicts"
- Rankings = "The Docket"
- Draft analysis = "The Brief"
- Subscription = "Judge Elite"

## Content pages to build next (Phase 2)

- [ ] `/rankings` — Dynasty rankings (1QB, SF, TE Prem)
- [ ] `/analysis/[slug]` — Individual ruling pages
- [ ] `/tools/trade-calculator` — Free trade calc
- [ ] `/tools/league-analyzer` — Sleeper connect + dashboard
- [ ] `/devy` — DevyJudge landing
- [ ] `/subscribe` — Pricing / Memberful checkout
- [ ] `/podcast` — Episode feed

## AI personality (Phase 2)

For the on-camera AI avatar:
1. Write scripts for each video (AI-assisted)
2. Generate avatar video via HeyGen (https://heygen.com)
3. Export and publish to YouTube
4. Auto-embed on corresponding article page

The avatar's name and look TBD — should feel authoritative, like a courtroom analyst.
Suggested name: "The Judge" or "Judge [Surname]" — one consistent persona across all platforms.

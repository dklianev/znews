# zemun-news

Bulgarian comic-book tabloid news platform for a FiveM roleplay server community. GTA/Bulgarian tabloid aesthetic with interactive games, admin panel, and real-time breaking news.

**Live site**: https://znews.live
**All UI text must be in Bulgarian.**

## Tech Stack

| Layer | Tech | Version |
|---|---|---|
| Frontend | React | 19.2.4 |
| Routing | React Router DOM | 7.13.1 |
| Styling | TailwindCSS | 4.2.2 |
| Animation | Motion (Framer Motion) | 12.38.0 |
| Icons | Lucide React | 0.577.0 |
| Build | Vite | 8.0.1 |
| Backend | Express.js | 5.2.1 |
| Database | MongoDB via Mongoose | 9.3.1 |
| Image processing | Sharp | 0.34.5 |
| Auth | JWT + bcryptjs | 9.0.3 / 3.0.3 |
| Storage | Azure Blob / disk | @aws-sdk/client-s3 |
| Push | Web Push | 3.6.7 |
| PWA | vite-plugin-pwa + Workbox | 1.2.0 / 7.4.0 |

**Node requirement**: `^20.19.0 || >=22.12.0`

## CEF 103 Compatibility (CRITICAL)

This site runs inside FiveM's Chromium Embedded Framework (CEF), which is Chrome 103. You MUST:

- **No modern CSS**: No `:has()`, no container queries, no `@layer` without fallbacks
- **No `aspect-ratio`** without fallback
- **oklch/oklab/color-mix**: Handled by PostCSS plugins automatically, but avoid in inline styles
- **ZWJ emojis**: Use single-codepoint emojis only (e.g. `😱` not `😵‍💫`)
- **`crypto.randomUUID()`**: Available in CEF 103 (Chrome 92+), but always provide fallback
- **Framer Motion**: Use `motion/react` import path (not `framer-motion`)
- **`e.code`** for keyboard handling: Use physical key positions, not `e.key`, for layout-independent input (BG Phonetic keyboard support)

Compatibility principle:
- Build UI/UX for modern browsers first, then add explicit CEF 103-safe fallbacks where needed
- Do not intentionally downgrade the experience for newer browsers just to match CEF 103
- Prefer progressive enhancement over lowest-common-denominator design
- When using a newer API or CSS feature, keep the richer experience where supported and provide a stable fallback for CEF 103

PostCSS plugins handle fallbacks automatically:
- `@csstools/postcss-oklab-function` — oklch/oklab → rgb
- `@csstools/postcss-color-mix-function` — color-mix → rgba
- `@csstools/postcss-media-minmax` — media range syntax

## Commands

```bash
npm run dev              # Dev server (Vite + Express)
npm run dev:client       # Vite frontend only
npm run dev:server       # Express backend only (--watch)
npm test                 # Run all tests (70+)
npm run build            # Production build
npm start                # Production server
npm run seed             # Seed initial data
npm run seed:games       # Seed game puzzles
npm run check            # Syntax check + build
```

## Project Structure

```
zemun-news/
├── src/                          # React frontend
│   ├── App.jsx                   # Router + layout
│   ├── index.css                 # Global styles + Tailwind + comic utilities
│   ├── main.jsx                  # Entry point
│   ├── pages/                    # Lazy-loaded page components
│   ├── components/               # Reusable UI components
│   ├── context/                  # DataContext.jsx, ThemeContext.jsx
│   ├── hooks/                    # Custom hooks
│   ├── utils/                    # Utilities (api.js, game logic, etc.)
│   └── content/uiCopy.js        # UI strings
├── server/                       # Express backend
│   ├── app.js                    # App init, routes, middleware (main file)
│   ├── index.js                  # Server entry
│   ├── models.js                 # All Mongoose schemas
│   ├── routes/                   # Route handlers
│   ├── services/                 # 40+ business logic services
│   ├── requestIdentity.js        # Fingerprinting & client IP
│   └── scripts/                  # Migration & seed scripts
├── shared/                       # Code shared frontend + backend
│   ├── spellingBee.js
│   ├── crossword.js
│   ├── homepageSelectors.js
│   ├── adResolver.js, adSlots.js
│   └── ...
├── tests/                        # 70+ test files
│   └── run-tests.mjs             # Test runner
└── public/                       # Static assets
```

## Design System

### Colors
| Name | Hex | Usage |
|---|---|---|
| `zn-hot` | #CC0A1A | Primary red, CTAs, breaking |
| `zn-purple` | #5B1A8C | Secondary, accents |
| `zn-comic-black` | #1C1428 | Borders, text |
| `zn-gold` | #E8B830 | Awards, highlights |
| `zn-orange` | #E87420 | Warm accents |
| `zn-bg` | #E8DFD0 | Paper beige background |
| `zn-paper` | #F2EDE5 | Light paper |

### Fonts
| Class | Font | Usage |
|---|---|---|
| `font-display` | Oswald | Headlines, bold text, UI labels |
| `font-comic` | Bangers + Oswald fallback | Playful headers (no native Cyrillic in Bangers) |
| `font-body` / `font-sans` | Nunito Sans | Body text |
| `font-mono` | JetBrains Mono | Data, scores, code |

### Standard Border Pattern
```
border-3 border-[#1C1428]
boxShadow: '4px 4px 0 #1C1428'
```

### Comic CSS Classes

**Panels & Borders**
- `comic-panel` — 3px black border + 4px offset shadow
- `comic-panel-red` — Red border variant
- `comic-panel-hover` — Hover lift effect

**Overlays & Texture**
- `comic-dots` — Halftone dot overlay via `::after`
- `comic-dots-red` — Red halftone
- `newspaper-page` — Paper texture with grid dots
- `paper-lines` — Horizontal lines background

**Bubbles & Stamps**
- `comic-bubble` — White speech bubble with tail
- `comic-bubble-hot` — Red gradient bubble with glow
- `comic-stamp-circle` — Rotated circular stamp badge
- `comic-sticker` — Red rotated sticker

**Motion & Effects**
- `comic-speed-lines` — Radiating speed lines
- `comic-stage` — Content wrapper with radial gradient
- `starburst` — Yellow explosion badge (16-point star)

**Banners & Ribbons**
- `headline-banner-hot` / `-purple` / `-navy` / `-gold` — Section banners
- `comic-ribbon-hot` / `-purple` / `-navy` / `-gold` — Ribbon decorations
- `breaking-badge` — Pulsing red badge
- `breaking-strip` — Red ticker strip

**Text Effects**
- `text-comic-stroke` — 2px black text stroke (works with Cyrillic)
- `text-comic-stroke-white` — White stroke variant
- `text-shadow-brutal` — Double 3px/6px shadow
- `text-shadow-red` — Red + dark shadow
- `text-gradient-hot` — Red gradient text
- `text-gradient-purple` — Purple gradient text

**Cards & Layout**
- `comic-story-card` — Card with border and hover lift
- `polaroid` — Photo frame with tape decoration
- `tape`, `tape-tl`, `tape-tr` — Decorative tape corners

**Navigation**
- `nav-pill` / `nav-pill-hot` / `nav-pill-purple` — Rounded pill buttons
- `btn-primary` — Purple gradient button
- `btn-hot` — Red button
- `comic-chip` / `comic-chip-hot` — Pill badges

**Dividers**
- `zn-divider` — Light 2px divider
- `zn-divider-bold` — 4px red divider

### Animations
- `animate-ticker` — Horizontal scroll (35s)
- `animate-hot-pulse` — Pulse scale (1.5s)
- `animate-shake` — Shake effect (0.5s)
- `animate-float` — Float up/down (3s)
- `animate-wiggle` — Rotate wiggle (2s)
- `animate-stamp` — Stamp pop-in (0.4s)
- `animate-pop-in` — Pop scale (0.4s)
- `animate-shimmer` — Shimmer sweep (3.5s)

### Dark Mode
All components support dark mode via `dark:` Tailwind variants. Theme is managed by `ThemeContext.jsx` with `localStorage` persistence.

## Frontend Routes

### Public
| Path | Component | Description |
|---|---|---|
| `/` | HomePage | Curated homepage |
| `/article/:id` | ArticlePage | Article detail |
| `/category/:slug` | CategoryPage | Category listing |
| `/author/:id` | AuthorPage | Author profile + articles |
| `/search` | SearchPage | Full-text search |
| `/about` | AboutPage | About page |
| `/jobs` | JobsPage | Job listings |
| `/court` | CourtPage | Court records |
| `/events` | EventsPage | Events calendar |
| `/gallery` | GalleryPage | Photo gallery |
| `/tipline` | TipLine | Anonymous tip form |
| `/games` | GamesPage | Games hub |
| `/games/word` | GameWordPage | Wordle (Bulgarian) |
| `/games/connections` | GameConnectionsPage | Connections puzzle |
| `/games/hangman` | GameHangmanPage | Hangman |
| `/games/quiz` | GameQuizPage | Daily quiz |
| `/games/crossword` | GameCrosswordPage | Crossword |
| `/games/spellingbee` | GameSpellingBeePage | Spelling bee |
| `/games/sudoku` | GameSudokuPage | Sudoku |
| `/games/tetris` | GameTetrisPage | Tetris |
| `/games/snake` | GameSnakePage | Snake |
| `/games/2048` | Game2048Page | 2048 |
| `/games/flappybird` | GameFlappyBirdPage | Flappy Bird |

### Admin (protected)
| Path | Component |
|---|---|
| `/admin/login` | AdminLogin |
| `/admin` | Dashboard |
| `/admin/articles` | ManageArticles |
| `/admin/profiles` | ManageProfiles |
| `/admin/editorial-queue` | EditorialQueue |
| `/admin/media` | ManageMedia |
| `/admin/ads` | ManageAds |
| `/admin/breaking` | ManageBreaking |
| `/admin/hero` | ManageHero |
| `/admin/categories` | ManageCategories |
| `/admin/wanted` | ManageMostWanted |
| `/admin/jobs` | ManageJobs |
| `/admin/court` | ManageCourt |
| `/admin/events` | ManageEvents |
| `/admin/polls` | ManagePolls |
| `/admin/comments` | ManageComments |
| `/admin/gallery` | ManageGallery |
| `/admin/contact` | ManageContactMessages |
| `/admin/tips` | ManageTips |
| `/admin/permissions` | ManagePermissions |
| `/admin/site-settings` | ManageSiteSettings |
| `/admin/diagnostics` | AdminDiagnostics |
| `/admin/audit-log` | ManageAuditLog |
| `/admin/games` | ManageGames |
| `/admin/games/puzzles` | ManageGamePuzzles |

## Key API Endpoints

### Articles
- `GET /api/articles` — List published (paginated, filterable by category/author/hero/breaking)
- `GET /api/articles/:id` — Detail
- `POST /api/articles/:id/view` — Track view
- `GET /api/articles/:id/reactions/me` — Get user's reaction state
- `POST /api/articles/:id/react` — Add reaction (emoji: fire|shock|laugh|skull|clap)
- `GET /api/articles/:id/comments` — Get comments
- `POST /api/articles/:id/comments` — Add comment

### Auth
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `POST /api/auth/refresh` — Refresh JWT

### Other Public
- `GET /api/categories` — List categories
- `GET /api/authors` — List authors
- `GET /api/authors/:id` — Author detail + stats
- `GET /api/search?q=` — Full-text search
- `GET /api/polls` — Active polls
- `POST /api/polls/:id/votes` — Vote
- `GET /api/games` — List games
- `GET /api/games/:slug/puzzle` — Get daily puzzle
- `POST /api/push/subscribe` — Push notification subscribe
- `GET /api/health` — Health check

## Database Models (server/models.js)

**Core**: Article, Author, Category, Breaking
**Content**: Job, Court, Event, Gallery, Poll, Comment, ContactMessage, Tip
**Auth**: User, AuthSession, Permission
**Ads**: Ad, AdEvent, AdAnalyticsAggregate
**Games**: GameDefinition, GamePuzzle
**Tracking**: ArticleView, ArticleReaction, PollVote, SearchQueryStat
**System**: AuditLog, PushSubscription, Counter, SystemEvent, BackgroundJobState, HeroSettings, SiteSettings, ArticleRevision, SettingsRevision

Articles use **numeric IDs** allocated atomically via Counter model.

## Key Architectural Patterns

1. **Service injection**: All business logic in `server/services/`, injected as dependencies into routes
2. **Fingerprint-based dedup**: Views, reactions, poll votes use hashed client fingerprint (IP + UA + optional clientId) with time-windowed deduplication
3. **Optimistic UI**: Reactions use optimistic updates with rollback on error
4. **Lazy loading**: All pages are `React.lazy()` with code splitting
5. **Shared code**: `/shared/` folder for logic used by both frontend and backend (game validation, ad resolution, homepage selectors)
6. **numericCrudFactory**: Generic CRUD handler for numeric-ID entities
7. **asyncHandler**: Express error wrapper in `expressAsyncService.js`
8. **Per-emoji reactions**: Users can react once per emoji per article (not once per article). Uses `ACTIVE_REACTION_FILTER` to handle migration from old single-reaction model
9. **Browser fingerprint**: Separate `hashBrowserClientFingerprint` (includes X-ZN-Client-Id header) vs `hashClientFingerprint` (IP+UA only). Reactions use browser fingerprint for writes, check both for reads
10. **Touch controls**: Scoped to board elements (not window) to prevent scroll interference
11. **Clipboard**: `copyToClipboard()` helper with `navigator.clipboard` → `execCommand('copy')` fallback
12. **Keyboard input**: BG Phonetic `e.code` mapping for layout-independent game controls

## Common Development Tasks

### Adding a new page
1. Create `src/pages/NewPage.jsx`
2. Add lazy import in `src/App.jsx`
3. Add `<Route>` in the router
4. Add navigation links as needed

### Adding a new game
1. Create game page `src/pages/GameNewPage.jsx`
2. Create logic utils `src/utils/newGame.js`
3. Create board/UI components in `src/components/games/new/`
4. Add route in `src/App.jsx` with lazy import
5. Add GameDefinition seed in `server/gameSeed.js`
6. Add puzzle handler in `server/routes/publicGamesRoutes.js`
7. Add tests in `tests/newGame.test.mjs`

### Styling a new component
- Use `comic-panel` for bordered containers
- Use `comic-dots` for halftone texture overlay
- Use `font-display font-black uppercase tracking-wider` for headlines
- Use `border-3 border-[#1C1428]` with `boxShadow: '4px 4px 0 #1C1428'`
- Always add `dark:` variants
- Use `newspaper-page` for content areas

### Adding a new API endpoint
1. Create route file in `server/routes/`
2. Use `asyncHandler` wrapper for all handlers
3. Wire up in `server/app.js` with dependency injection
4. Add rate limiting if public-facing
5. Add tests in `tests/`

## Environment Variables

```env
MONGODB_URI=mongodb+srv://...
PORT=3001
JWT_SECRET=...
REFRESH_TOKEN_SECRET=...
DEFAULT_ADMIN_PASSWORD=...
ALLOWED_ORIGINS=http://localhost:3000,https://znews.live
PUBLIC_BASE_URL=https://znews.live
STORAGE_DRIVER=azure          # disk | spaces | azure
AZURE_BLOB_ACCOUNT=...
AZURE_BLOB_CONTAINER=uploads
AZURE_BLOB_SAS_TOKEN=...
VAPID_PRIVATE_KEY=...
VAPID_PUBLIC_KEY=...
```

## Testing

70+ test files in `tests/`, run via `node tests/run-tests.mjs`. Tests use Node's built-in `assert` module with `mongodb-memory-server` for DB tests.

```bash
npm test
```

Test files follow pattern: `tests/<module>.test.mjs` with exported `run<Module>Tests()` function registered in `tests/run-tests.mjs`.

## Rules

- All UI text in Bulgarian
- No Co-Authored-By in commits
- Push immediately after commit
- CEF 103 compatible — test with Chrome 103 constraints
- Use `e.code` (not `e.key`) for keyboard controls in games
- Scope touch events to board elements, never `window`
- Use `copyToClipboard()` from `src/utils/copyToClipboard.js` — never raw `navigator.clipboard`
- Use `getSwipeDirection()` from `src/utils/touchSwipe.js` for swipe detection
- Comic-book tabloid aesthetic in all new UI
- Dark mode support required
- Reactions are per-emoji (one per emoji per article, not one per article)
- Author stats come from server aggregate endpoint, not client-side calculation

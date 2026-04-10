# Design System — GATE Math

## Product Context
- **What this is:** Mobile-first GATE Engineering Mathematics exam prep app with Study Commander (tells you what to study each day), AI tutor, camera scan, and smart notebook
- **Who it's for:** GATE exam aspirants (engineering students, 21-28), studying late nights on mobile
- **Space/industry:** Competitive exam prep (India). Peers: EduRev, Testbook, GradeUp, Unacademy
- **Project type:** Progressive web app, mobile-first SPA
- **Differentiator:** Study strategist that tells you what to study next — priority engine based on marks weight, weakness, improvement speed, recency, and exam proximity. No other GATE app provides personalized daily study plans.

## Aesthetic Direction
- **Direction:** Playful-Serious — warm dark theme with vibrant accents
- **Decoration level:** Intentional (subtle surface layering, glows on interactive elements)
- **Mood:** "Confident student studying at midnight with good coffee." Focused but not sterile. Serious about learning but not corporate.
- **Reference sites:** Duolingo (gamification, warmth), Photomath (camera UX, confidence), Khan Academy (mastery tracking)

## Typography
- **Display/Hero:** Satoshi Black (900) — geometric, confident, modern. Used for headings, topic names, scores, the things that need presence.
- **Body:** DM Sans (400-700) — clean readability, excellent x-height, great for math explanations and UI text.
- **UI/Labels:** DM Sans 500-600
- **Data/Tables:** JetBrains Mono (400-600) — tabular-nums, perfect for math expressions, problem IDs, LaTeX, verification output.
- **Code:** JetBrains Mono
- **Loading:** Google Fonts CDN — `family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600` + Fontshare for Satoshi
- **Scale:** 11px (caption) / 13px (small) / 15px (body) / 18px (h3) / 22px (h2) / 32px (h1) / 48px (display)

## Color
- **Approach:** Balanced — three semantic accents with deep neutral base
- **Background:** `#0a0f1a` (deep navy-black)
- **Surfaces:** `#111827` (surface-1), `#1f2937` (surface-2), `#374151` (surface-3)
- **Primary accent:** `#10b981` (emerald) — mastery, success, correct answers, primary CTA
- **Secondary accent:** `#f59e0b` (amber) — streaks, urgency, warnings, due reviews
- **Tertiary accent:** `#38bdf8` (sky blue) — AI tutor, focus states, active nav, informational
- **Text:** `#f9fafb` (primary), `#d1d5db` (secondary), `#9ca3af` (muted), `#6b7280` (dim)
- **Semantic:** success `#10b981`, warning `#f59e0b`, error `#ef4444`, info `#38bdf8`
- **Soft variants:** Each accent has a 15% opacity background variant for badges, alerts, soft buttons
- **Dark mode:** This IS the primary theme. Light mode: swap to slate backgrounds (#f8fafc, #ffffff, #f1f5f9)
- **Blog/public pages:** Use the SAME dark theme as the app (unified brand). No separate light blog.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — cards breathe, touch targets 44px minimum
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined mobile app shell
- **Grid:** Single column on mobile (375px), 2-column topic grid, max 3xl (768px) content area
- **Max content width:** 768px (3xl)
- **Bottom nav:** 3 tabs — Home, Notes, Progress (+ Settings via header)
- **Tutor FAB:** 56px sky-blue floating action button (bottom-right, above nav). Always visible except on /chat. The tutor is the primary surface, not a peer tab.
- **Border radius:** sm:6px, md:10px, lg:16px, xl:24px, full:9999px
- **Cards:** Full-bleed on mobile with surface-1 background, surface-3 border, lg radius

## Motion
- **Approach:** Intentional (Framer Motion throughout)
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out) spring(stiffness:300, damping:30)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)
- **Signatures:**
  - Celebration confetti on correct answers and milestones
  - Staggered fade-in for lists (50ms delay per item)
  - Count-up animations for stat numbers
  - Spring physics for nav indicator and interactive elements
  - Page transitions: fade + slight upward slide (200ms)

## New Features (Design Specs)

### Camera Scan (multimodal input)
- Full-screen camera viewfinder with emerald corner markers
- Center scanning zone (280x180px) with animated scan line
- Large capture button (64px circle, emerald, glow shadow)
- Gallery upload alternative below capture button
- After capture: show extracted text, allow edit, then verify

### Smart Notebook
- Topic filter pills (horizontal scroll, emerald active state)
- Entry list with completion status dots (emerald=mastered, amber=in-progress, gray=to-review)
- Each entry shows: query text, topic tag (mono, sky blue), timestamp
- Topic-wise grouping with completion percentage headers
- Search/filter bar at top

### Exam Readiness Score
- Composite badge on home page: emerald border, large score number
- Factors: topic coverage, accuracy %, SR health, weak spot count, days until exam
- Updates in real-time as student practices

## Blog & Public Pages

### Style: Dark Neubrutalism (Gen Z/Gen Alpha)
- **Aesthetic:** Hard 2px borders, colored offset shadows (3px 3px), sharp 4px corners, bold uppercase labels
- **Typography:** Space Grotesk (geometric, modern) + JetBrains Mono for code. Bold 700 weight headings, tight letter-spacing (-0.03em)
- **Cards:** Each feed item is a bordered card with content-type accent color. Shadow shifts to 0 on hover (200ms).
- **Badges:** 2px bordered, uppercase, type-colored. Not rounded pills, squared off (2px radius).
- **Influence:** Neubrutalism style from UI/UX Pro Max — excellent performance, WCAG AAA, low complexity, high personality.

### Layout: Single-Column Feed
- **Index:** Single-column card feed. Each post gets a bordered neubrutalist card.
- **Filters:** Topic pills (uppercase, 4px corners) + sort tabs + content type tabs
- **Post page:** Full-width reading, max 700px. Sticky floating CTA bar at bottom.
- **Sort:** Uses `content_score` from Content Intelligence Engine for "Trending" sort.

### Blog Motion (CSS-only, zero JS)
- **Entrance:** `@keyframes enterUp` with staggered delay (80ms per card, capped at 640ms)
- **Hover:** Shadow-shift micro-interaction (`translate(3px,3px)` + `box-shadow:0 0 0`) — feels tactile
- **Scroll reveal:** `animation-timeline: view()` (CSS scroll-driven, progressive enhancement)
- **Reduced motion:** Full `prefers-reduced-motion:reduce` support — disables all animations and transitions
- **Budget:** ~4KB CSS total. Zero JavaScript. Single font load (Space Grotesk).

### Blog-to-App Bridge
- Every blog post has a neubrutalist app feature CTA card (bordered, offset shadow, accent-colored)
- Sticky CTA bar at bottom: bordered, offset shadow, "Practice [topic]" + "Open App" button
- Deep links to relevant app feature per content type (practice, onboard, diagnostic, chat)

## App Declutter Rules
- **Mental model:** Anytime help portal, not a test center. Tutor is always one tap away via FAB.
- **Header:** 48px height, "G" logo badge only (no "GATE Math" text), streak + user avatar right.
- **Content padding:** `px-4 pt-2 pb-4` — saves 8px dead space at top of every page.
- **Progressive disclosure:** Collapse by default, expand on demand. ProgressPage shows top 3 topics; NotebookPage hides topic summary grid.
- **No dead ends:** Every terminal state (all done, free study day, celebration) links to the tutor.
- **Result simplification:** PracticePage shows compact result banner (icon + verdict), no verification metadata.
- **Onboarding:** 3-bucket tappable sort (Weak/Okay/Strong) instead of 10 individual sliders.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Initial design system created | /design-consultation based on competitive research (Duolingo, Photomath, Khan Academy, EduRev) |
| 2026-03-28 | Satoshi + DM Sans + JetBrains Mono | Satoshi for bold presence, DM Sans for readability, JetBrains for math expressions |
| 2026-03-28 | Dark-first with emerald/amber/sky | Late-night study context, emerald = mastery/success, amber = urgency/streaks, sky = AI/focus |
| 2026-03-28 | 6-tab nav (added Scan + Notebook) | Camera input and structured notebook are the key differentiators |
| 2026-03-28 | Exam Readiness Score | Single motivating metric that goes beyond "problems solved" |
| 2026-04-04 | Dark blog (unified brand) | Every GATE prep site has white blogs. Dark stands out, feels premium, matches app. 11.5:1 contrast ratio exceeds WCAG AAA |
| 2026-04-04 | Single-column feed layout | Card grids waste space on mobile. Feed is scannable, each post gets enough room to read |
| 2026-04-04 | CSS-only blog animations | Zero JS runtime cost. scroll-driven animations via CSS. Progressive enhancement for Safari |
| 2026-04-04 | Home declutter — removed welcome banner, consolidated CTAs | Topic grid is the product. CTAs should support, not compete with content |
| 2026-04-04 | Sticky floating CTA pill on blog posts | Less intrusive than inline button. Always visible without breaking reading flow |
| 2026-04-05 | Dark Neubrutalism blog redesign | Gen Z/Gen Alpha aesthetic. Hard borders, offset shadows, Space Grotesk. Excellent perf (WCAG AAA), zero JS, high personality. Via UI/UX Pro Max skill. |
| 2026-04-05 | prefers-reduced-motion support | Full accessibility: all blog animations + transitions disabled when user prefers reduced motion |
| 2026-04-10 | 3 tabs + Tutor FAB | Tutor is primary surface, not a peer tab. FAB = 1-tap access from anywhere. |
| 2026-04-10 | Collapse-by-default on Progress + Notebook | Tired students don't need 10 topic cards. Show weakest 3, expand on demand. |
| 2026-04-10 | 3-bucket onboarding | 10 sliders → 3 tappable buckets. Faster (10 taps vs 10 drags), more mobile-friendly. |
| 2026-04-10 | Compact practice results | Removed verification metadata (tier, ms, confidence). Students don't learn from "Gemini solved in 2.3s". |

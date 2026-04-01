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

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — cards breathe, touch targets 44px minimum
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined mobile app shell
- **Grid:** Single column on mobile (375px), 2-column topic grid, max 3xl (768px) content area
- **Max content width:** 768px (3xl)
- **Bottom nav:** 5 tabs expanding to 6 — Home, Tutor, Scan, Notebook, Progress (+ Settings via header)
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

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-28 | Initial design system created | /design-consultation based on competitive research (Duolingo, Photomath, Khan Academy, EduRev) |
| 2026-03-28 | Satoshi + DM Sans + JetBrains Mono | Satoshi for bold presence, DM Sans for readability, JetBrains for math expressions |
| 2026-03-28 | Dark-first with emerald/amber/sky | Late-night study context, emerald = mastery/success, amber = urgency/streaks, sky = AI/focus |
| 2026-03-28 | 6-tab nav (added Scan + Notebook) | Camera input and structured notebook are the key differentiators |
| 2026-03-28 | Exam Readiness Score | Single motivating metric that goes beyond "problems solved" |

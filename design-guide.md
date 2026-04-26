# ReproClaw Design Guide

**Audience:** AI agents and human contributors building any frontend surface for ReproClaw.

**Read this first, before writing a single line of HTML or CSS.** This guide is the contract every page in the app must follow. The design system is already established and visible in `apps/api/app/static/dashboard.html` + `styles.css` (the audit dashboard, sidebar, and chat panels). New pages must look and feel like a continuation of those — not a different product.

---

## 1. Project context

ReproClaw is a hackathon MVP that audits ML papers for reproducibility. Researchers email a paper + repo to an AgentMail inbox; ReproClaw extracts auditable claims, aligns them to code via Nia, scores reproducibility, and replies in-thread with a reviewer-grade report.

**Surface inventory** (where agents will work):
- `apps/api/app/static/index.html` — public landing page (`/`).
- `apps/api/app/static/dashboard.html` — single-page app for everything authenticated. Multiple "pages" live as views inside this file, switched via `data-view` on `.dashboard-app` (currently `audit` and `chat`).
- `apps/api/app/static/styles.css` — all dashboard + sidebar + chat styles.
- `apps/api/app/static/landing.css` / `landing.js` — landing-page only.
- `apps/api/app/static/app.js` — the dashboard's view switcher, audit polling, and chat client.
- `apps/api/app/static/logos/` — brand and integration logos.

**Backend stays out of frontend redesigns.** Do not touch `apps/api/app/*.py` unless you're explicitly asked.

---

## 2. Hard constraints

These are non-negotiable. Violating them blocks merge.

1. **No frontend frameworks.** No React, Vue, Svelte, Next.js, Remix, Angular, Solid.
2. **No utility CSS frameworks.** No Tailwind, no UnoCSS, no PandaCSS.
3. **No component libraries.** No shadcn/ui, no Radix, no MUI, no Chakra.
4. **No charting libraries.** No Chart.js, no Recharts, no D3 imports. Build any data visualization in inline SVG + CSS.
5. **No markdown libraries.** Inline render: code fences in `<pre>`, bold in `<strong>`, links auto-detected. The app already has a renderer in `app.js` (`renderMarkdownChat`) — reuse it.
6. **No animation libraries.** GSAP, Framer Motion, Anime.js — out. CSS keyframes and SVG SMIL only.
7. **No icon libraries.** No Lucide, Heroicons, Feather. Inline SVG, hand-tuned to the icon system below.
8. **No CDN font services other than Google Fonts.** The project already loads Instrument Serif + IBM Plex Sans + IBM Plex Mono via `fonts.googleapis.com` — extend if needed, do not swap.
9. **No new build steps.** No webpack, vite, esbuild, postcss, sass. Plain `.html` / `.css` / `.js` served by FastAPI's StaticFiles.
10. **No new Python dependencies.** Frontend redesigns must not touch `pyproject.toml`.

If a task seems to require any of the above, stop and ask. There is almost always a way without them.

---

## 3. Design direction

**Refined editorial minimalism.** Think: `arxiv.org` meets `linear.app` docs meets a scientific journal margin. The audience is researchers and reviewers — restraint, precision, and typographic care signal credibility.

Concrete aesthetic anchors:
- **Warm paper background** (`--paper: #fbfaf6`) for ambient surfaces (sidebar, chat shell).
- **Pure white surface** (`--surface: #ffffff`) for foreground panels.
- **Deep ink type** (`--ink-strong: #11131a`) — almost-black, slightly cool.
- **Hairline rules** (`--rule: #e6e3da`) — 1px borders that feel like ruler lines on a manuscript page.
- **Single accent** — signal blue (`--accent: #1b4ed8`) for active interactive surfaces and live-state callouts. Use sparingly.
- **Distinctive typography** — Instrument Serif (display + brand), IBM Plex Sans (body + UI), IBM Plex Mono (metadata + code + tags).
- **Small-caps section labels** in mono with wide letter-spacing — used as the "voice" between sections.

**What this aesthetic is not:**
- Not Material/shadcn purple-on-white. Not Tailwind's gray-50 to gray-900.
- Not flat-pastel SaaS. Not glassmorphism. Not heavy shadows or neon.
- Not maximalist — every decoration must earn its place.

If something looks generic or AI-templated, it's wrong.

---

## 4. Typography

**Weights to actually load:** Instrument Serif 400 + 400 italic, IBM Plex Sans 400/500/600/700, IBM Plex Mono 400/500. They're already in the `<link>` tag — do not change the URL.

**CSS variables already in `:root`:**
```css
--serif: "Instrument Serif", "Times New Roman", Georgia, serif;
--mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;
/* body default is IBM Plex Sans via the html/body rule */
```

**Type roles:**

| Use | Family | Size | Weight | Letter-spacing | Notes |
|---|---|---|---|---|---|
| Brand wordmark | Instrument Serif | 30px | 400 | -0.012em | Sidebar header only. |
| Page H1 (chat, audit) | Instrument Serif | 24–34px | 400 | -0.012em | Italic for subhead emphasis. |
| Page subtitle | IBM Plex Sans | 17px | 400 | 0 | Color: `--muted`. |
| Section H2 (panel header) | IBM Plex Sans | 18px | 600 | 0 | Inside `.panel`. |
| Body | IBM Plex Sans | 14–15px | 400 | -0.005em | Color: `--ink-strong`. |
| UI control label | IBM Plex Sans | 13.5–14px | 500 | -0.005em | Buttons, nav items. |
| Section label (small caps) | IBM Plex Mono | 10px | 500 | 0.18em uppercase | Color: `--ink-mute`. Class: `.nav-label`. |
| Metadata (timestamp, ID) | IBM Plex Mono | 10.5–12.5px | 400 | 0.04–0.12em | Color: `--ink-mute`. |
| Code / file path | IBM Plex Mono | 12.5–13px | 400 | 0 | Color: `--ink-soft` or `#42516b`. |
| Stat value (big) | IBM Plex Sans | 30–66px | 400–700 | -0.02em | Score and metric counts. |

**Italics**: Use Instrument Serif italic only as an accent — taglines, pull quotes, and the brand tagline. Never for body copy.

**Don't use serif for body, ever.** Don't use mono for body, ever. The rhythm of the dashboard depends on these stays.

---

## 5. Color palette

The full palette already lives in `:root`. **Use these variables. Do not introduce raw hex values in new components.**

### Editorial layer (sidebar, chat, future pages)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#fbfaf6` | Warm cream background (sidebar, chat shell). |
| `--surface` | `#ffffff` | Foreground panel surface. |
| `--ink-strong` | `#11131a` | Headings, primary text, dark UI elements. |
| `--ink-soft` | `#3d414c` | Body text. |
| `--ink-mute` | `#7b7e88` | Muted text (metadata, hints). |
| `--rule` | `#e6e3da` | 1px hairline borders + dividers. |
| `--rule-soft` | `#efece4` | Hover background tint. |
| `--accent` | `#1b4ed8` | Single signal blue (links, active states, live indicators). |
| `--accent-tint` | `#eef2ff` | Subtle accent background. |
| `--live` | `#0fa958` | Live/healthy status dot. |

### Legacy dashboard layer (existing audit panels)

These are **already in use** by the audit dashboard. Don't change their values — just respect them:

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#f6faff` | Page background (audit dashboard only). |
| `--surface-soft` | `#f8fbff` | Soft panel surface. |
| `--ink` | `#07132c` | Audit-page heading ink. |
| `--muted` | `#5d6f8d` | Audit-page muted text. |
| `--line` | `#dce6f3` | Audit-page hairline. |
| `--blue` | `#155eef` | Audit-page primary blue. |
| `--green` | `#12a862` | Verified state. |
| `--red` | `#ec2f2f` | Flagged / error state. |
| `--amber` | `#f59e0b` | Needs-review state. |
| `--shadow` | `0 22px 70px rgba(21, 54, 102, 0.08)` | Soft elevation. |

### Which palette do new pages use?

**New pages should use the editorial layer.** The existing audit dashboard mixes both because it predates the redesign. When in doubt, look at the chat view (`data-view="chat"`) — that's the target aesthetic.

Use semantic state colors (`--green`/`--red`/`--amber`) only for status badges, not for general UI chrome.

---

## 6. Spacing, sizing, radius

**Spacing scale** (use these — don't pick arbitrary values):
`4 · 6 · 8 · 10 · 12 · 14 · 18 · 22 · 28 · 32 · 38 · 48px`

**Border radius scale:**
- `4px` — kbd, tiny chips.
- `6px` — nav items, ghost buttons, small inputs.
- `8px` — buttons, badges (when not pill), feed entries.
- `10px` — composer textarea, chat bubble, code blocks.
- `12px` — metric cards, status panels.
- `14px` — top-level panels (`.panel`).
- `999px` — pills (status pills, live dots, tag chips).

**Panel default**: `padding: 24px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface);`. Use `class="panel"`.

**Sidebar nav items**: 34–36px min-height, 10–12px horizontal padding, 6px radius. The active state is a 2px × 18px ink rail at `left: -1px`, NOT a tinted background pill.

**Container padding** for `.dashboard-main`: `36px 38px 42px` (audit view) or `28px 32px 32px` (chat view). New views match audit view unless dense.

---

## 7. Iconography

**All icons are inline SVG. No icon-font, no `<img>` for icons, no library imports.**

**Icon spec:**
- `viewBox="0 0 16 16"` (preferred) or `0 0 12 12` for small inline marks.
- `width: 16px; height: 16px` rendered.
- `stroke="currentColor"` so they tint with parent text color.
- `stroke-width="1.5"` for line icons (the project's default).
- `stroke-linecap="round" stroke-linejoin="round"`.
- `fill="none"` for line icons; `fill="currentColor"` only for tiny solid dots.
- `aria-hidden="true" focusable="false"` on every decorative SVG.

**Existing motifs to match:**
- Pulse (live audit) — sloped polyline.
- Document — rounded rect + 3 horizontal lines.
- Mail — rect + V-shape inner flap.
- Repo — rounded rect + bottom rule + bookmark notch.
- Gear — circle + 8 spokes.
- Arrow — `→` as `M2 6h7M6 3l3 3-3 3`.
- Plus — `M8 3v10M3 8h10`.
- Send — `M2 8h11M9 4l4 4-4 4`.
- Paw — the hero brand mark (5 ellipse toes + paw pad path).

If you need an icon not in the existing set, draw a new one with the same stroke, weight, and personality. Look at `dashboard.html` lines 35–110 for working references.

**Never use emoji as UI icons.** Emoji are fine in user-generated content (chat messages) but never in chrome.

---

## 8. Component patterns

These already exist. **Reuse them by class name.** Don't reinvent.

### 8.1 Panel
```html
<article class="panel">
  <h2>Section heading</h2>
  …content…
</article>
```
White surface, 1px ruled border, 14px radius, soft shadow, 24px padding. Most page content goes inside one or more panels.

### 8.2 Sidebar (already built)
The sidebar is global — do not touch its structure. Adding a new nav item: insert a `<a class="nav-item" href="…">…</a>` (or `<button class="nav-item nav-button">…</button>` for view-switchers) after the existing item. Always include an inline SVG icon and a label `<span>`. Optionally a `<span class="nav-tail">…</span>` for a kbd hint or a live dot.

### 8.3 Section label (small caps)
```html
<span class="nav-label">SECTION NAME</span>
```
Used as a quiet eyebrow above a group of items. Mono font, 10px, 0.18em letter-spacing, uppercase, color `--ink-mute`.

### 8.4 Status pill
```html
<span class="chat-status-pill" data-state="idle">
  <span class="live-dot"></span>
  <span>Ready</span>
</span>
```
Toggle states via `data-state="idle"|"searching"|"failed"`. The `.live-dot.pulse` variant adds a breathing ring; plain `.live-dot` is static.

### 8.5 Badge
```html
<span class="badge verified">verified</span>
<span class="badge flagged">flagged</span>
<span class="badge needs_review">needs_review</span>
<span class="badge unsupported">unsupported</span>
```
Pill, semantic-state-tinted background, short text. Use these specific class names so verdicts remain consistent across pages.

### 8.6 Buttons
- Primary action: `<button class="button primary">…</button>` (rare — only one per panel).
- Default: `<button class="button">…</button>` — white surface, ruled border.
- Secondary tonal: `<button class="button secondary">…</button>`.
- Smaller: add `.small` for 14px font / 40px height.
- Ghost (no border until hover): `<button class="chat-button ghost">`.

Buttons must have a focus-visible state. Don't introduce new color variants.

### 8.7 Table
```html
<table>
  <thead><tr><th>…</th></tr></thead>
  <tbody><tr><td>…</td></tr></tbody>
</table>
```
Inside a `.panel` or `.claims-panel`. Headers are 12px ALL-CAPS muted. Rows are clickable when there's a row-detail action; hover tints with `var(--rule-soft)` or `var(--surface-soft)`.

### 8.8 Code block / evidence snippet
```html
<pre class="mono">…file content…</pre>
```
Dark navy on light cream — see `.evidence-panel pre` for the canonical inverted variant. For inline code, `<code>` (mono, faint background tint, 4px radius).

### 8.9 Composer textarea
Already styled (`.chat-composer textarea`). Reuse if you need a textarea elsewhere (e.g. settings notes field). Auto-grow logic is in `app.js` (`autosizeChatInput`).

### 8.10 Metric card
```html
<article class="metric-card verified">
  <span class="metric-icon"></span>
  <strong>5</strong>
  <p>Verified Claims</p>
</article>
```
Variants: `.verified` `.flagged` `.review` `.total`. Pre-built; just reuse.

### 8.11 File-icon block
```html
<div class="input-item">
  <span class="file-icon paper"></span>
  <div>
    <strong>Title</strong>
    <p>Subtitle</p>
  </div>
  <a class="button secondary small" href="…">Action</a>
</div>
```
For paper, repo, or any "linked external resource" entry. Variants: `.paper` `.github`.

### 8.12 Empty state
Centered prose inside the panel:
```html
<div class="chat-empty">
  <h3>Headline</h3>
  <p>One-line explanation.</p>
</div>
```
Headline in serif, 22px, 400. Body in body sans, color `--ink-mute`. Optionally a row of starter-prompt chips (see `.chat-prompts`).

---

## 9. Animation patterns

Already implemented and battle-tested. Pull from `styles.css`.

### Existing keyframes you can reference

| Keyframe | Used for | Duration |
|---|---|---|
| `@keyframes live-pulse` | Pulsing live dot rings | 1.6–2s ease-out infinite |
| `@keyframes orbit-rotate` | Slow ring rotation in chat activity | 8–30s linear infinite |
| `@keyframes orbit-glow` | Center-glow breathing | 2.4s ease-in-out infinite |
| `@keyframes orbit-pulse` | Expanding pulse rings | 2s ease-out infinite |
| `@keyframes orbit-flow` | Stroke-dashoffset arc flow | 1.4s linear infinite |
| `@keyframes node-halo` | Active-tool halo pulse | 1.4s ease-in-out infinite |
| `@keyframes center-bob` | Center node bob | 1.8s ease-in-out infinite |
| `@keyframes feed-flash` | Activity-feed entry flash-in | 1.6s ease-out once |
| `@keyframes typing-bounce` | Three-dot typing indicator | 1.1s infinite |

**Transition defaults:**
- Hover state changes: `120ms ease`.
- Color/border transitions: `240ms ease`.

**Honor reduced-motion:** the global stylesheet already has a `@media (prefers-reduced-motion: reduce)` block. New animations should auto-disable inside it (set `animation: none`). Do not add long looping animations that ignore this.

**Don't animate gratuitously.** Idle pages should be still. Animation indicates *something is happening*: a request in flight, a state transition, a fresh result landing. If an animation doesn't carry meaning, delete it.

---

## 10. Page architecture

### 10.1 Single-page dashboard

`dashboard.html` holds every authenticated view. The shell is:

```html
<body>
  <div class="dashboard-app" data-view="audit"> <!-- or "chat", "claims", … -->
    <aside class="sidebar">…</aside>
    <main class="dashboard-main">
      <div class="audit-view">…</div>           <!-- shown when data-view="audit" -->
      <section class="chat-view">…</section>    <!-- shown when data-view="chat" -->
      <!-- New views go here as siblings -->
    </main>
  </div>
  <script src="/static/app.js?v=…"></script>
</body>
```

Visibility is controlled by the existing CSS rule:
```css
.dashboard-app[data-view="audit"] .chat-view { display: none; }
.dashboard-app[data-view="chat"]  .audit-view { display: none; }
```
**To add a new view, follow the same exact pattern**:
```css
.dashboard-app[data-view="audit"]  .claims-view,
.dashboard-app[data-view="chat"]   .claims-view,
.dashboard-app[data-view="evidence"] .claims-view,
… /* hide claims-view in every state except claims */ { display: none; }
.dashboard-app[data-view="claims"] .audit-view,
.dashboard-app[data-view="claims"] .chat-view,
… { display: none; }
```
Or simpler: hide all top-level `*-view` siblings by default and show only the one matching the current `data-view`. Either approach is acceptable as long as it scales.

### 10.2 Sidebar wiring

The sidebar already lists Chat, Live audit, Claims, Evidence, AgentMail, Reports, Repositories, Settings. Today the latter six only scroll to anchors inside the audit view. Each new page agent must:
1. Convert their assigned `<a href="#…">` into a `<button class="nav-item nav-button" data-view="…">…</button>` (matching the Chat button's pattern).
2. Wire it in `app.js`: listening for clicks and calling the existing `setView(view)` (or its successor — see §10.3).
3. Update the `setSidebarActive` logic so the right item gets the rail when its view is active.

### 10.3 View switcher in `app.js`

Already exists as `setView('audit'|'chat')`. Extend it to accept the new view names. The function should:
- Set `dashboardApp.dataset.view = view`.
- Move sidebar `.active` to the matching item.
- Run a per-view "on enter" hook (e.g. fetch list, focus first input).

Keep it data-driven:
```js
const VIEWS = {
  audit:        { sidebarSelector: '.sidebar-nav a[href="/dashboard"]', onEnter: () => {} },
  chat:         { sidebarSelector: '#chat-open',                          onEnter: refreshHistory },
  claims:       { sidebarSelector: '#nav-claims',                         onEnter: loadClaims },
  // …
};
```

### 10.4 Routes

There is no client-side router. URLs stay at `/dashboard`; views are switched in JS. The landing page is at `/` and is a separate document. Don't introduce a router library.

---

## 11. File ownership rules (parallel work)

When multiple agents work in parallel on different pages, **each agent owns**:
- One new `<section class="<page>-view">…</section>` block in `dashboard.html` (or a new file in `static/pages/` if their work is large).
- A scoped CSS section in `styles.css`, prefixed with the view's class (e.g. `.claims-view .…`).
- A scoped JS section in `app.js`, with all symbols prefixed by the view name (e.g. `claimsLoad()`, `claimsRender()`, `claimsState`).

**Do not edit:**
- Other agents' view sections, CSS, or JS.
- The `.sidebar` / `.dashboard-app` / `.dashboard-main` chrome.
- The shared `:root` CSS variables — extend in your scoped block if you need a new token, prefixing with your view name (e.g. `--claims-row-active`).
- The chat or audit views.
- Anything under `apps/api/app/*.py`.

**Do edit:**
- Your assigned section.
- The sidebar nav-item that points at your view (only to convert it from anchor to button + add `data-view`).
- The `setView` switch in `app.js` to register your view.

If a change needs to span multiple agents' files, stop and flag it instead of editing across boundaries.

---

## 12. Dashboard view scaffold

Use this skeleton when adding a new view. Replace `claims` with your page name throughout.

```html
<section class="claims-view" aria-label="Claims">
  <header class="dashboard-header">
    <div>
      <h1>Claims</h1>
      <p>Every auditable claim from every audit, ranked by signal.</p>
    </div>
    <div class="header-actions">
      <span class="chat-status-pill" data-state="idle">
        <span class="live-dot"></span>
        <span>Synced 2 min ago</span>
      </span>
      <button class="button secondary">Export</button>
    </div>
  </header>

  <section class="dashboard-grid">
    <article class="panel">
      <h2>Panel A</h2>
      …
    </article>
    <div class="side-panels">
      <article class="panel">…</article>
      <article class="panel">…</article>
    </div>
  </section>
</section>
```

For dense data lists, use `<table>`. For grouped items, use `.metric-grid` or `.dashboard-grid`. For inline forms, use `.input-row` + `.input-item`.

---

## 13. Backend hooks (read-only context)

These are the existing endpoints. **You don't need to add new ones for the redesign.** Most page redesigns can show realistic mocked data while wiring is left for a later pass — but if real data is trivially available, prefer it.

| Page | Likely data source |
|---|---|
| Live audit | `GET /audits`, `GET /audits/{id}`, SSE `GET /audits/{id}/events` |
| Chat | `GET/POST /chat/conversations`, `POST /chat/conversations/{id}/messages` |
| Claims | Aggregate over `GET /audits` → flatten `audit.claims[]` |
| Evidence | Aggregate over `GET /audits` → flatten `audit.claims[].evidence[]` |
| AgentMail | No endpoint yet — show inbox UI populated from `GET /audits` (sender, thread_id, subject) |
| Reports | `GET /audits` → `audit.report_text` for each completed audit |
| Repositories | Aggregate over `GET /audits` → distinct `audit.repo_url` |
| Settings | Mostly UI-only; show `.env`-shaped config readonly + a couple toggle stubs |

If a panel needs data the API doesn't expose, render a believable empty state with a `Connect data source` CTA. Don't fabricate data into hardcoded HTML — fetch from the API and render dynamically, even if the result list is short.

---

## 14. Code conventions

### HTML
- Lowercase tags, double-quoted attributes, 2-space indent.
- Always include `aria-label` on landmarks (`<aside>`, `<section>`).
- Provide `aria-current="page"` on the active nav item.
- Decorative SVGs: `aria-hidden="true" focusable="false"`.
- Don't include inline `style="…"` unless it's a data-driven dynamic value (e.g. progress bar width).

### CSS
- New rules go in `styles.css`, scoped under your view's root class.
- Use existing CSS variables exclusively for color, type, and shadow.
- Group rules per component, not per file.
- Avoid `!important`.

### JS
- Plain ES2020+, no transpiler.
- Use `const`/`let`, never `var`.
- Always escape user-supplied strings before injecting into `innerHTML`. Use the existing `escapeHtml` / `escapeChatHtml` helpers.
- Prefer `fetch` + `await`; handle `!response.ok` explicitly.
- Don't add a global state library. View-local state is a top-level `let` inside the view's section.
- Don't write code comments that just describe what the line does. Comments are only for *why* something non-obvious is done.

### Filenames
- Existing static files only. Don't introduce new ones unless the brief asks for it.
- If you add a page-specific HTML/CSS/JS, place under `apps/api/app/static/pages/<name>.{html,css,js}`.

---

## 15. Things to avoid (the "Don't ship this" list)

- Generic gradients (especially purple-on-white).
- Glassmorphism, neumorphism, drop shadows beyond `--shadow`.
- Massive hero images or stock photography.
- Marketing-y copy ("Effortless! Powerful!"). Keep it precise and reviewer-style.
- Emoji in chrome.
- Animations that loop forever for no reason.
- Multiple competing accent colors. One signal blue is plenty.
- Redefining typography (no new fonts, no fallback to system-ui).
- Toast notifications stacked in corners.
- Nested tabs, mega-menus, hamburger menus.
- "Light mode / Dark mode" toggle. Light mode only for hackathon scope.
- Reinventing the sidebar. The sidebar is canonical.

---

## 16. Acceptance checklist

Before you submit your work for merge, verify:

- [ ] Read this guide end-to-end before writing any code.
- [ ] Inspected `dashboard.html` and `styles.css` to see the existing chat + sidebar implementation; matched its rhythm.
- [ ] All new color values use existing CSS variables.
- [ ] All new icons are inline SVG at 16×16 with 1.5px stroke.
- [ ] No new dependencies, no frameworks, no build steps.
- [ ] Every interactive element is keyboard-reachable and has a visible focus state.
- [ ] No `console.log` left behind. No unused CSS variables added.
- [ ] Empty state, loading state, and error state all visually accounted for.
- [ ] If you added a new sidebar nav-item, you also wired its view in `app.js`.
- [ ] Resync Nia (`nia.exe local sync a637b2fa-94e4-4742-a192-73a80ed15017`) after meaningful edits — see `docs/nia.md`.
- [ ] Tested by serving the dashboard at `http://localhost:8000/dashboard` and verifying the new page lives alongside the existing audit + chat views without regressing them.

---

## 17. Appendix: load-bearing snippets

The exact `<link>` block that appears in every HTML document:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
```

The brand paw mark, inline SVG (32×32 box, scales freely):

```html
<svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">
  <ellipse cx="14" cy="16" rx="5" ry="8" />
  <ellipse cx="24" cy="11" rx="5" ry="8" />
  <ellipse cx="34" cy="16" rx="5" ry="8" />
  <ellipse cx="9"  cy="27" rx="4" ry="6" />
  <ellipse cx="39" cy="27" rx="4" ry="6" />
  <path d="M13 35c0-8 5-14 11-14s11 6 11 14c0 5-4 8-11 8s-11-3-11-8Z" />
</svg>
```

The status-pill skeleton:

```html
<span class="chat-status-pill" data-state="idle">
  <span class="live-dot"></span>
  <span>Ready</span>
</span>
```

The view-switcher invocation in JS:

```js
setView('claims');  // moves sidebar active state and toggles dashboard-app data-view
```

---

**End of guide.** When in doubt, look at the chat view (`data-view="chat"`) — that's the reference implementation of every pattern in this document.

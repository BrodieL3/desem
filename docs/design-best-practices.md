# Newspaper Design Guide for Next.js + Tailwind CSS + shadcn/ui

This product should look and behave like a digital newspaper, not a generic web app.

Use this guide as the default design policy for all new UI work in this repository.

## Product lens

- Primary objective: fast editorial scanning with credible source attribution.
- Visual objective: newsroom front page + wire feed.
- Structural objective: hard-coded editorial layout slots, then fill with ranked stories.
- Anti-pattern objective: avoid "card grid SaaS" aesthetics.

## Non-negotiable visual direction

- Use horizontal and vertical rules as the main structure.
- Keep story rows open and text-first.
- Keep surfaces mostly monochrome and restrained.
- Use one accent color family for links and key highlights.
- Favor dense, readable typography over decorative chrome.

Do not:

- Build story surfaces as rounded bordered cards.
- Add unnecessary helper text under every heading.
- Use multiple colorful badges as primary hierarchy.
- Rely on shadows/elevation for structure.

## Home page blueprint (required default)

The home page should use a fixed editorial skeleton:

1. Masthead.
2. Lead story block.
3. Multi-column ruled module area (for example: Signals | World | Industry).
4. Wire section with dense, line-separated rows.

Use hard-coded slots and fill them programmatically from ranked stories.

### Slot-filling policy

- Fill slots by ranking + editorial focus bucket + topic match.
- Deduplicate by cluster key.
- Enforce source diversity within each module.
- Backfill empty slots from remaining ranked stories.
- Keep this logic in server/data layer modules, not React components.

Example approach:

```ts
const slots = [
  {id: 'lead', max: 1, focus: ['intl', 'us_company']},
  {id: 'signals', max: 6, focus: ['intl', 'security']},
  {id: 'industry', max: 6, focus: ['us_company']},
  {id: 'wire', max: 30, focus: ['*']},
]
```

## Component design rules

### 1) Masthead

- Large publication name.
- One edition/date line.
- Minimal controls.
- No marketing paragraph.

### 2) Section header

- Small-caps label + top rule.
- Short label text (1-2 words where possible).
- Avoid explanatory paragraphs by default.

### 3) Lead story

- Metadata line.
- Large headline.
- One concise dek.
- Optional single image.
- Keep source-attribution visible.

### 4) Wire story row (core pattern)

- Story rows must be separated by visible horizontal lines.
- Metadata first (`source · time`), then headline, then optional one-line dek.
- Prefer one compact summary line in wire mode.

### 5) Source references

- Prefer numbered/ruled lists.
- Keep role labels textual and subtle.
- No colorful role panels.

### 6) Topics

- Prefer inline links (`Topic A · Topic B · Topic C`) or ruled rows.
- Avoid pill-heavy tag walls unless functionally necessary.

## Typography (new default scale)

Text in this product should generally be larger than default app UI.

Recommended scale:

- Masthead title: `text-[3.2rem]` to `text-[4.6rem]`.
- Lead headline: `text-[2.4rem]` to `text-[3.4rem]`.
- Module headline: `text-[1.9rem]` to `text-[2.3rem]`.
- Wire headline: `text-[1.55rem]` to `text-[1.9rem]`.
- Body/dek: `text-[1.06rem]` to `text-[1.18rem]`.
- Metadata: `text-xs` with tighter leading and moderate contrast.

## Separation system (required)

Use line separators as primary structural affordance.

Required patterns:

- Horizontal list rules for story rows.
- Vertical rules between multi-column editorial modules.
- Section top rules to establish rhythm.

Preferred utility classes:

- `.news-divider-list`
- `.news-divider-item`
- `.news-divider-item-compact`

Add a vertical rule utility when needed:

```css
.news-column-rule {
  border-left: 1px solid color-mix(in oklch, var(--foreground), transparent 84%);
  padding-left: 1.25rem;
}
```

## Color policy

- Keep semantic tokens in `app/globals.css`.
- Keep `background/card/popover` near-neutral and close in value.
- Reserve `primary` for links and intentional emphasis.
- Keep warning/destructive/success colors for actual state signaling.
- Do not add arbitrary accent gradients to content modules.

## Microcopy policy

Copy should be sparse and editorial.

Rules:

- Prefer labels over sentences.
- Remove repeated helper text when context is obvious.
- Avoid "noisy UI words" like "additional", "loaded", "line feed", "continuous" unless necessary.
- Keep empty/error states direct and short.

## Motion and depth

- Minimize motion and animation.
- Prefer static rhythm via typography and rules.
- Avoid hover-lift effects on story surfaces.
- Keep shadows minimal and non-structural.

## shadcn/ui usage in this project

Use shadcn primitives for controls and accessibility, not visual boxing.

Prefer:

- `Button`
- `DropdownMenu`
- `Sheet` for rare auxiliary tasks
- `Separator`

Use `Card` only when truly needed for non-editorial utility surfaces (for example auth, admin utilities), and keep it borderless by default in editorial areas.

## Accessibility and interaction requirements

These remain non-negotiable:

- WCAG contrast thresholds met.
- Full keyboard operability.
- Visible focus indicators.
- Interactive targets >= 44x44 px.
- Respect `prefers-reduced-motion`.
- Semantic HTML and ARIA where needed.
- Do not communicate meaning with color alone.

## Responsive behavior

- Preserve the editorial hierarchy on mobile.
- Collapse columns into stacked sections while keeping line rhythm.
- Keep metadata readable and uncluttered.
- Avoid horizontal overflow at all breakpoints.

## Implementation conventions

- Keep layout orchestration in page-level components.
- Keep slotting/ranking logic in `lib/**`.
- Keep presentation components dumb and reusable.
- Use semantic tokens, avoid hardcoded colors.

## Shipping checklist (newspaper edition)

- Does the page read like an edition, not a dashboard?
- Are stories separated clearly by lines?
- Are vertical rules used where columns exist?
- Is typography large enough below the lead?
- Is non-essential helper copy removed?
- Is source attribution still explicit?
- Is keyboard/focus behavior preserved?
- Does mobile retain the same editorial rhythm?

---

This is a living document. Update this file when the editorial visual language evolves.

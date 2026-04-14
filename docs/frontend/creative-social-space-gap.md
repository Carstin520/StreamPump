# Creative-Social-Space Gap List

## Purpose

This document tracks the remaining gap between the current `app/` implementation and the `Creative-Social-Space` reference implementation.

It exists to keep the rebuild grounded in concrete UI differences instead of vague “make it look closer” requests.

## Reference Inputs

- Reference code:
  - [Creative-Social-Space/artifacts/streampump-web/src/index.css](/Users/jamesli/Desktop/Sol%20Projects/StreamPump/Creative-Social-Space/artifacts/streampump-web/src/index.css)
  - [Creative-Social-Space/artifacts/streampump-web/src/App.tsx](/Users/jamesli/Desktop/Sol%20Projects/StreamPump/Creative-Social-Space/artifacts/streampump-web/src/App.tsx)
  - [Creative-Social-Space/artifacts/streampump-web/src/pages/post.tsx](/Users/jamesli/Desktop/Sol%20Projects/StreamPump/Creative-Social-Space/artifacts/streampump-web/src/pages/post.tsx)
  - [Creative-Social-Space/artifacts/streampump-web/src/pages/video.tsx](/Users/jamesli/Desktop/Sol%20Projects/StreamPump/Creative-Social-Space/artifacts/streampump-web/src/pages/video.tsx)
- Runtime screenshots supplied by the user from Replit.

## Global Gaps

### 1. Theme tokens

Current gaps:
- Current app still uses a partially custom deep-blue shell, but token names and glass recipes are not fully aligned with the reference.
- Current font stack still leans on `Space Grotesk`, while the reference uses `DM Sans + Inter`.
- Some cards still show stronger borders than the reference.

Target:
- Make the app dark-mode-first with the same structural palette:
  - deep navy background
  - charcoal cards
  - orange-red primary
  - low-contrast borders
- Reuse the reference glass primitives as first-class classes.

### 2. Shell structure

Current gaps:
- Sidebar and header are directionally correct, but spacing, border contrast, and CTA treatment still drift from the reference.
- User surface and workspace now share a system, but the user shell still does not feel close enough to the reference runtime.

Target:
- Sidebar: tighter, lower-contrast, logo + nav + profile stack
- Header: centered search emphasis, low-noise top bar, strong primary CTA

## Explore Gaps

Current gaps:
- Cards are still too data-heavy for a content-first feed.
- Footer density is higher than the reference.
- Some overlays read like product cards instead of consumption cards.

Target:
- Make cards image-first
- Keep title + creator + like count visible
- Keep creator stage visible, but weakly expressed
- Remove exposed metric grid from the feed card body

## Post Detail Gaps

Current gaps:
- Current layout is structurally close, but the right rail still feels more like a product panel than the reference social detail panel.
- Top controls and image controls are not yet close enough to the reference modal.

Target:
- Left: dominant media stage
- Right: dense but calm comment panel
- Controls:
  - floating close/back
  - count chip
  - softer image switch affordances
- Bottom interaction row should feel native to the panel, not appended

## Video Detail Gaps

Current gaps:
- Current video page already has immersive structure, but it still diverges in:
  - top control composition
  - panel density
  - action rail treatment
  - information hierarchy

Target:
- Preserve immersive black media stage
- Make right panel closer to reference:
  - info/comments tabs
  - creator block
  - metric row
  - series list
  - related videos

## Creator Detail Gaps

Current gaps:
- Centered profile structure is present, but lower sections still feel more “custom business layer” than “reference shell adapted to StreamPump”.

Target:
- Keep centered profile hero
- Keep investment profile
- Reduce visual drift between creator page and the rest of the user surface

## Implementation Order

1. Global theme token alignment
2. Sidebar + header alignment
3. Explore feed card simplification
4. Post detail alignment
5. Video detail alignment
6. Creator detail refinement
7. Remaining workspace consistency and cleanup

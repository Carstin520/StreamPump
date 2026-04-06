# Creative-Social-Space Design Reconstruction

## Purpose
This document is the implementation guide for rebuilding the StreamPump web frontend around the `Creative-Social-Space` reference design.

It is not a generic design brief. It records the exact structure, visual language, interaction model, and page hierarchy that should be reproduced in this repo, then adapted to StreamPump's S1 / S1 Buyout / S2 product model.

## Core Direction
The reference design has four defining characteristics:

1. Social product first
   - The product should read like a content platform before it reads like a market terminal.
   - Posts, creators, profiles, comments, and browsing rhythm are the primary experience.

2. Dark premium shell
   - Fixed left sidebar
   - Sticky top header
   - Editorial black / charcoal base
   - Soft-glass surfaces, not harsh white bordered cards

3. Modal and immersive detail views
   - Image post detail is a large media stage plus a right-side comment panel
   - Video detail is a full-screen immersive surface with floating controls and comments
   - The detail surfaces should feel like consumption environments, not dashboards

4. Glass-based UI language
   - Frosted surfaces
   - Soft inner highlights
   - Low-contrast borders
   - Subtle glow, not noisy neon overload

## Information Architecture
The reference design organizes the main web surface into:

- `Explore`
- `Trending`
- `Portfolio`
- `Me`
- modal or immersive detail layers for posts and videos

For StreamPump, this maps to:

- `Explore`
  - user-facing content discovery
- `Trending`
  - creator market discovery
- `Portfolio`
  - S1 exposure and pending actions
- `Me`
  - Xiaohongshu-style personal profile
- `Creator Detail`
  - centered profile plus investment profile
- `Post Detail`
  - image detail with right comment panel
- `Video Detail`
  - immersive full-screen video detail
- `Workspace`
  - separate operational surface, not visually merged into user discovery pages

## Layout System

### 1. Global shell
Target behavior from the reference:

- Left fixed sidebar
- Main content shifted right
- Sticky top header
- Pages use scroll inside the content area, not full-window visual resets

Target design rules:

- Sidebar width is compact on smaller layouts and wider on desktop
- Header contains:
  - search
  - primary CTA
  - current-user access
- Sidebar contains:
  - logo
  - primary navigation
  - profile entry at the bottom

### 2. Surface separation
There are two visual layers in the product:

- `User surface`
  - Explore
  - Trending
  - Portfolio
  - Me
  - Creator Detail
  - Post / Video Detail
- `Workspace surface`
  - content manifest pages
  - launch intent pages
  - campaign / operational pages

These two surfaces should share branding and tokens, but they should not be forced into the exact same density. User surface is more editorial. Workspace is more structured.

## Page-by-Page Target

### Explore
Reference behavior:
- Masonry feed
- Lightweight category bar
- Hot status bar
- Glass cards with image-first hierarchy

Reconstruction rules:
- Cards should be image-first
- Metadata should be reduced
- Stage information should be visible but weakly expressed
- Avoid turning cards into dense metrics panels
- Card density should stay lower than the earlier StreamPump mock

Keep:
- category chips
- hot status row
- post cover
- creator avatar / name
- likes

Reduce:
- too many visible metrics
- thick borders
- heavy panel framing

### Trending
Reference behavior:
- clean creator grid
- simple hero line
- creator card with banner, avatar, status, short metrics

StreamPump adaptation:
- cards must express `S1`, `S1 Buyout`, `S2`
- cards should still feel like creator cards first
- investment information should be compact and legible

### Portfolio
Reference behavior:
- KPI row
- holdings list
- pending action stack
- tabs for Portfolio / Claim queue / Re-entry

StreamPump adaptation:
- keep this as the S1 holdings bridge
- emphasize:
  - active holdings
  - exposure value
  - waiting actions
- right rail should surface buyout claim and S2 re-entry context

### Me
Reference behavior:
- centered profile
- banner
- avatar
- stats
- action buttons
- tabs: notes / saved / liked
- masonry grid below

StreamPump adaptation:
- this should behave like a real social profile page
- no protocol language here
- notes / saved / liked should feel like Xiaohongshu profile browsing

### Creator Detail
Reference behavior:
- centered identity block
- stat row
- follow / message buttons
- investment profile card
- tabbed lower section

StreamPump adaptation:
- centered identity stays
- investment profile is required
- lower panels must change by stage:
  - `S1_DISCOVERY`
    - growth curve
    - graduation progress
    - holder visibility
    - potential sponsors
  - `S1_BUYOUT`
    - distributable amount
    - buyout status
    - settlement timeline
  - `S2_ACTIVE`
    - activity score
    - valuation
    - campaign readiness
    - content pool

### Post Detail
Reference behavior:
- modal-like or isolated detail surface
- back button floating over the stage
- image carousel
- count chip
- right comment panel

Reconstruction rules:
- image panel should be dominant
- comments remain fully usable
- author / follow / title / body / tags / comments / bottom actions all live on the right

### Video Detail
Reference behavior:
- full-screen black immersive stage
- up / down navigation
- right action rail
- comment drawer on smaller screens

Reconstruction rules:
- keep immersive black stage
- maintain creator identity and title overlay
- comments should never feel like a separate admin panel

## Visual Language

### Color
Target palette:
- dark navy-black base
- cool blue accents
- selective pink / teal highlights
- low-contrast separators

Avoid:
- bright white borders around everything
- flat slate dashboard appearance
- strong purple bias

### Glass treatment
Reference uses four recurring treatment types:

1. `glass-card`
   - content cards
2. `glass-card-footer`
   - text footer over image cards
3. `liquid-glass-pill`
   - category chips, stage chips, small badges
4. `liquid-glass-surface`
   - panels, modal shells, large surfaces

Reconstruction rules:
- borders should be faint
- highlights should come from inner sheen, blur, and shadow
- cards should feel soft-edged and slightly lifted

### Typography
Reference hierarchy:
- strong bold display headings
- smaller muted metadata
- compact card titles

StreamPump rules:
- user surface uses more editorial type hierarchy
- workspace can keep more structured text blocks

## Interaction Patterns

### Posts
- click card -> open detail
- image post:
  - next/prev image
  - dots
  - count chip
- video post:
  - immersive viewing
  - toggle comments
  - up/down progression

### Tabs
Reference consistently uses animated underlines and simple state changes.

Apply to:
- Me
- Portfolio
- Creator Detail

### Navigation
Reference is route-based, but image post detail is also layered like a modal.

In Next.js adaptation:
- route-based pages are acceptable for now
- later upgrade path:
  - modal detail for image posts
  - dedicated immersive route for video posts

## Data Mapping from Reference to StreamPump

### Reference
- `creators`
- `posts`
- `portfolio`
- `comments`
- `currentUser`
- `myPosts`

### StreamPump adaptation
- `CreatorMarketRecord`
- `PostRecord`
- `PortfolioHoldingRecord`
- `PortfolioActionRecord`
- `CommentRecord`
- `currentUser`
- `currentUserNotes`
- `currentUserSavedPosts`
- `currentUserLikedPosts`

## Implementation Phases

### Phase 1: Shell + User Surface Stabilization
Goal:
- lock the visual direction
- unify Explore / Trending / Portfolio / Me
- remove leftover mixed-design artifacts

Includes:
- sidebar
- topbar
- explore cards
- me page
- portfolio page
- route consistency

### Phase 2: Detail Surface Fidelity
Goal:
- fully align post / video / creator detail with reference behavior

Includes:
- modal-grade image detail
- immersive video detail
- creator centered profile fidelity
- comment interaction polish

### Phase 3: Workspace Re-skin
Goal:
- bring workspace into the same product family without over-socializing it

Includes:
- replace old `AppShell` visual leftovers
- simplify workspace pages
- reduce old panel-heavy styling

## Cleanup Rules
When rebuilding toward this reference:

1. Delete dead transitional components as soon as they become unused
2. Do not keep two parallel visual systems for the same surface
3. Do not keep query-based explore/trending mode switches if routes already replaced them
4. Keep aliases only when they are useful user-facing routes
5. Remove backup or preview-specific junk from the repo after use

## Current Source of Truth
The following reference files define the target system:

- `Creative-Social-Space/artifacts/streampump-web/src/App.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/components/layout/Layout.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/components/layout/Header.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/components/layout/Sidebar.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/pages/explore.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/pages/trending.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/pages/portfolio.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/pages/me.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/pages/creator.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/pages/post.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/pages/video.tsx`
- `Creative-Social-Space/artifacts/streampump-web/src/index.css`

This document should be updated whenever a reproduction decision intentionally diverges from that reference.

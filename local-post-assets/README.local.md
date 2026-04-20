# Local Post Assets

Use it to store post production materials for local import, review, and curation:

- per-post images
- per-post videos
- theme or concept notes
- final body copy
- comment drafts or collected comment references

## Structure

- `posts/`
  - one folder per post
  - recommended slug format: `YYYY-MM-DD-post-slug`
  - video posts should use:
    - `videos/main.mp4` for the source video
    - `images/cover.jpg` for the generated or curated poster frame

## Cover Generation

Generate poster frames for local video posts:

- all video posts:
  - `npm run cover:videos`
- one post only:
  - `npm run cover:videos -- --post 2026-04-17-orange-cat-under-table-watch-mode`
- overwrite an existing cover:
  - `npm run cover:videos -- --post 2026-04-17-orange-cat-under-table-watch-mode --overwrite`

The script uses macOS native video tooling through Swift and AVFoundation.
It samples frames from the middle section of the video, scores them for clarity and exposure, avoids transition-like frames, and writes the best candidate to `images/cover.jpg`.

## Bulk Import

Import all local posts into backend manifests, upload images/videos to S3, and queue video ingest into Mux:

- all posts:
  - `npm --prefix backend run import:local-post-assets -- --creator-wallet <wallet>`
- one post only:
  - `npm --prefix backend run import:local-post-assets -- --creator-wallet <wallet> --post 2026-04-17-orange-cat-under-table-watch-mode`
- preview only without writing:
  - `npm --prefix backend run import:local-post-assets -- --creator-wallet <wallet> --dry-run`

## Example

- `posts/2026-04-13-luna-daily-fragments/`
  - `post.md`
  - `images/cover.png`
  - `images/01.png`
  - `images/02.png`

- `posts/2026-04-17-orange-cat-under-table-watch-mode/`
  - `post.md`
  - `images/cover.jpg`
  - `videos/main.mp4`

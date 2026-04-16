"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.avatars = exports.assetPath = void 0;
const makeAvatar = (seed, start, end) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
          <stop stop-color="${start}" />
          <stop offset="1" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="80" fill="url(#bg)" />
      <circle cx="80" cy="58" r="24" fill="rgba(255,255,255,0.2)" />
      <path d="M36 128c8-21 24-33 44-33s36 12 44 33" fill="rgba(255,255,255,0.16)" />
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="34" font-family="Inter, Arial, sans-serif" font-weight="700">${seed}</text>
    </svg>
  `)}`;
const assetPath = (slug, file) => `/local-post-assets/posts/${slug}/images/${file}`;
exports.assetPath = assetPath;
exports.avatars = {
    wanxin: makeAvatar("弯", "#5C3C4A", "#1E2737"),
    midnight: makeAvatar("深", "#29334E", "#121826"),
    dune: makeAvatar("胶", "#705949", "#191919"),
    rocket: makeAvatar("低", "#4A5C73", "#1A2231"),
    neon: makeAvatar("夜", "#5E355F", "#14233E"),
    currentUser: makeAvatar("A", "#445A87", "#1B2436"),
    aZhe: makeAvatar("阿", "#8D5C48", "#33243A"),
    latte: makeAvatar("奶", "#AA6B7F", "#46314D"),
    wind: makeAvatar("风", "#556D7C", "#27313B"),
    track: makeAvatar("赛", "#8F6F44", "#32261D"),
    calm: makeAvatar("理", "#4C596E", "#1C2430"),
    game: makeAvatar("阿", "#6C5D8F", "#25203B"),
    gpu: makeAvatar("显", "#4E728B", "#1F2E3A"),
    monkey: makeAvatar("猴", "#7B5039", "#281F20"),
    neonSea: makeAvatar("霓", "#6A4D7F", "#1C2A3F"),
    movie: makeAvatar("影", "#7D5C49", "#2C211A"),
    tech: makeAvatar("参", "#476279", "#1E2733"),
};

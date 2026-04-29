# StreamPump 前端美学提升方案

## 设计系统概述

StreamPump 前端采用 **Dark Glassmorphism** (深色玻璃拟态) 设计语言，灵感来自 Apple 的 Liquid Glass 风格：
- 深色空间感背景（多层径向渐变）
- 毛玻璃卡片（backdrop-blur + 半透明填充 + 内发光高光 + 柔和边框）
- 圆角系统（统一 1.75rem / 28px 体系）
- 品牌色：暖红 `#de402a` 用于主要 CTA
- 字体：DM Sans，标题大号粗体 + 负字间距

---

## 已完成的基础修复

| 修复项 | 涉及组件 | 说明 |
|--------|---------|------|
| 文字溢出 | TrendingCreatorCard | 创作者名称、handle、niche pill 添加 truncate |
| 文字溢出 | CommentPanel | 标题添加 line-clamp-3 |
| 文字溢出 | ActivitySurface | 动态标题 line-clamp-2，正文 line-clamp-4 |
| 文字溢出 | ProfileSurface | Hero 名称/handle/bio 添加 truncate 和 line-clamp |
| 文字溢出 | CreatorStageView | 名称 truncate，intro line-clamp-3 |
| 文字溢出 | PortfolioSections | 持仓行创作者名称/thesis truncate |
| 文字溢出 | UserTopbar | handle 添加 max-w + truncate |
| Tailwind 配置 | tailwind.config.js | 修正 content 路径，覆盖所有 components 子目录 |
| 字体加载 | _document.tsx | 新建文件，通过 Google Fonts 加载 DM Sans |
| 背景动画 | globals.css | 添加 feed-backdrop-* 缺失的 CSS 类定义和漂移动画 |

---

## 美学提升计划

### 1. 渐变边缘柔化（消除生硬裁剪）

**问题：** 多处图片/区域的裁剪边缘过于生硬，缺少渐变过渡。

| 位置 | 现状 | 改进 |
|------|------|------|
| PostCard 底部覆盖 | 已有 linear-gradient 遮罩 | 增强过渡层次，添加中段 via 色阶 |
| TrendingCreatorCard 顶部英雄区 | 单层 `from-[#121826]` 渐变 | 增加更柔和的多段渐变 |
| ActivitySurface 封面图 | 渐变仅从底部 | 添加轻微四角暗角效果 |
| CreatorStageView 横幅 | 三段渐变但中段过渡突兀 | 柔化中段数值 |
| ProfileSurface 横幅 | 复杂多段渐变 | 添加底部边缘弥散光晕 |

### 2. 深色遮罩覆盖修复

**问题：** 部分页面背景颜色不一致，深色遮罩无法完全覆盖。

| 位置 | 现状色值 | 统一目标 |
|------|---------|---------|
| UserShell 主背景 | `#090d14` | 保持（基准色） |
| login.tsx | `#080c14` | 统一为 `#090d14` |
| posts/[postId] 加载态 | `#05080d` | 统一为 `#090d14` |
| PostDetailExperience 模态背景 | `#05080d/54` | 调整为 `#090d14/60` |

### 3. 卡片高光与内发光增强

**目标：** 让 Liquid Glass 效果更精致。

- 在 `.liquid-glass-shell` 的 `::before` 伪元素中添加更细腻的高光线条
- 为 `.glass-card` 添加轻微的悬停内发光呼吸效果
- 统一所有卡片的 inset shadow 强度梯度

### 4. Tab 指示器风格统一

**问题：** 不同页面的 tab 激活指示器颜色不一致。

| 页面 | 当前颜色 | 统一方案 |
|------|---------|---------|
| ProfileSurface TabBar | `#de402a`（红色） | 保持品牌红 |
| PortfolioSections TabBar | `#de402a`（红色） | 保持品牌红 |
| CreatorStageView Tabs | 白色 `bg-white` | 统一为品牌红 `#de402a` |

### 5. 色彩层次增强

- 统一 muted text 色阶：目前有 `#8ea0ba` / `#8da0bb` / `#92a3bc` / `#93a4bc` / `#8fa1bd` 等微妙差异，统一为 `#8ea0ba` 和 `#7486a1` 两个层级
- 增加卡片之间的微妙层次差异，让嵌套更可读

### 6. 边框光晕效果

- 为 hero 级别的卡片添加微妙的顶部弧形光晕
- 在 Discover 主英雄区添加品牌色光晕呼吸效果
- Portfolio overview card 添加趋势色（绿/红）的环境光

### 7. 交互微动效增强

- 为 nav link 添加更精致的 hover 状态渐变
- 给 glass-card 的 hover lift 添加微妙阴影扩散
- 为数字变化添加 slot-reel 风格的滚动效果

---

## 实施优先级

1. **P0（必须）** - 渐变边缘柔化、深色遮罩统一、Tab 指示器统一
2. **P1（重要）** - 卡片高光增强、色彩层次统一
3. **P2（润色）** - 边框光晕、交互微动效

---

*此文档由代码审查自动生成，基于对 globals.css / 全部页面组件 / Tailwind 配置的分析。*

# StreamPump 创作中心 设计文档

## 产品定位

创作中心是 StreamPump 中创作者的核心工作台。它不是一个"上传视频"的工具，而是一个将**内容包装 → 赞助合作 → 链上结算**整条链路串联在一起的创作者操作面板。

区别于现有的 `/workspace`（开发者导向的 manifest/intent 管理），创作中心面向普通创作者，提供视觉化、直觉化的操作体验。

---

## 设计原则

1. **创作者为中心** — 界面语言是"我的作品"、"我的合作"，而不是"manifest"、"proposal intent"
2. **渐进式复杂度** — 首次进入只看到简洁的创作入口，深度功能逐层展开
3. **保持视觉一致** — 延续 Liquid Glass 设计系统，使用 `liquid-glass-shell`、`glass-card`、品牌红 CTA
4. **小红书式内容包装** — 支持图文笔记、视频、混合媒体三种格式
5. **链上感知但不链上焦虑** — 链上状态清晰可见，但不需要用户理解 Anchor 细节

---

## 页面结构

### 入口
- 顶部导航栏 `UserTopbar` 中的 `+ 创作中心` 按钮（已存在）
- 侧边栏导航可添加创作中心入口
- 路径: `/workspace`（复用现有路由，但升级为创作者友好界面）

### 整体布局

```
┌──────────────────────────────────────────────────┐
│ PageShell (创作中心 header + tabs)               │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────────┐ ┌────────────────────┐  │
│  │ 左栏：草稿列表 / 创建 │ │ 右栏：数据概览     │  │
│  │                     │ │ + 合作动态          │  │
│  │ [新建内容] CTA      │ │                    │  │
│  │                     │ │                    │  │
│  │ 草稿卡片 x N        │ │ 创作数据仪表盘      │  │
│  │ - 封面缩略图        │ │ - 总浏览 / 互动     │  │
│  │ - 标题 / 类型       │ │ - 活跃合作数        │  │
│  │ - 状态标签          │ │ - SPUMP 收入        │  │
│  │ - 最后编辑时间      │ │                    │  │
│  │                     │ │ 待处理合作          │  │
│  │                     │ │ - 赞助商提案通知     │  │
│  │                     │ │ - 需要签名的操作     │  │
│  └─────────────────────┘ └────────────────────┘  │
│                                                  │
│  [创建新内容] → 展开 Composer 面板               │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Tab 结构

| Tab | 功能 |
|-----|------|
| 我的创作 | 草稿列表、已发布内容管理 |
| 合作管理 | 赞助提案、campaign 进度跟踪 |
| 新建内容 | 内容 Composer（创建新内容的核心入口） |

---

## 核心组件

### 1. CreationDashboard（创作仪表盘）

位于右侧，展示创作者的核心数据：
- **创作统计**: 总浏览、总互动、粉丝增长
- **SPUMP 收益**: 历史 SPUMP 收入趋势
- **活跃合作**: 当前进行中的 campaign 数量
- **待处理通知**: 需要签名或回复的合作提案

视觉风格：使用 `liquid-glass-shell` 卡片，数据用大号 semibold 字体，搭配 `SparklineChart` 趋势线。

### 2. DraftGrid（草稿网格）

展示创作者的所有草稿和已发布内容：

每个卡片包含：
- 封面缩略图（`ProgressiveImage`）
- 内容类型标签（视频 / 图文 / 混合）
- 状态标签（草稿 / 审核中 / 已发布 / 已锚定）
- 标题（`line-clamp-2`）
- 最后编辑时间
- 互动数据（已发布时显示）

视觉风格：`glass-card` + `glass-card-footer`，类似 ProfileNoteGrid 但增加状态层。

### 3. ContentComposer（内容编辑器）

创建新内容的核心面板，分为三个步骤：

#### Step 1: 选择内容类型
三个可选卡片：
- **图文笔记** (IMAGE_CAROUSEL) — 适合分享产品体验、日常穿搭、美食推荐
- **短视频** (SHORT_VIDEO) — 适合 vlog、教程、开箱
- **混合媒体** (MIXED_MEDIA_NOTE) — 图文 + 视频的组合形式

#### Step 2: 内容编辑
- 封面上传区（拖拽或点击，`aspect-[4/5]` 预览）
- 标题输入（`input-glass` 样式）
- 正文编辑（`textarea`，支持 `whitespace-pre-wrap`）
- 标签输入（pill 样式的 tag chips）
- 媒体上传区（支持多图/视频，网格预览）

#### Step 3: 发布设置
- 可见性选择（公开 / 仅粉丝 / 私密）
- 赞助合作开关（是否开放赞助商匹配）
- 预览效果（模拟 PostCard 样式的预览）
- 发布 / 保存草稿按钮

### 4. CollaborationPanel（合作管理面板）

展示赞助提案和 campaign 进度：

每个合作卡片包含：
- 赞助商信息（头像、名称）
- 提案状态（与 ProposalIntentStatus 对应的中文标签）
- 预算概览（Track 1/2/3 分布）
- 操作按钮（查看详情 / 接受 / 拒绝 / 签名）

状态流转的视觉映射：
- DRAFT → 灰色 liquid-pill
- TERMS_LOCKED → 蓝色 liquid-pill
- BUNDLE_BUILT → 琥珀色 liquid-pill
- CREATOR_PARTIALLY_SIGNED → 绿色 liquid-pill + 脉冲指示器
- CONFIRMED → 品牌红实心 pill

---

## 视觉规范

### 色彩

| 元素 | 色值 | 用途 |
|------|------|------|
| 主背景 | `#090d14` | 页面基底 |
| 卡片背景 | `liquid-glass-shell` / `glass-card` | 所有内容容器 |
| 主 CTA | `#de402a` 渐变 | 发布、创建按钮 |
| 次 CTA | `glass-button-ghost` | 保存草稿、取消 |
| 状态-草稿 | `#7486a1` | 灰调 |
| 状态-上传中 | `#67b8ff` | 蓝色 |
| 状态-已发布 | `#65ecaf` | 绿色 |
| 状态-需操作 | `#f3b33e` | 琥珀色 |

### 字体

- 页面标题: `text-[38px] md:text-[46px] font-semibold tracking-[-0.06em]`
- 卡片标题: `text-[18px] font-medium leading-8`
- 标签: `text-[11px] uppercase tracking-[0.18em]`
- 正文: `text-sm leading-7`

### 间距 & 圆角

- 卡片圆角: `var(--radius-card)` = 1.75rem
- 内边距: `p-5` (标准) / `p-6 md:p-8` (hero 级)
- 卡片间距: `gap-4` (紧凑) / `gap-6` (标准)

### 动效

- 页面进入: `section-enter` 动画
- 卡片进入: 瀑布流延迟 `animation-delay`
- 状态切换: `content-slide-up` / `content-slide-down`
- 按钮反馈: `tap-bounce-active`
- 上传进度: 自定义进度条 + `#de402a` 填充

---

## 数据映射

| UI 概念 | 后端模型 | 说明 |
|---------|---------|------|
| 草稿 | ContentManifest (DRAFT) | 用户创建的内容包 |
| 已发布 | ContentManifest (PUBLISHED) | 已发布到链上的内容 |
| 赞助提案 | ProposalIntent | 赞助商发起的合作意向 |
| 进行中合作 | ProposalIntent (CONFIRMED+) | 已确认的 campaign |
| SPUMP 收益 | endorsement claims | 支持者分配的 SPUMP |

---

## 实施策略

由于当前仍处于 mock data 阶段，创作中心将：
1. 使用 mock 数据驱动 UI 展示
2. 保留与现有 workspace API 的兼容性
3. 在视觉上达到产品级别的交付水准
4. 为后续真实数据接入预留清晰的接口边界

---

*此文档基于 StreamPump README、后端数据模型、现有 workspace 页面、以及整体设计系统分析生成。*

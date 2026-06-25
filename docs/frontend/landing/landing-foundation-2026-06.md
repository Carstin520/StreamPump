# 前端落地地基与契约 — Prototype → React (2026-06-24)

> 把 `docs/frontend/prototypes/*.html` 的四套交互原型落地成真实 React 组件的**单一契约**。所有实现（含 sonnet 子代理）以本文为准。
> 分支：`codex/post-deadline-phase-0`。结合 design:design-system / design:ux-copy / design:design-handoff。

## 0. 策略与红线

- **扩展不重写**：现有设计系统已成熟（tokens、`.tone-*`、`.type-*`、`StagePill`、`PriceHistoryChart`/`SparklineChart`、`ProductReadinessBanner`）。落地 = 复用 + 重构 + 文案对齐，禁止平行造第二套。
- **渐进接入现有路由**，不破坏已验证生产走廊（authed creator → media → feed/post → proposal → campaign proof）。
- **不改财务/链上语义**：S1 市场是真实绑定曲线（以 SPUMP 计价），不抹掉机制；只重构**表达**与**文案**。
- 保留全部 `ProductReadinessBanner` 与 readiness 标签；不把 seeded/mock 当 production。
- 验证：本地仅 `npx tsc --noEmit -p app/tsconfig.json`；全量 build + 浏览器 smoke 交用户。严格 TS、`{ok,data}` envelope、Tailwind CSS-var 不配 `/opacity`（用 `.tone-*` 或 `color-mix`/token）、wallet provider 按页 opt-in、路由用 `lib/routes.ts` 常量。

## 1. 关键架构决策（我定，可推翻）

**D1 · 应援卡 vs 真实市场页分层。** 内容详情右栏/发现榜卡片用**简化能量入口**（势能 + 冲刺毕业 + ⚡Back，点击跳 `/market/:creatorId`），不展示每单位价格；`/market/:creatorId` 保留**真实买卖**（绑定曲线、SPUMP 计价、`useS1TransactionFlow`），但文案改能量框架。两者共用 `BackingCard` 的"展示态"，市场页是其"交易态"。

**D2 · 势能 = 0–100 信号，不是价格。** 详情/市场/数据页的"价格曲线"复用 `PriceHistoryChart`，但：去掉 `$`/货币、改绿色（`--accent-green`/`--state-success`）、标注"势能 · 发现信号，不是价格 / momentum, not price"。真实 S1 单价仅在 `/market` 交易区以 `⚡/S1` 出现，标签"当前应援价"而非"价格"。

**D3 · 收购→毕业赞助。** `stage.S1_BUYOUT`、`nav.buyout`、`WorkspaceShell.STAGE_LABELS`、`buyout/*` 文案统一为"毕业赞助/助力毕业"，机制不变（rage-quit 窗口、创作者拿大头、backer 封顶非比例发现奖励）。

**D4 · Pro 数据看板为 SaaS（与 SPUMP 经济独立）。** 四档定价（Free/Starter $9/Growth $25⭐/Studio $49 + 年付 + 限时6折）按 `docs/frontend/pro-pricing-2026-06.md`（见 §4）；⚡应援漏斗放 Growth 档。

## 2. design-system extend — 新增共享原语

新增组件放 `app/src/components/shared/`（通用）或 `app/src/components/backing/`（应援域）。全部用 token，不写裸 hex。

| 组件 | 文件 | Props（要点） | 复用/组合 | tokens |
|---|---|---|---|---|
| `EnergyAmount` | shared/EnergyAmount.tsx | `{amount:number; size?:'sm'\|'md'\|'lg'; muted?:boolean}` | `compactNumber` | `--brand`/`--brand-soft`（⚡） |
| `MomentumMeter` | shared/MomentumMeter.tsx | `{value:number; max?:100; tone?:'momentum'\|'graduation'; label?:string}` | 进度条 | momentum=`--brand`渐变；graduation=`--stage-s1`→`--stage-s2` |
| `MomentumLine` | shared/MomentumLine.tsx | `{points:number[]; range?; height?; caption?:string}` | 包 `PriceHistoryChart`（去币种）或 `SparklineChart` | `--accent-green` |
| `TierBadge` | shared/TierBadge.tsx | `{tier:'starter'\|'growth'\|'studio'}` | — | starter=`--stage-s1`；growth=energy gold；studio=`--accent-violet` |
| `BackingCard` | backing/BackingCard.tsx | `{creator; momentum; graduation; stage; backedAmount?; readiness; onBack; variant:'teaser'\|'full'}` | `StagePill`,`MomentumMeter`,`EnergyAmount`,readiness | stage tokens |
| `ScarcityBar` | shared/ScarcityBar.tsx | `{claimed:number; total:number; label:string; tailText?:string}` | — | `--brand` |
| `LockedPanel` | shared/LockedPanel.tsx | `{requiredTier; currentTier; children; onUnlock}` | `TierBadge` | 毛玻璃遮罩 |
| `EventCard` | user/activity/EventCard.tsx | `{event:ActivityEvent}`（type/rel/...） | `StagePill`,`MomentumMeter` | major 事件 stage 色左条 |
| `PricingModal` + `PlanCard` | workspace/pricing/* | `{billing; promo; currentTier; onChoose}` | `TierBadge`,`ScarcityBar` | — |

**token 增补（additive，写进 globals.css :root）**：
- `--energy: var(--brand); --energy-soft: var(--brand-soft);`（⚡ 能量语义别名，未来可与品牌分离）
- `--tier-starter: var(--stage-s1); --tier-growth: #f0a070; --tier-studio: var(--accent-violet);`
- `--momentum-line: var(--accent-green);`

无需新增 `.tone-*`；tier 徽章用上面 token 内联 `color-mix`。

## 3. ux-copy canon — 文案对齐

### 3a. ZH i18n 修正（EN 已重构，ZH 滞后；对齐能量模型）

| key | 现 ZH | 改为 ZH | EN（保持） |
|---|---|---|---|
| `portfolio.pnL` | 盈亏 | 势能变化 | Signal delta |
| `portfolio.price` | 价格 | 支持率 | Support rate |
| `portfolio.claimPrice` | 领取价格 | 奖励模型 | Reward model |
| `portfolio.holding` | 持仓 | 应援 | Holding |
| `portfolio.s1Holdings` | S1 持仓 | S1 应援 | S1 Holdings |
| `portfolio.activeHoldings` | 活跃持仓 | 进行中的应援 | Active Backing |
| `portfolio.avgEntry` | 平均买入 | 投入能量 | SPUMP used |
| `portfolio.costBasis` | 成本基础 | 投入成本（能量） | Cost basis |
| `portfolio.exposureValue` | 风险敞口价值 | 支持快照 | Support Snapshot |
| `portfolio.totalPortfolioValue` | 支持组合概览 | 支持组合概览 | Total Support Snapshot |
| `common.currentPrice` | 当前价格 | 当前应援价 | Current support rate |
| `feed.trending.price` | 价格 | 应援价 | Support rate |

### 3b. 硬编码 JSX 字符串重写（来自集成图，按 file:line）

- `market/[creatorId].tsx` L76/L366 `Current price`→`当前应援价 / Current support rate`；L81/L367 `Next price`→`下一档 / Next rate`（值仍 `formatSpump`，单位 `⚡/S1`）。
- `CreatorStageView.tsx` L532 `Avg price`→`平均投入`；L540 `Price after buy`→`投入后档位`；L597 `Buyout Live · Buy Locked`→`毕业赞助进行中 · 应援暂停`；L622 readiness 说明保留含义、改"S1 势能/供应/holders"措辞。
- `TrendingTabs.tsx` L221 `Price` 列→`应援价 / Support rate`；`tokenPrice` 显示加 `⚡` 语义，去 `formatUsd`→`formatSpump`。
- `buyout/[creatorId].tsx` L488 `留守毕业`→`留到毕业`；其余 L491/L494 已对（封顶/非比例），仅把页面级"收购/Buyout"标题改"毕业赞助"。
- `PortfolioPreviewPanels.tsx` L104/L284 `Preview Buyout Claims`/`tokenPrice` 价格→"毕业赞助 · 可领发现奖励（封顶）"，去 `formatUsd` 当前价。

### 3c. 新增 key（能量/毕业赞助/封顶/tier/slogan/就绪）

按需新增，命名空间：`energy.*`、`backing.*`、`grad.*`（毕业赞助）、`tier.*`、`analytics.*`、`onboarding.*`。关键 canon 串（zh / en）：

- slogan 发现榜：`发现下一个值得陪跑的人` / `Spot them early. Back them with conviction, not cash.` 副：`用 ⚡ 应援，不是用钱` / `Back with energy, not cash.`
- Back CTA：`⚡ Back 应援` / `⚡ Back`；成功：`✦ 已应援！Scout 打卡 +1` / `Backed! Scout streak +1`
- 免责（应援）：`身份与声誉是主要回报。若 TA 毕业，早期应援者分享一份由赞助商出资、封顶、与投入无关的发现奖励 —— 不是收益。`
- 免责（背书）：`背书奖励封顶、平摊，与你投入多少无关。活动未达标则赞助商按规则退款 —— 这不是投资。`
- 毕业赞助：`赞助商出资助 TA 毕业、赞助接下来几期内容` / `A sponsor funds {creator}'s graduation and next episodes.`
- 防刷：`今日可投 {used} / 100 ⚡ · 上限随忠诚度增长（防刷）`
- 就绪：复用 `ProductReadinessBanner`；行内小标签 `● SEEDED · devnet · 应援为链上 SPUMP（预览）`
- onboarding 三步：攒能量 Earn / 看好就 Back / TA 毕业你留名；盾牌：`🛡️ 这不是投资，是发现。SPUMP 买不到、卖不掉、不能提现，没有币价、没有涨跌。`

**红线**：能量≠钱、势能≠价格、毕业赞助≠收购、发现奖励=封顶非比例与 stake 解耦、SPUMP 不可转让。`pitch/script.md` 的 pro-rata 与白皮书冲突，**以白皮书为准**。

## 4. 落地序列与子代理分工（sonnet 量产，opus 验收）

| 批次 | 范围 | 风险 | 执行 |
|---|---|---|---|
| B0 地基 | 新增共享原语（§2）+ token 增补 | 低（纯新增） | 子代理产出，opus 验收 tsc |
| B1 文案 | §3 i18n ZH 对齐 + 新 key + 硬编码串重写 | 低（不动结构） | 子代理，opus 审 diff + tsc |
| B2 内容面 | DiscoverSurface/PostCard/PostDetailExperience：能量角标、右栏应援卡+相关+评论、短视频货架、翻页右下 | 中 | 子代理，opus 验收 + critique |
| B3 backing | trending(发现榜)/market/buyout(毕业赞助)/campaigns(背书)/portfolio/onboarding：势能线、应援面板、赎回 keep/rage、三轨 | 高 | 分多子代理，opus 逐个验收 |
| B4 动态 | ActivitySurface → EventCard 时间线（大事件加权） | 中 | 子代理 |
| B5 工作台 | Overview 精简(唯一 NEXT)/Composer 三步/机会(毕业赞助·翻译成人话)/分析看板(单条+账号级)/四档定价弹窗 | 高 | 分多子代理 |
| B6 验收 | tsc 全绿、design-critique、accessibility 抽查、tech-debt 去重、给用户 build+smoke prompt | — | opus + design skills |

每批 DoD：`npx tsc --noEmit -p app/tsconfig.json` 通过；保留 readiness 标签；无 `$`/价格/收购/盈亏 残留（grep 校验）；不破坏现有路由。每批单独 commit（显式 `git add <path>`）。

## 5. 验收协议

1. 子代理交付后必跑 `npx tsc --noEmit -p app/tsconfig.json`，0 error 方可合。
2. grep 红线：`收购|盈亏|pro-rata|proportional` 应仅余白皮书允许的"非比例"语境。
3. design:design-critique 抽查视觉/层级；design:accessibility-review 抽查对比度/键盘。
4. 输出"全量 build + 浏览器 smoke 检查 prompt"交用户最终确认（沙箱跑不动全量 build）。

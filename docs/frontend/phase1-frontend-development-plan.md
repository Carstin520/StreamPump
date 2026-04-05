# StreamPump Frontend Phase 1 Development Plan

## 1. 文档目的

这份文档用于把 **现阶段前端需要做的事情拆成可执行开发项**。

当前结论很明确：

- 链上和 backend 已经具备 `S1 + S2` 的核心协议基础
- 当前前端仍处于 debug/scaffold 阶段
- 前端 Phase 1 不能只覆盖 S2 proposal launch，也必须把 S1 的核心交易面纳入设计
- 产品形态不是只有一个网站，还应从一开始就考虑 `Web + App` 双端

这份文档默认遵循以下原则：

- Web 端保持现有 `Next.js pages router`，Phase 1 不迁移到 App Router
- 当前 web 仍保留 `Tailwind`，但身份系统不再默认等于钱包登录
- 前端优先接入已经稳定的 backend 接口
- 不在 Phase 1 内实现 fan quest center、MCN operator dashboard、dispute center

## 2. 当前代码基础

### 2.1 已存在的前端基础

当前 `app/` 目录已有这些基础：

- `pages/_app.tsx`：已经挂了 `Web3AuthProvider + WalletContextProvider`
- `pages/index.tsx`：当前首页仍是 demo 主页
- `components/Wallet/*`：已有钱包和 Web3Auth 基础接线
- `hooks/useProgram.ts`：已有部分链上程序连接辅助

当前问题也很明确：

- `Dashboard` 仍然是调试面板，不是产品界面
- 首页仍然是单页 demo
- 缺少统一工作台导航、页面信息架构和 API 状态管理

### 2.2 已可供前端使用的 backend 能力

前端 Phase 1 可以直接依赖这些接口组：

- `POST /api/v1/auth/challenge`
- `POST /api/v1/auth/verify`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/logout`

- `POST /api/v1/content/manifests`
- `POST /api/v1/content/manifests/:manifestId/assets/presign`
- `POST /api/v1/content/manifests/:manifestId/assets/:assetId/complete`
- `POST /api/v1/content/manifests/:manifestId/finalize`
- `POST /api/v1/content/publications`

- `POST /api/v1/proposal-intents`
- `POST /api/v1/proposal-intents/:intentId/lock`
- `POST /api/v1/proposal-intents/:intentId/build-bundle`
- `POST /api/v1/proposal-intents/:intentId/creator-partial-sign`
- `POST /api/v1/proposal-intents/:intentId/submit`
- `GET /api/v1/proposal-intents/:intentId/status`

- `GET /api/v1/proposals/:id`

这意味着：

- 登录态可以做
- 内容创建与上传可以做
- proposal 发起与双签可以做
- 已确认 proposal 的详情页可以做
- S1 的前端设计可以开始，但当前更偏向 `链上直读 + indexer/event 数据`，还缺成体系的 backend read API

### 2.3 认证和账户抽象方向

现阶段文档不再假设“钱包签名登录”是默认主入口。

建议改为：

- **Primary auth**
  - `Google`
  - `Apple`
  - 可选 `email` / `phone` / `passkey`
- **Wallet UX**
  - 默认不要求用户先理解钱包
  - 登录成功后自动创建或托管一个产品内钱包
- **Advanced path**
  - 外部钱包连接和签名登录保留为高级入口，而不是唯一入口

这意味着前端需要预留两类登录模式：

1. `Social / AA login`
   - 用户先完成 OAuth 或 passkey 登录
   - 系统为其准备 embedded wallet / managed wallet
   - 前端拿到 StreamPump session 后继续业务动作

2. `External wallet login`
   - 用户主动选择 Phantom / Solflare / Backpack 等外部钱包
   - 用 challenge/signature 建立 backend session

对 backend 的影响也要提前写清楚：

- 当前已有的 `challenge/signature` 登录足够支撑外部钱包路径
- 如果要把 `Google / Apple` 做成主路径，backend 还需要增加一条 `OIDC / provider token exchange -> StreamPump session` 的认证支线
- 如果登录后自动分配 embedded wallet，前端和 backend 都要有 `user identity <-> managed wallet address` 映射

## 3. Phase 1 产品范围

### 3.1 本阶段要做什么

Phase 1 要覆盖 **S1 + S2** 两个季节，但仍然遵循同一个产品入口。

1. `S1 Discover and Market`
   - 浏览创作者
   - 查看 creator profile / creator token / bonding curve 信息
   - 买入和卖出 S1 token
   - 查看 buyout 状态和进度
   - 查看个人持仓和可领取状态

2. `S2 Content and Launch`
   - 创建内容清单
   - 上传图片/视频
   - finalize 内容
   - 创建 proposal intent
   - 锁定 terms
   - 构建 bundle
   - creator partial sign
   - sponsor final sign
   - 提交 bundle
   - 查看 launch 状态

3. `Shared Campaign Detail`
   - 查看 proposal 基础信息
   - 查看 content hash / content anchor
   - 查看 Track 1/2/3 预算结构
   - 查看 launch / settlement 状态

这里的关键产品原则是：

- **用户只有一个工作台入口**
- **发内容永远是用户主动动作，不由入口先划分角色**
- **当一个 intent 需要当前钱包执行 creator 动作或 sponsor 动作时，页面根据当前上下文显示对应操作**

### 3.2 本阶段不要做什么

以下内容只做信息架构占位，不做正式实现：

- SPUMP quest center
- fan participation center
- MCN portfolio management
- dispute / review console
- operator-only dashboards
- 完整的数据图表系统
- 多角色团队权限管理 UI

## 4. 页面信息架构

### 4.1 统一入口原则

前端不做两个不同的 creator / sponsor 门户。

统一原则是：

- 所有用户从同一个首页和登录入口进入
- 登录后进入同一个 `Workspace`
- `Workspace` 内按“我正在做什么”拆分，而不是按“我是什么角色”拆分

### 4.2 建议路由

- `/`
  - 新首页，可承接 S1 discover feed 和产品入口
- `/login`
  - 社交登录 / embedded wallet / 外部钱包入口
- `/discover`
  - S1 创作者发现页
- `/creators/[creatorId]`
  - S1 creator detail，展示 bonding curve、creator token、buyout 状态
- `/portfolio`
  - 用户的 S1 持仓和待处理状态
- `/workspace`
  - 统一工作台，展示内容、launch、待签事项
- `/workspace/content/new`
  - 创建内容清单
- `/workspace/content/[manifestId]`
  - 编辑、上传、finalize manifest
- `/workspace/intents/[intentId]`
  - proposal intent 详情页，根据当前钱包上下文显示 creator 或 sponsor 动作
- `/campaigns/[proposalId]`
  - 已确认 proposal 详情页

### 4.3 Workspace 内部信息架构

`/workspace` 建议拆成三块：

- `Create`
  - 发内容
  - 新建 manifest
  - 继续未完成内容
- `Launches`
  - 我发起的 intents
  - 我参与中的 intents
- `Needs your action`
  - 当前钱包待签名的 intent
  - 当前钱包需要确认的 launch 状态

### 4.4 S1 页面职责

`/discover` 负责：

- 创作者列表
- momentum / price / graduation 状态
- 搜索和筛选

`/creators/[creatorId]` 负责：

- creator 基础信息
- bonding curve 与 price state
- 买入/卖出入口
- buyout 进度
- creator 历史内容和进入 S2 的状态

`/portfolio` 负责：

- 我的 creator token 持仓
- 我的 buyout / claim / redemption 状态
- 我参与过的 creator 列表

### 4.5 Shared Campaign

建议路由：

- `/campaigns/[proposalId]`
  - 已确认 proposal 详情页

### 4.6 Web + App 双端原则

这个产品不应只按网站来规划。

建议从文档层就拆成：

- `Web`
  - 更适合 S2 的内容配置、proposal launch、运营态详情
- `App`
  - 更适合 S1 的发现、内容消费、轻交易、持仓查看、推送提醒

Phase 1 的正确做法不是只做 web 再“补一个 app”，而是：

- 现在就统一信息架构
- 现在就统一 auth 方案
- 现在就规划共享 API client 和 domain model

App 端建议的一级导航：

- `Feed`
  - S1 discover
- `Portfolio`
  - S1 持仓
- `Create`
  - 发内容
- `Actions`
  - 待签名、待处理 intent
- `Profile`
  - 登录态、身份、设置

## 5. 页面级开发清单

## 5.1 `/login`

### 目标

统一社交登录、账户抽象钱包和外部钱包登录入口，并建立 backend session。

### 页面模块

- `AuthHero`
- `SocialLoginCard`
- `EmbeddedWalletNotice`
- `ExternalWalletConnectCard`
- `SessionStatusCard`

### 交互

1. 用户优先选择 `Google / Apple / email / passkey`
2. 前端完成 provider 登录并换取 StreamPump session
3. 如产品采用 embedded wallet，则在首登时为用户准备产品内钱包
4. 用户进入产品，不需要先理解钱包概念
5. 外部钱包连接保留为高级入口
6. 仅当用户显式选择外部钱包路径时，才走 `/auth/challenge -> /auth/verify`

### 需要实现的前端能力

- `lib/auth/client.ts`
- `hooks/useWalletSession.ts`
- `utils/authStorage.ts`
- `middleware/routeGuard.ts` 或客户端 guard
- `lib/auth/providerExchange.ts`
- `lib/auth/embeddedWallet.ts`

### 验收标准

- 社交登录成功后可拿到有效 session
- 外部钱包登录仍然可用
- 刷新后 session 可恢复
- 退出登录后 token 被清除

## 5.2 `/discover`

### 目标

作为 S1 的发现页，承接用户最自然的进入路径。

### 页面模块

- `DiscoverHero`
- `CreatorFeed`
- `CreatorFilters`
- `TrendingCreatorsRail`
- `GraduatingSoonRail`

### 核心展示数据

- creator 名称、头像、标签
- current level / momentum
- creator token price
- bonding curve progress
- 是否存在进行中的 buyout

### 验收标准

- 用户不需要先进工作台也能开始浏览创作者
- 能从列表进入 creator detail

## 5.3 `/creators/[creatorId]`

### 目标

作为 S1 creator detail 页，承载 bonding curve、creator token 和 buyout 交易面。

### 页面模块

- `CreatorProfileHeader`
- `BondingCurveChartCard`
- `CreatorTokenTradeCard`
- `BuyoutStatusCard`
- `CreatorMilestonesCard`
- `RelatedContentRail`

### 关键交互

1. 查看 creator 当前状态
2. 买入 creator token
3. 卖出 creator token
4. 查看 S1 buyout 是否已开启、报价如何、是否已结束
5. 查看 creator 是否已进入 S2

### 需要实现的前端能力

- `lib/api/s1.ts`
- `hooks/useCreatorMarketState.ts`
- `hooks/useCreatorTokenTrade.ts`
- `hooks/useBuyoutState.ts`

### 验收标准

- creator token 和 bonding curve 信息展示清晰
- buy / sell 和 buyout 状态能被清楚区分

## 5.4 `/portfolio`

### 目标

展示用户在 S1 里的持仓和待处理状态。

### 页面模块

- `PortfolioHeader`
- `CreatorHoldingsList`
- `BuyoutClaimsCard`
- `PendingActionsCard`

### 验收标准

- 用户能看到自己持有哪些 creator token
- 用户能看到 buyout / claim / redemption 相关状态

## 5.5 `/workspace`

### 目标

作为统一工作台，展示“继续上次工作”和“现在需要我处理什么”。

### 页面模块

- `WorkspaceWelcome`
- `RecentManifestsList`
- `RecentIntentList`
- `PendingActionsList`
- `CreateContentButton`
- `EmptyState`

### Phase 1 数据范围

如果当前 backend 还没有 list API，可以先做：

- 临时只支持从创建完成跳转进入详情页
- 或新增最小 list endpoint 作为轻量补充

### 验收标准

- 登录后能看到统一工作台首页
- 可以进入创建内容页
- 可以看到待自己处理的 intent 动作

## 5.6 `/workspace/content/new`

### 目标

创建 `ContentManifest` 基础草稿。

### 表单字段

- `contentType`
  - `SHORT_VIDEO`
  - `IMAGE_CAROUSEL`
  - `MIXED_MEDIA_NOTE`
- `title`
- `captionText`
- `tags`
- `metadata`（Phase 1 可隐藏成高级选项）

### 页面模块

- `ContentTypeSelector`
- `ManifestMetadataForm`
- `TagsInput`
- `CreateManifestActionBar`

### 对接接口

- `POST /api/v1/content/manifests`

### 验收标准

- 成功创建 manifest 后自动跳转到 `/workspace/content/[manifestId]`

## 5.7 `/workspace/content/[manifestId]`

### 目标

完成内容上传、预览和 finalize。

### 页面模块

- `ManifestHeader`
- `AssetUploadDropzone`
- `AssetList`
- `AssetPreview`
- `FinalizeManifestCard`
- `PublicationMappingCard`（Phase 1 可放在底部）

### 关键交互

1. 前端选择文件
2. 计算文件 `sha256`
3. 调 `presign`
4. 直接 PUT 到 S3
5. 调 `complete`
6. 若是视频，等待 Mux 状态变化
7. manifest 全部 ready 后调用 `finalize`

### 需要实现的前端能力

- `utils/fileHash.ts`
- `lib/api/content.ts`
- `hooks/useManifestAssetUpload.ts`
- `hooks/useManifestStatusPolling.ts`

### 前端状态设计

资产状态至少要支持：

- `LOCAL_PENDING`
- `PRESIGNING`
- `UPLOADING`
- `UPLOADED`
- `PROCESSING`
- `READY`
- `ERRORED`

### 验收标准

- 图片和视频都能上传
- 视频处理中的状态可见
- finalize 成功后看到 `manifestHashHex`

## 5.8 `/workspace/intents/[intentId]`

### 目标

作为统一 intent 详情页，根据当前钱包上下文显示对应动作。

### 页面模块

- `IntentSummaryCard`
- `BudgetTracksCard`
- `ManifestBindingCard`
- `IntentActionBar`
- `BundleBuildCard`
- `SignatureStatusCard`

### 关键交互

1. 查看 intent 详情
2. 如果当前钱包是 creator：
   - `lock intent`
   - `build bundle`
   - creator partial sign
3. 如果当前钱包是 sponsor：
   - 查看 creator 是否已 partial sign
   - sponsor final sign
   - 提交 bundle
4. 页面始终展示统一状态机，不做 creator/sponsor 双页面分叉

### 对接接口

- `POST /api/v1/proposal-intents/:intentId/lock`
- `POST /api/v1/proposal-intents/:intentId/build-bundle`
- `POST /api/v1/proposal-intents/:intentId/creator-partial-sign`
- `GET /api/v1/proposal-intents/:intentId/status`

### 前端要处理的特殊情况

- bundle 已存在且可复用
- bundle 已过期，需要重新 build
- 当前钱包不是 intent 对应参与者
- 当前钱包是 sponsor，但 creator 尚未 partial sign
- signed tx 与当前 bundle message 不匹配

### 验收标准

- 用户能清楚看见签的是哪一版内容和哪一组预算
- partial sign 成功后状态实时更新

## 5.9 `/campaigns/[proposalId]`

### 目标

作为已确认 proposal 的共享详情页。

### 页面模块

- `ProposalStatusHeader`
- `CampaignParticipantsCard`
- `TracksBreakdownCard`
- `ContentBindingCard`
- `ChainStatusCard`
- `SettlementTimeline`

### 对接接口

- `GET /api/v1/proposals/:id`

### 验收标准

- 能区分 off-chain intent 状态和 on-chain confirmed proposal 状态
- 能显示 `contentHashHex`、`contentAnchorPda`、`onChainTxSignature`

## 6. 共享前端基础设施清单

## 6.1 API Client

新增建议目录：

```text
app/src/lib/api/
  auth.ts
  content.ts
  proposalIntents.ts
  proposals.ts
  http.ts
```

要求：

- 自动注入 Bearer token
- 统一处理 `x-idempotency-key`
- 统一解析错误结构

## 6.2 Auth and Session

新增建议目录：

```text
app/src/lib/auth/
  session.ts
  walletSignIn.ts
  providerExchange.ts
  embeddedWallet.ts
app/src/hooks/
  useWalletSession.ts
```

要求：

- 用户身份、session、钱包地址三者关系清晰
- 社交登录、embedded wallet、外部钱包三条路径体验统一
- 页面可判断 `unauthenticated / authenticated / wrong-wallet`

## 6.3 Upload Pipeline

新增建议目录：

```text
app/src/lib/uploads/
  fileHash.ts
  s3Upload.ts
  uploadQueue.ts
```

要求：

- 同时支持图片和视频
- 支持多素材顺序管理
- 支持失败重试
- 上传中断后 UI 不应崩掉

## 6.4 Transaction Signing

新增建议目录：

```text
app/src/lib/solana/
  signVersionedTransaction.ts
  walletAdapterBridge.ts
  embeddedWalletBridge.ts
```

要求：

- 能处理 `VersionedTransaction`
- 能统一桥接标准钱包和 embedded wallet provider
- 明确区分 creator partial sign 与 sponsor final sign

## 6.5 App Shell

新增建议目录：

```text
app/src/components/layout/
  AppShell.tsx
  Sidebar.tsx
  Topbar.tsx
  WorkspaceTabs.tsx
```

要求：

- 先做轻量壳，不做复杂设计系统
- 支持统一工作台导航，不做 creator / sponsor 双入口

## 6.6 Web + App 共享层

如果要同时做 web 和 app，前端从一开始就要抽共享层。

建议新增：

```text
packages/
  api-client/
  domain/
  auth/
  ui-tokens/
```

职责建议：

- `api-client`
  - backend 请求封装
- `domain`
  - manifest / intent / proposal / creator market 类型定义
- `auth`
  - provider login、session、embedded wallet bridge
- `ui-tokens`
  - 颜色、间距、字体 token

## 7. 建议的文件结构调整

建议新增目录：

```text
app/src/pages/
  login.tsx
  discover.tsx
  creators/[creatorId].tsx
  portfolio.tsx
  workspace/index.tsx
  workspace/content/new.tsx
  workspace/content/[manifestId].tsx
  workspace/intents/[intentId].tsx
  campaigns/[proposalId].tsx

app/src/components/
  auth/
  market/
  workspace/
  campaign/
  shared/
  layout/

app/src/lib/
  api/
  auth/
  uploads/
  solana/

mobile/
  app/
  src/
    screens/
    components/
    hooks/
```

Phase 1 不建议做的事情：

- 不要现在就抽一个巨大的 design system
- 不要现在就引入 Redux
- 不要现在就迁移到 App Router

## 8. 推荐的状态管理方式

Phase 1 推荐保持简单：

- 页面局部状态：`useState`
- 请求状态：自定义 hooks
- session 状态：`context + hook`
- 上传队列：局部 reducer

如果后续页面增多，再考虑引入 `TanStack Query`。  
但 Phase 1 不是必须。

## 9. 开发顺序

### Milestone A：前端基础设施

目标：

- 搭好 app shell
- 搭好 auth client
- 搭好 API client
- 明确 social login / embedded wallet 路径
- 搭好 error/toast/loading 规范

交付：

- 登录页可工作
- session 可恢复
- 受保护路由可跳转

### Milestone B：S1 Market Surface

目标：

- discover feed
- creator detail
- portfolio
- S1 交易面占位和状态展示

交付：

- 用户能完成 S1 浏览和资产查看的基本路径

### Milestone C：Content Flow

目标：

- 创建 manifest
- 上传图片/视频
- finalize manifest

交付：

- 用户能完成完整内容准备流程

### Milestone D：Launch Flow Part 1

目标：

- 查看 intent
- lock
- build bundle
- partial sign

交付：

- 当前钱包作为 creator 时，能推进到“待 sponsor 签名”

### Milestone E：Launch Flow Part 2

目标：

- 查看 intent
- final sign
- submit
- 查看状态

交付：

- 当前钱包作为 sponsor 时，能完成 proposal launch 的最后一步

### Milestone F：Campaign Detail

目标：

- 查看已确认 proposal
- 查看链上状态和内容绑定

交付：

- 产品主闭环有可演示的详情页

### Milestone G：Mobile Shell

目标：

- 建立 app 端导航骨架
- 接共享 auth
- 接共享 API client

交付：

- app 端至少能跑通 `login / discover / creator detail / portfolio`

## 10. 验收标准

Phase 1 完成时，应该满足以下标准：

1. 用户可以用 `Google / Apple / 其他主登录方式` 进入产品，不强制先理解钱包
2. 用户能从发现页进入 creator detail，并看到 S1 bonding curve / creator token / buyout 状态
3. 用户能从登录开始，完成内容创建、素材上传、manifest finalize
4. 当前钱包作为 creator 时，能创建 intent 并完成 partial sign
5. 当前钱包作为 sponsor 时，能对同一 bundle 完成 final sign 和 submit
6. 页面能显示 `processing / partial / submitted / confirmed / failed / expired` 这些关键状态
7. proposal confirmed 后，能从前端查看 proposal detail
8. 整个流程不需要用户理解 PDA、vault、IDL 这些底层术语

## 11. 当前 blockers 和建议补充

### 11.1 非阻塞但建议尽快补

- intent list 查询接口
- manifest list 查询接口
- S1 creator market 查询接口整理
- 更统一的错误码文档
- proposal status polling 文档
- social login provider token exchange 接口

### 11.2 会影响体验但不阻塞设计

- dispute workflow 尚未有 UI 接口
- quest engine 尚未有 UI 接口
- MCN 和多组织管理 UI 暂不适合并行推进

## 12. 对设计师和前端工程师的明确要求

### 12.1 文案层

前端不要暴露这些术语给普通用户：

- `PDA`
- `vault`
- `idl`
- `borsh`
- `anchor`

推荐替换：

- `content binding`
- `launch transaction`
- `campaign wallet approval`
- `confirmed on-chain`

### 12.2 交互层

前端必须清楚区分三种状态：

- 业务草稿状态
- 签名状态
- 链上确认状态

不能把这三者混成一个“处理中”。

### 12.3 设计层

Phase 1 的视觉重点是：

- 清楚
- 强状态感
- 商业产品感

不要做成：

- 区块链 debug 面板
- 过度 trader 风格
- 过度 meme 风格

## 13. 建议的下一步执行方式

如果按工程效率优先，建议直接进入：

1. 建立前端路由骨架和 app shell
2. 先定 `social login + embedded wallet + external wallet fallback` 的 auth 方案
3. 打通 `discover / creator detail / portfolio`
4. 再打通 `content flow`
5. 再做统一 `intent detail` 页里的 launch 动作
6. 最后补 `campaign detail` 和 `mobile shell`

这条顺序可以最大化利用你现在已经稳定下来的 backend 能力。
